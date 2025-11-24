// src/solver.ts
import { Component, ComponentState, Stamp } from './models';
import { solveLinearSystem } from './linalg';

export interface SolveResult {
  nodeVoltages: Record<string, number>; // includes ground node '0'
  voltageSourceCurrents: Record<string, number>;
  iterations: number;
  converged: boolean;
}

export class Solver {
  components: Component[];
  state: ComponentState;

  constructor(components: Component[]) {
    this.components = components;
    this.state = { states: {} };
    // init states
    this.components.forEach(c => { if (!this.state.states[c.id]) this.state.states[c.id] = {}; });
  }

  solve(maxIter = 50, tol = 1e-3): SolveResult {
    // collect node list (excluding ground '0')
    const nodes = new Set<string>();
    this.components.forEach(c => c.pins.forEach(p => { if (p.node && p.node !== '0') nodes.add(p.node); }));
    const nodeList = Array.from(nodes);
    const N = nodeList.length;
    // Voltage sources created by components will be mapped to indices too; we collect stamps each iteration to know M
    let lastVoltages: Record<string, number> = {};
    // init lastVoltages with 0 for all nodes incl ground
    this.components.forEach(c => c.pins.forEach(p => lastVoltages[p.node!] = 0));
    lastVoltages['0'] = 0;

    // Première passe: calculer l'état initial des composants avec les tensions initiales (0V)
    // Cela permet d'initialiser correctement les composants comportementaux
    for (const c of this.components) {
      c.updateState(lastVoltages, this.state);
    }

    for (let iter = 0; iter < maxIter; iter++) {
      // Build all stamps from components using current state
      let stamps: Stamp[] = [];
      for (const c of this.components) {
        stamps = stamps.concat(c.toStamp(this.state));
      }
      // Count voltage sources in stamps (each creates extra unknown)
      const vsStamps = stamps.filter(s => s.kind === 'vs');
      const M = vsStamps.length;
      const dim = N + M; // unknowns: V_nodes (exclude ground) then currents through vs
      // Build mapping: node -> idx 0..N-1
      const nodeIndex = new Map<string, number>();
      nodeList.forEach((n, i) => nodeIndex.set(n, i));

      // Initialize matrix A and RHS z
      const A: number[][] = Array.from({length: dim}, () => Array(dim).fill(0));
      const z: number[] = Array(dim).fill(0);

      // Helper: stamp conductance between nodes
      function stampG(n1: string | null, n2: string | null, g: number) {
        if (n1 !== null && n1 !== '0') A[nodeIndex.get(n1)!][nodeIndex.get(n1)!] += g;
        if (n2 !== null && n2 !== '0') A[nodeIndex.get(n2)!][nodeIndex.get(n2)!] += g;
        if (n1 !== null && n2 !== null) {
          if (n1 !== '0' && n2 !== '0') {
            A[nodeIndex.get(n1)!][nodeIndex.get(n2)!] -= g;
            A[nodeIndex.get(n2)!][nodeIndex.get(n1)!] -= g;
          }
        }
      }

      // Stamp each stamp
      // For voltage sources, we need to assign them indices
      let vsCounter = 0;
      const vsIndexMap: Array<{stamp: Stamp, idx: number}> = [];
      for (const s of stamps) {
        if (s.kind === 'g') {
          stampG(s.n1, s.n2, s.value);
        } else if (s.kind === 'i') {
          // injection into n1 (positive)
          if (s.n1 !== null && s.n1 !== '0') z[nodeIndex.get(s.n1)!] -= s.value; // KCL sign convention
        } else if (s.kind === 'vs') {
          vsIndexMap.push({ stamp: s, idx: vsCounter });
          vsCounter++;
        }
      }

      // Now stamp voltage sources in MNA
      for (let k = 0; k < vsIndexMap.length; k++) {
        const s = vsIndexMap[k].stamp;
        const plus = s.n1;
        const minus = s.n2;
        const rowCol = N + k; // index for current unknown
        // KCL rows: add +1 at plus col and -1 at minus col in column of current unknown
        if (plus !== null && plus !== '0') A[nodeIndex.get(plus)!][rowCol] += 1;
        if (minus !== null && minus !== '0') A[nodeIndex.get(minus)!][rowCol] -= 1;
        // symmetric
        if (plus !== null && plus !== '0') A[rowCol][nodeIndex.get(plus)!] += 1;
        if (minus !== null && minus !== '0') A[rowCol][nodeIndex.get(minus)!] -= 1;
        // RHS is the voltage value
        z[rowCol] = s.value;
      }

      // Détecter les nœuds flottants (sans connexion de conductance)
      // Un nœud est flottant si sa ligne/colonne dans la matrice est vide (sauf peut-être pour les sources de tension)
      const nodeConnected = new Set<number>();
      for (let i = 0; i < N; i++) {
        let hasConnection = false;
        // Vérifier les connexions dans la matrice (nœuds de tension)
        for (let j = 0; j < N; j++) {
          if (Math.abs(A[i][j]) > 1e-15) {
            hasConnection = true;
            break;
          }
        }
        // Vérifier aussi les connexions aux sources de tension
        if (!hasConnection) {
          for (let k = 0; k < M; k++) {
            if (Math.abs(A[i][N + k]) > 1e-15 || Math.abs(A[N + k][i]) > 1e-15) {
              hasConnection = true;
              break;
            }
          }
        }
        if (hasConnection) {
          nodeConnected.add(i);
        }
      }
      
      // Ajouter une petite conductance à la masse pour les nœuds flottants
      const gFloat = 1e-12; // très petite conductance pour éviter la singularité sans affecter le circuit
      for (let i = 0; i < N; i++) {
        if (!nodeConnected.has(i)) {
          A[i][i] += gFloat;
        }
      }

      // Solve
      let x: number[];
      try {
        x = solveLinearSystem(A, z);
      } catch (e) {
        // singular -> try to regularize with larger conductance to ground for all nodes
        const eps = 1e-9;
        for (let i = 0; i < N; i++) {
          A[i][i] += eps;
        }
        // Aussi régulariser les lignes des sources de tension si nécessaire
        for (let k = 0; k < M; k++) {
          const rowCol = N + k;
          if (Math.abs(A[rowCol][rowCol]) < 1e-15) {
            A[rowCol][rowCol] += eps;
          }
        }
        try {
          x = solveLinearSystem(A, z);
        } catch (e2) {
          // Si toujours singulier, retourner une erreur avec plus d'infos
          const floatingNodes = nodeList.filter((_, i) => !nodeConnected.has(i));
          console.error('Matrice singulière détectée. Circuit peut-être mal connecté.');
          console.error('Nœuds:', nodeList);
          console.error('Nœuds flottants détectés:', floatingNodes);
          console.error('Sources de tension:', M);
          console.error('Matrice A:', A);
          throw new Error(
            `Impossible de résoudre le circuit. ` +
            `Vérifiez que tous les composants sont correctement connectés. ` +
            `${floatingNodes.length > 0 ? `Nœuds flottants: ${floatingNodes.join(', ')}. ` : ''}` +
            `Assurez-vous que tous les pins GND sont connectés ensemble.`
          );
        }
      }

      // Extract node voltages
      const nodeVoltages: Record<string, number> = {};
      nodeVoltages['0'] = 0;
      nodeList.forEach((n, i) => nodeVoltages[n] = x[i]);

      // Update component states (behavioral) using nodeVoltages
      for (const c of this.components) {
        c.updateState(nodeVoltages, this.state);
      }

      // Check convergence vs lastVoltages on all nodes
      let maxDiff = 0;
      for (const k of Object.keys(nodeVoltages)) {
        const prev = lastVoltages[k] ?? 0;
        const diff = Math.abs(nodeVoltages[k] - prev);
        if (diff > maxDiff) maxDiff = diff;
      }

      lastVoltages = nodeVoltages;

      // If converged, build result currents map for voltage sources
      if (maxDiff < tol) {
        const vsCurrents: Record<string, number> = {};
        for (let k = 0; k < vsIndexMap.length; k++) {
          const id = vsIndexMap[k].stamp.meta?.id ?? `vs_${k}`;
          vsCurrents[id] = x[N + k];
        }
        return { nodeVoltages: lastVoltages, voltageSourceCurrents: vsCurrents, iterations: iter+1, converged: true };
      }
      // otherwise continue iteration (note: stamps depend on updated state next iter)
    }
    // not converged: return last
    return { nodeVoltages: lastVoltages, voltageSourceCurrents: {}, iterations: maxIter, converged: false };
  }
}

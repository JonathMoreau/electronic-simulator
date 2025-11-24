// src/components.ts
import { Component, Pin, Stamp, ComponentState } from './models';

// Helper: create a pin
export function pin(cmpId: string, name: string): Pin {
  return { id: `${cmpId}:${name}`, name };
}

// --- Resistor
export class Resistor extends Component {
  constructor(id: string, public rOhm: number, a: string = 'A', b: string = 'B') {
    super(id, 'RESISTOR', [pin(id,a), pin(id,b)]);
  }
  toStamp(_: ComponentState): Stamp[] {
    const n1 = this.pins[0].node ?? null;
    const n2 = this.pins[1].node ?? null;
    const g = 1.0 / this.rOhm;
    return [{ kind: 'g', n1, n2, value: g }];
  }
  updateState(_nodeVoltages: Record<string, number>, _state: ComponentState) { /* nothing */ }
}

// --- Générateur (source de tension avec option de limitation de courant)
export class Generateur extends Component {
  constructor(id: string, public voltage: number, plus: string = 'PLUS', minus: string = 'MINUS', public maxCurrent: number | null = null) {
    super(id, 'GENERATEUR', [pin(id, plus), pin(id, minus)]);
  }
  toStamp(_: ComponentState): Stamp[] {
    const plus = this.pins[0].node ?? null;
    const minus = this.pins[1].node ?? null;
    
    if (this.maxCurrent !== null && this.maxCurrent > 0) {
      // Source avec limitation de courant : modéliser comme source de tension + résistance interne
      // R_internal = V / I_max
      const rInternal = this.voltage / this.maxCurrent;
      // Stamp: source de tension + résistance série
      return [
        { kind: 'vs', n1: plus, n2: minus, value: this.voltage, meta: { id: this.id } },
        { kind: 'g', n1: plus, n2: minus, value: 1.0 / rInternal }
      ];
    } else {
      // Source idéale (courant illimité)
      return [{ kind: 'vs', n1: plus, n2: minus, value: this.voltage, meta: { id: this.id } }];
    }
  }
  updateState(_nodeVoltages: Record<string, number>, _state: ComponentState) {}
}

// Alias pour compatibilité (déprécié, utiliser Generateur)
export class VSource extends Generateur {
  constructor(id: string, voltage: number, plus: string = 'PLUS', minus: string = 'MINUS') {
    super(id, voltage, plus, minus, null);
  }
}

// --- Switch (ideal: open = no connection, closed = short circuit via 0V source)
export class SwitchComp extends Component {
  constructor(id: string, public closed: boolean = false) {
    super(id, 'SWITCH', [pin(id,'A'), pin(id,'B')]);
  }
  toStamp(_: ComponentState): Stamp[] {
    if (!this.closed) {
      // Interrupteur ouvert : circuit ouvert, aucun stamp (pas de connexion)
      return [];
    }
    // Interrupteur fermé : court-circuit idéal via source de tension 0V
    // Cela force les deux nœuds à avoir la même tension sans créer de singularité
    const n1 = this.pins[0].node ?? null;
    const n2 = this.pins[1].node ?? null;
    if (n1 === null || n2 === null || n1 === n2) return [];
    // Utiliser une source de tension de 0V pour forcer les deux nœuds à avoir la même tension
    // C'est la méthode standard pour modéliser un court-circuit dans MNA
    return [{ kind: 'vs', n1, n2, value: 0, meta: { id: this.id } }];
  }
  updateState(_nodeVoltages: Record<string, number>, _state: ComponentState) {}
}

// --- LED (simple diode piecewise: OFF=open, ON = Vf + Rseries)
export class LED extends Component {
  constructor(id: string, public vf = 2.0, public rSeries = 20, public color: string = '#ff0000') {
    super(id, 'LED', [pin(id,'AN'), pin(id,'K')]);
  }
  toStamp(state: ComponentState): Stamp[] {
    const st = state.states[this.id] ?? { on: false };
    const n1 = this.pins[0].node ?? null; // anode
    const n2 = this.pins[1].node ?? null; // cathode
    if (!st.on) {
      // open circuit -> no stamp
      return [];
    } else {
      // model as Vsource (Vf) + series resistor => stamp resistor between nodes and Vsource effect via equivalent
      // Simpler: stamp a conductance g = 1/(rSeries) and inject a source to enforce voltage drop ~Vf via a voltage source
      // We'll approximate by stamping a voltage source of Vf from n1 to n2 in series with small resistance rSeries.
      // Represent as a voltage source between n1 and n2 and also a series conductance? For MNA, easiest is: voltage source between n1 and n2 of Vf,
      // plus a small conductance in parallel to avoid singularities.
      return [
        { kind: 'vs', n1, n2, value: this.vf, meta: { id: `${this.id}_Vf` } },
        { kind: 'g', n1, n2, value: 1.0 / this.rSeries }
      ];
    }
  }
  updateState(nodeVoltages: Record<string, number>, state: ComponentState) {
    const AN = this.pinsMap['AN'];
    const K = this.pinsMap['K'];
    if (!AN || !K) {
      // Si les pins ne sont pas connectés, éteindre la LED
      if (state.states[this.id]) {
        state.states[this.id]['on'] = false;
      }
      return;
    }
    
    // Vérifier que les tensions sont définies (pas flottantes)
    const V_AN = nodeVoltages[AN];
    const V_K = nodeVoltages[K];
    
    // Si une des tensions n'est pas définie, éteindre la LED
    if (V_AN === undefined || V_K === undefined) {
      if (state.states[this.id]) {
        state.states[this.id]['on'] = false;
      }
      return;
    }
    
    // Vérifier que les deux nœuds sont différents (pas un court-circuit)
    if (AN === K) {
      if (state.states[this.id]) {
        state.states[this.id]['on'] = false;
      }
      return;
    }
    
    // Note: La vérification de connexion à GND est faite dans getLEDState de canvasView
    // qui a accès à tous les composants et wires pour vérifier les connexions indirectes
    // Ici, on calcule seulement l'état basé sur les tensions
    
    const V_diff = V_AN - V_K; // tension différentielle anode - cathode
    const Vf = this.vf;
  
    if (!state.states[this.id]) {
      state.states[this.id] = { on: false };
    }
    
    const prevOn = state.states[this.id]['on'] ?? false;
    
    // Logique avec hystérésis pour éviter les oscillations
    // LED s'allume si V_diff >= Vf + petite marge
    // LED s'éteint si V_diff < Vf - petite marge
    const margin = 0.1; // 100mV de marge pour éviter les oscillations
    if (prevOn) {
      // Si déjà allumée, s'éteint seulement si V_diff < Vf - margin
      state.states[this.id]['on'] = V_diff >= (Vf - margin);
    } else {
      // Si éteinte, s'allume seulement si V_diff >= Vf + margin
      state.states[this.id]['on'] = V_diff >= (Vf + margin);
    }
  }
}

// --- LM339 comparator (single-channel simplified)
export class LM339 extends Component {
  // pins: VCC, GND, IN+, IN-, OUT
  constructor(id: string) {
    super(id, 'LM339', [pin(id,'VCC'), pin(id,'GND'), pin(id,'IN+'), pin(id,'IN-'), pin(id,'OUT')]);
  }
  toStamp(state: ComponentState): Stamp[] {
    // if comparator active (V+ <= V-) => sink (low) to GND
    // Utiliser une source de tension 0V pour forcer la sortie à GND (comme les interrupteurs)
    const st = state.states[this.id] ?? { active: false };
    const outNode = this.pins[4].node ?? null;
    const gndNode = this.pins[1].node ?? null;
    if (st.active) {
      // Source de tension 0V entre OUT et GND force OUT = GND = 0V
      if (outNode === null || gndNode === null || outNode === gndNode) return [];
      return [{ kind: 'vs', n1: outNode, n2: gndNode, value: 0, meta: { id: this.id } }];
    } else {
      // high-Z: no stamp (pull-up externe fera monter la sortie)
      return [];
    }
  }
  updateState(nodeVoltages: Record<string, number>, state: ComponentState) {
    const pinsMap = this.pinsMap;
    const INP_node = pinsMap['IN+'];
    const INM_node = pinsMap['IN-'];
    const OUT_node = pinsMap['OUT'];
    
    if (!INP_node || !INM_node || !OUT_node) {
      return; // pins pas encore connectés
    }
    
    const INP = nodeVoltages[INP_node];
    const INM = nodeVoltages[INM_node];
    
    // Si les tensions ne sont pas encore définies, ne pas mettre à jour l'état
    if (INP === undefined || INM === undefined) {
      return;
    }
  
    if (!state.states[this.id]) {
      state.states[this.id] = {};
    }
    
    // Comparaison avec une petite marge pour éviter les problèmes de précision numérique
    // Logique inversée : Si IN+ > IN- (avec une marge de 1mV), le comparateur est actif (sortie tirée vers GND)
    // Sinon, le comparateur est inactif (sortie flottante, pull-up externe fera monter)
    const margin = 0.001; // 1mV de marge pour éviter les problèmes de précision
    if (INP > INM + margin) {
      // sortie tirée vers 0 V (logique inversée)
      state.states[this.id]['active'] = true;
    } else {
      // sortie flottante → on ne force rien (pull-up externe fera monter)
      state.states[this.id]['active'] = false;
    }
  }
}

// --- HC04 inverter (single gate simplified) modeled as push-pull with R_out
export class HC04 extends Component {
  // pins: VCC, GND, IN, OUT
  constructor(id: string, public vcc = 5) {
    super(id, 'HC04', [pin(id,'VCC'), pin(id,'GND'), pin(id,'IN'), pin(id,'OUT')]);
  }
  toStamp(state: ComponentState): Stamp[] {
    const st = state.states[this.id] ?? { outHigh: false, driven: false };
    const outNode = this.pins[3].node ?? null;
    const vccNode = this.pins[0].node ?? null;
    const gndNode = this.pins[1].node ?? null;
    if (st.driven) {
      if (st.outHigh) {
        // Force OUT = VCC by using a 0V source between OUT and VCC (OUT - VCC = 0V)
        // Pas de résistance série pour forcer directement la tension
        if (outNode === null || vccNode === null || outNode === vccNode) return [];
        return [{ kind: 'vs', n1: outNode, n2: vccNode, value: 0, meta: { id: this.id + '_vs' } }];
      } else {
        // Force OUT = GND by using a 0V source between OUT and GND
        if (outNode === null || gndNode === null || outNode === gndNode) return [];
        return [{ kind: 'vs', n1: outNode, n2: gndNode, value: 0, meta: { id: this.id + '_vs' } }];
      }
    }
    return [];
  }
  updateState(nodeVoltages: Record<string, number>, state: ComponentState): void {
    const inNode = this.pins[2].node!, vccNode = this.pins[0].node!, gndNode = this.pins[1].node!;
    const vin = nodeVoltages[inNode] ?? 0;
    const vcc = nodeVoltages[vccNode] ?? 5;
    // thresholds (HC logic family approximate)
    const VIL = 0.3 * vcc;
    const VIH = 0.7 * vcc;
    let outHigh = false;
    if (vin >= VIH) outHigh = false; // input HIGH -> inverter outputs LOW
    if (vin <= VIL) outHigh = true;  // input LOW -> outputs HIGH
    // If in between, keep previous if exists
    const prev = state.states[this.id];
    if (prev && typeof prev.outHigh === 'boolean') {
      if (vin > VIL && vin < VIH) {
        outHigh = prev.outHigh;
      }
    }
    state.states[this.id] = { driven: true, outHigh };
  }
}

// --- HC08 AND gate (single gate with two inputs)
export class HC08 extends Component {
  // pins: VCC, GND, A, B, OUT
  constructor(id: string, public vcc = 5) {
    super(id, 'HC08', [pin(id,'VCC'), pin(id,'GND'), pin(id,'A'), pin(id,'B'), pin(id,'OUT')]);
  }
  toStamp(state: ComponentState): Stamp[] {
    const st = state.states[this.id] ?? { outHigh: false, driven: false };
    const outNode = this.pins[4].node ?? null;
    const vccNode = this.pins[0].node ?? null;
    const gndNode = this.pins[1].node ?? null;
    if (st.driven) {
      if (st.outHigh) {
        // Force OUT = VCC by using a 0V source between OUT and VCC (OUT - VCC = 0V)
        // Pas de résistance série pour forcer directement la tension
        if (outNode === null || vccNode === null || outNode === vccNode) return [];
        return [{ kind: 'vs', n1: outNode, n2: vccNode, value: 0, meta: { id: this.id + '_vs' } }];
      } else {
        // Force OUT = GND by using a 0V source between OUT and GND
        if (outNode === null || gndNode === null || outNode === gndNode) return [];
        return [{ kind: 'vs', n1: outNode, n2: gndNode, value: 0, meta: { id: this.id + '_vs' } }];
      }
    }
    return [];
  }
  updateState(nodeVoltages: Record<string, number>, state: ComponentState): void {
    const a = this.pins[2].node!, b = this.pins[3].node!;
    const va = nodeVoltages[a] ?? 0, vb = nodeVoltages[b] ?? 0;
    const vcc = nodeVoltages[this.pins[0].node!] ?? 5;
    const VIL = 0.3 * vcc;
    const VIH = 0.7 * vcc;
    const Ahigh = va >= VIH;
    const Bhigh = vb >= VIH;
    const Alow = va <= VIL;
    const Blow = vb <= VIL;
    let outHigh = false;
    if (Ahigh && Bhigh) outHigh = true;
    else if (Alow || Blow) outHigh = false;
    else {
      const prev = state.states[this.id];
      outHigh = prev?.outHigh ?? false;
    }
    state.states[this.id] = { driven: true, outHigh };
  }
}

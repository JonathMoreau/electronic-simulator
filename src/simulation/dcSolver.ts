import { Circuit } from "../domain/circuit/Circuit";

export interface SolvedNodeVoltages {
  [nodeId: string]: number; // volts
}

export class DCSolver {
  solve(circuit: Circuit): SolvedNodeVoltages {
    const voltages: SolvedNodeVoltages = {};

    // Règles provisoires :
    // - Nœud nommé VCC = 5V
    // - Nœud nommé GND = 0V

    circuit.components.forEach(comp => {
      comp.pins.forEach(pin => {
        if (pin.name === "VCC") voltages[pin.nodeId!] = 5;
        if (pin.name === "GND") voltages[pin.nodeId!] = 0;
      });
    });

    // === ICI viendra l’itération type SPICE pour résoudre ===
    // Résolution Ohm/Kirchhoff
    // -> On ajoutera les équations pour chaque composant

    return voltages;
  }
}

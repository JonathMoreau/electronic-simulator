// src/circuit.ts
import { CircuitDocument, Component, Node } from './models';

export interface StampedResistor {
  id: string;
  n1: string | null; // node id (null = ground)
  n2: string | null;
  value: number; // resistance in ohms
}

export interface VoltageSourceStamp {
  id: string;
  plus: string | null;
  minus: string | null;
  voltage: number;
}

export class Circuit {
  doc: CircuitDocument;

  constructor(doc: CircuitDocument) {
    this.doc = doc;
  }

  getNodes(): Node[] {
    return this.doc.nodes;
  }

  // return list of resistors and voltage sources useful for DC solver
  getResistors(): StampedResistor[] {
    return this.doc.components
      .filter(c => c.type === 'RESISTOR')
      .map((c) => {
        const a = Object.values(c.pins)[0] ?? null;
        const b = Object.values(c.pins)[1] ?? null;
        const r = c.properties?.resistance;
        if (typeof r !== 'number') throw new Error(`Resistor ${c.id} missing resistance property`);
        return { id: c.id, n1: a, n2: b, value: r };
      });
  }

  getVoltageSources(): VoltageSourceStamp[] {
    return this.doc.components
      .filter(c => c.type === 'V_SOURCE')
      .map((c) => {
        // assume pins plus/minus keys or first two pins
        const keys = Object.keys(c.pins);
        const plus = c.pins['plus'] ?? c.pins[keys[0]] ?? null;
        const minus = c.pins['minus'] ?? c.pins[keys[1]] ?? null;
        const voltage = c.properties?.voltage;
        if (typeof voltage !== 'number') throw new Error(`Voltage source ${c.id} missing voltage`);
        return { id: c.id, plus, minus, voltage };
      });
  }

  getGroundNodeId(): string | null {
    const g = this.doc.nodes.find(n => n.isGround);
    return g ? g.id : null;
  }
}

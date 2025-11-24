// src/models.ts
export type NodeId = string;
export type ComponentId = string;

export interface Pin {
  id: string;      // unique pin id (componentId-pinName)
  name: string;    // human name, e.g. "A", "B", "VCC", "GND", "IN", "OUT"
  node?: NodeId;   // assigned node id after netlist build
}

export abstract class Component {
  constructor(public id: ComponentId, public type: string, public pins: Pin[]) {}
  abstract toStamp(state: ComponentState): Stamp[]; // produce linear stamps for current state
  // optionally update internal behavioural state (e.g. logic output) given node voltages
  abstract updateState(nodeVoltages: Record<NodeId, number>, state: ComponentState): void;
  
  // Getter pour mapper le nom du pin à l'ID du node
  get pinsMap(): Record<string, NodeId> {
    const map: Record<string, NodeId> = {};
    for (const pin of this.pins) {
      if (pin.node) {
        map[pin.name] = pin.node;
      }
    }
    return map;
  }
}

export interface Stamp {
  // either 'conductance' between n1/n2, 'voltageSource' connecting nodes, or 'current' injection
  kind: 'g' | 'vs' | 'i';
  // nodes can be null meaning ground
  n1: NodeId | null;
  n2: NodeId | null;
  // for 'g' : value = conductance (S)
  // for 'vs' : value = voltage (V), id used to map to additional unknown
  // for 'i' : value = current injected into n1 (positive)
  value: number;
  meta?: any; // optional metadata, e.g. id of voltage source
}

export interface ComponentState {
  // keyed by component id for storing internal states (diode on/off, comparator active, logic outputs)
  states: Record<string, any>;
}

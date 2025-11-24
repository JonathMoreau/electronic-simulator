// src/netlist.ts
import { Component, Pin } from './models';

class UF {
  parent = new Map<string,string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x,x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const r = this.find(p);
      this.parent.set(x,r);
      return r;
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

export function buildNetlist(components: Component[], explicitWires: Array<[Pin,Pin]> = []) {
  const uf = new UF();
  // initialize pins
  components.forEach(c => c.pins.forEach(p => uf.find(p.id)));
  // union explicit wires (user-provided connections)
  explicitWires.forEach(([p1,p2]) => uf.union(p1.id, p2.id));
  
  // Connecter automatiquement tous les pins GND ensemble
  const gndPins: Pin[] = [];
  components.forEach(c => c.pins.forEach(p => {
    if (p.name.toUpperCase() === 'GND') {
      gndPins.push(p);
    }
  }));
  // Connecter tous les pins GND ensemble
  if (gndPins.length > 1) {
    for (let i = 1; i < gndPins.length; i++) {
      uf.union(gndPins[0].id, gndPins[i].id);
    }
  }
  
  // build node ids map
  const rootToNode = new Map<string,string>();
  let counter = 0;
  let hasGnd = false;
  
  // D'abord, trouver tous les nœuds GND et leur assigner '0'
  components.forEach(c => c.pins.forEach(p => {
    const root = uf.find(p.id);
    if (p.name.toUpperCase() === 'GND' && !rootToNode.has(root)) {
      rootToNode.set(root, '0');
      hasGnd = true;
    }
  }));
  
  // Ensuite, assigner les autres nœuds
  components.forEach(c => c.pins.forEach(p => {
    const root = uf.find(p.id);
    if (!rootToNode.has(root)) {
      const nodeName = `N${++counter}`;
      rootToNode.set(root, nodeName);
    }
    p.node = rootToNode.get(root)!;
  }));
  
  return { components, nodeCount: counter + (hasGnd ? 1 : 0) };
}

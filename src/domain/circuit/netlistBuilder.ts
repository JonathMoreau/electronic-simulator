// Union-Find pour fusionner les nœuds
class UnionFind {
    parent: Map<string, string> = new Map();
  
    find(x: string): string {
      if (!this.parent.has(x)) this.parent.set(x, x);
      if (this.parent.get(x) !== x) {
        this.parent.set(x, this.find(this.parent.get(x)!));
      }
      return this.parent.get(x)!;
    }
  
    union(x: string, y: string) {
      const rootX = this.find(x);
      const rootY = this.find(y);
      if (rootX !== rootY) this.parent.set(rootY, rootX);
    }
  }
  
  export class NetlistBuilder {
    build(circuit: Circuit) {
      const uf = new UnionFind();
  
      // Chaque pin devient un nœud unique
      circuit.components.forEach(c => {
        c.pins.forEach(p => {
          uf.find(p.id);
        });
      });
  
      // Chaque wire fusionne deux nœuds
      circuit.wires.forEach(w => {
        uf.union(w.from.id, w.to.id);
      });
  
      // Attribution des nodeId physiques
      const nodeMap = new Map<string, string>();
  
      circuit.components.forEach(c => {
        c.pins.forEach(p => {
          const root = uf.find(p.id);
          if (!nodeMap.has(root)) {
            nodeMap.set(root, `N${nodeMap.size + 1}`);
          }
          p.nodeId = nodeMap.get(root)!;
        });
      });
  
      return circuit; // enrichi de nodeIds
    }
  }
  
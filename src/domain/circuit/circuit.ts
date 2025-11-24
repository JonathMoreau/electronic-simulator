// Chaque circuit contient des composants et des wires
export class Circuit {
    constructor(
      public readonly id: string,
      public components: Component[] = [],
      public wires: Wire[] = [],
    ) {}
  
    addComponent(component: Component) {
      this.components.push(component);
    }
  
    addWire(wire: Wire) {
      this.wires.push(wire);
    }
  }
  
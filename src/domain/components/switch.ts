export class Switch extends Component {
    constructor(id: string, public closed: boolean = false) {
      super(id, "switch", [
        new Pin(`${id}-1`, "A"),
        new Pin(`${id}-2`, "B")
      ]);
    }
  
    getModel() {
      return {
        type: "resistor",
        value: this.closed ? 0.1 : 10_000_000,
        pins: this.pins
      };
    }
  }
  
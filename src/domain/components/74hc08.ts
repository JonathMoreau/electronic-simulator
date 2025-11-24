export class HC08AndGate extends Component {
    constructor(id: string) {
      super(id, "hc08", [
        new Pin(`${id}-VCC`, "VCC"),
        new Pin(`${id}-GND`, "GND"),
        new Pin(`${id}-A`, "A"),
        new Pin(`${id}-B`, "B"),
        new Pin(`${id}-OUT`, "OUT")
      ]);
    }
  
    getModel() {
      return {
        type: "logicAnd",
        pins: this.pins
      };
    }
  }
  
export class HC04Inverter extends Component {
    constructor(id: string) {
      super(id, "hc04", [
        new Pin(`${id}-VCC`, "VCC"),
        new Pin(`${id}-GND`, "GND"),
        new Pin(`${id}-IN`, "IN"),
        new Pin(`${id}-OUT`, "OUT")
      ]);
    }
  
    getModel() {
      return {
        type: "logicNot",
        pins: this.pins
      };
    }
  }
  
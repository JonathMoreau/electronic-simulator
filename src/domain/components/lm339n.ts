export class LM339Comparator extends Component {
    constructor(id: string) {
      super(id, "lm339", [
        new Pin(`${id}-VCC`, "VCC"),
        new Pin(`${id}-GND`, "GND"),
        new Pin(`${id}-IN+`, "IN+"),
        new Pin(`${id}-IN-`, "IN-"),
        new Pin(`${id}-OUT`, "OUT")
      ]);
    }
  
    getModel() {
      return {
        type: "comparator",
        openCollector: true,
        pins: this.pins
      };
    }
  }
  
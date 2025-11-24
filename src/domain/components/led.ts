export class LED extends Component {
    constructor(id: string, public vf: number = 2.0) {
      super(id, "led", [
        new Pin(`${id}-A`, "Anode"),
        new Pin(`${id}-C`, "Cathode")
      ]);
    }
  
    getModel() {
      return {
        type: "diode",
        vf: this.vf,
        pins: this.pins
      };
    }
  }
  
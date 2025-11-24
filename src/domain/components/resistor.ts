import { Component, Pin } from "../circuit/Component";

export class Resistor extends Component {
  constructor(id: string, public valueOhm: number) {
    super(id, "resistor", [
      new Pin(`${id}-1`, "A"),
      new Pin(`${id}-2`, "B")
    ]);
  }

  getModel() {
    return {
      type: "resistor",
      value: this.valueOhm,
      pins: this.pins
    };
  }
}

import { SolvedNodeVoltages } from "./DCSolver";
import { Component } from "../domain/circuit/Component";

export class MeasurementService {
  constructor(private voltages: SolvedNodeVoltages) {}

  voltageBetween(nodeA: string, nodeB: string) {
    return (this.voltages[nodeA] ?? 0) - (this.voltages[nodeB] ?? 0);
  }

  pinVoltage(pin: { nodeId: string }) {
    return this.voltages[pin.nodeId] ?? 0;
  }

  logical(pin: { nodeId: string }) {
    const v = this.pinVoltage(pin);
    return v > 2.5 ? "HIGH" : "LOW";
  }
}

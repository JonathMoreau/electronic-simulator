// src/index.ts
import { Circuit } from './circuit';
import { solveDC } from './solver';
import { CircuitDocument } from './models';

// Example circuit: simple voltage divider:
// V1 (10V) -> R1 (3k) -> node Vout -> R2 (2k) -> GND
const doc: CircuitDocument = {
  meta: { name: 'voltage_divider_example' },
  nodes: [
    { id: 'Vcc' },
    { id: 'Vout' },
    { id: 'GND', isGround: true }
  ],
  components: [
    { id: 'V1', type: 'V_SOURCE', pins: { plus: 'Vcc', minus: 'GND' }, properties: { voltage: 10 } },
    { id: 'R1', type: 'RESISTOR', pins: { a: 'Vcc', b: 'Vout' }, properties: { resistance: 3000 } },
    { id: 'R2', type: 'RESISTOR', pins: { a: 'Vout', b: 'GND' }, properties: { resistance: 2000 } }
  ]
};

function main() {
  const c = new Circuit(doc);
  const res = solveDC(c);
  console.log('Node voltages:', res.nodeVoltages);
  console.log('Voltage source currents (A):', res.voltageSourceCurrents);
}

if (require.main === module) {
  main();
}

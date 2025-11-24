// tests/solver.test.ts
import { Circuit } from '../src/circuit';
import { solveDC } from '../src/solver';
import { CircuitDocument } from '../src/models';

test('voltage divider yields expected Vout', () => {
  const doc: CircuitDocument = {
    meta: { name: 'vd_test' },
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
  const c = new Circuit(doc);
  const r = solveDC(c);
  const vout = r.nodeVoltages['Vout'];
  expect(vout).toBeCloseTo(4.0, 3);
});

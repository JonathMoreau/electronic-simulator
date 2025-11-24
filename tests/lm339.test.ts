// tests/lm339.test.ts
import { VSource, Resistor, LED, LM339 } from '../src/components';
import { buildNetlist } from '../src/netlist';
import { Solver } from '../src/solver';
import { Component } from '../src/models';

test('LM339 sinks output when IN+ < IN-', () => {
  const vcc = new VSource('VCC', 5, 'VCC_PLUS', 'GND');
  const vinP = new VSource('VINP', 2.0, 'VINP_PLUS', 'GND');
  const vinM = new VSource('VINM', 3.0, 'VINM_PLUS', 'GND');
  const cmp = new LM339('CMP1');
  const rpull = new Resistor('RP', 10000, 'A', 'B');

  const comps: Component[] = [vcc, vinP, vinM, cmp, rpull];

  // wires:
  const wires: Array<[any, any]> = [
    [vcc.pins[0], cmp.pins[0]], // VCC -> CMP.VCC
    [vcc.pins[1], cmp.pins[1]], // GND -> CMP.GND
    [vinP.pins[0], cmp.pins[2]], // VINP_PLUS -> CMP.IN+
    [vinM.pins[0], cmp.pins[3]], // VINM_PLUS -> CMP.IN-
    [vcc.pins[0], rpull.pins[0]], // VCC -> Rpull.A
    [rpull.pins[1], cmp.pins[4]] // Rpull.B -> CMP.OUT
  ];

  const { components } = buildNetlist(comps, wires);
  const solver = new Solver(components as any);
  const res = solver.solve(100, 1e-3);
  expect(res.converged).toBeTruthy();

  // find comparator OUT node voltage
  // locate CMP pin objects to get node id
  const cmpOutNode = cmp.pins[4].node!;
  const vOut = res.nodeVoltages[cmpOutNode];
  expect(vOut).toBeDefined();
  // expect output near 0 (sink active)
  expect(vOut).toBeLessThan(0.5);
});

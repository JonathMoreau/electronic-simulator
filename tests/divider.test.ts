// tests/divider.test.ts
import { Resistor, VSource } from '../src/components';
import { buildNetlist } from '../src/netlist';
import { Solver } from '../src/solver';
import { Component } from '../src/models';

test('voltage divider: Vout = Vin * R2/(R1+R2)', () => {
  // Vin = 10V, R1 = 3k between Vin and Vout, R2 = 2k between Vout and GND
  const vin = new VSource('V_SRC', 10, 'PLUS', 'GND');
  const r1 = new Resistor('R1', 3000, 'A', 'B'); // we'll wire A->VIN_PLUS, B->Vout
  const r2 = new Resistor('R2', 2000, 'A', 'B'); // B->GND

  // Assemble components
  const comps: Component[] = [vin, r1, r2];

  // Wire definitions: pair of pins to join
  // vin.pins: PLUS, GND ; r1.pins: A,B ; r2.pins: A,B
  // wires:
  const wires: Array<[any, any]> = [
    [vin.pins[0], r1.pins[0]], // VIN_PLUS -> R1.A
    [r1.pins[1], r2.pins[0]],  // R1.B -> R2.A (Vout)
    [r2.pins[1], vin.pins[1]]  // R2.B -> VIN.GND
  ];

  const { components } = buildNetlist(comps, wires);
  const solver = new Solver(components as any);
  const res = solver.solve(50, 1e-6);
  expect(res.converged).toBeTruthy();
  const vout = res.nodeVoltages['N1'] ?? null; // depending on netlist ordering N1 is used
  // Accept either N1 or N2 — find node not ground and not Vin (we'll check approximate expected)
  const nodes = Object.entries(res.nodeVoltages).filter(([k]) => k !== '0');
  // find node whose voltage is ~4.0
  const found = nodes.find(([k,v]) => Math.abs(v - 4.0) < 0.05);
  expect(found).toBeDefined();
});

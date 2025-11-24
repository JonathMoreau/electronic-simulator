// src/index.ts
import { Resistor, VSource, LED, SwitchComp, LM339, HC04, HC08 } from '../../src/components';
import { buildNetlist } from '../../src/netlist';
import { Solver } from '../../src/solver';

// Build example circuit:
// Vcc = 5V, GND
// LM339 comparator: IN+ = 2V, IN- = 3V -> comparator sinks output to GND (active) -> output node pulled up via R_pullup to Vcc
// components: V1 (Vcc), Vplus (2V source), Vminus (3V source), Rpullup, comparator, LED to show output (from out to GND via LED & resistor)
const vcc = new VSource('VCC_SRC', 5, 'PLUS', 'MINUS');
const gnd = null; // ground is identified by pin names 'GND' in components

// Create components
const v1 = new VSource('VCC', 5, 'VCC_PLUS', 'GND'); // main Vcc
const vinP = new VSource('VINP', 2.0, 'VINP_PLUS', 'GND'); // input plus
const vinM = new VSource('VINM', 3.0, 'VINM_PLUS', 'GND'); // input minus

const cmp = new LM339('CMP1');
const rpull = new Resistor('Rpull', 10000, 'A', 'B'); // we'll connect A->VCC node, B->OUT
const rled = new Resistor('Rled', 1000, 'A', 'B'); // series resistor for LED
const led = new LED('LED1', 2.0, 20);

// Now wire them by pin names: to make life simple, we will connect pins manually:
// Assign pin names to simulate connections: we rely on pin.name presets in components to choose 'GND' etc.
// For VSource 'VCC', plus pin name is 'VCC_PLUS' and minus 'GND'. We'll connect comparator pins accordingly.

// Connect pins manually:
// Set comparator pin nodes by mapping pin.name -> node label and relying on buildNetlist's 'GND' mapping
// To keep code short, connect by aliasing pin.node strings (we still need to have unique pin ids to union-find)

// Trick: we will create explicit wires array of pin pairs to connect desired nets.
import { pin as createPin } from '../../src/components';
import { Component } from '../../src/models';

// To create wires we need real Pin objects from components; locate them:
function findPin(c: Component, name: string) {
  const p = c.pins.find(pp => pp.name === name);
  if (!p) throw new Error(`Pin ${name} not found on ${c.id}`);
  return p;
}

// Build list of components participating:
const components: Component[] = [v1, vinP, vinM, cmp, rpull, led, rled];

// Now define explicit wires as pairs of pins we want to connect:
// connect v1 PLUS -> Rpull.A
// connect v1 minus already named 'GND' through v1 pins
const wires: Array<[any, any]> = [];

// helpful pins
const v1_plus = findPin(v1, 'VCC_PLUS'); // VCC +
const v1_gnd = findPin(v1, 'GND');
const vinp_plus = findPin(vinP, 'VINP_PLUS');
const vinp_gnd = findPin(vinP, 'GND');
const vinm_plus = findPin(vinM, 'VINM_PLUS');
const vinm_gnd = findPin(vinM, 'GND');

// comparator pins: [VCC(0), GND(1), IN+(2), IN-(3), OUT(4)]
const cmp_vcc = findPin(cmp, 'VCC');
const cmp_gnd = findPin(cmp, 'GND');
const cmp_inp = findPin(cmp, 'IN+');
const cmp_inm = findPin(cmp, 'IN-');
const cmp_out = findPin(cmp, 'OUT');

// resistor pullup pins
const rpull_a = findPin(rpull, 'A');
const rpull_b = findPin(rpull, 'B');

// led pins: AN (anode), K (cathode)
const led_an = findPin(led, 'AN');
const led_k = findPin(led, 'K');
// rled pins
const rled_a = findPin(rled, 'A');
const rled_b = findPin(rled, 'B');

// WIRING:
// VCC plus -> cmp VCC
wires.push([v1_plus, cmp_vcc]);
// VCC plus -> rpull.A
wires.push([v1_plus, rpull_a]);
// VCC minus (GND) is v1_gnd; connect comparator GND and VIN sources' GND pins
wires.push([v1_gnd, cmp_gnd]);
wires.push([v1_gnd, vinp_gnd]); // Connect vinP GND to circuit GND
wires.push([v1_gnd, vinm_gnd]); // Connect vinM GND to circuit GND
// Connect VIN sources plus pins to cmp inputs:
wires.push([vinp_plus, cmp_inp]);
wires.push([vinm_plus, cmp_inm]);

// Pull-up resistor: rpull.B -> cmp.OUT
wires.push([rpull_b, cmp_out]);

// LED chain: cmp.OUT -> rled.A -> led.AN ; led.K -> GND
wires.push([cmp_out, rled_a]);
wires.push([rled_b, led_an]); // rled.B -> led anode
wires.push([led_k, v1_gnd]);

// Build netlist
const { components: compsWithNodes } = buildNetlist(components, wires);

// Solve
const solver = new Solver(compsWithNodes as any);
const res = solver.solve(100, 1e-3);

console.log('Converged:', res.converged, 'iterations:', res.iterations);
console.log('Node voltages:');
for (const [n,v] of Object.entries(res.nodeVoltages)) {
  console.log(`  ${n}: ${v.toFixed(4)} V`);
}

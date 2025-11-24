import React from 'react';

export default function Palette({ onAdd }: { onAdd: (t:string) => void }) {
  return (
    <div style={{padding:10}}>
      <h3>Palette</h3>
      <button onClick={() => onAdd('GENERATEUR')}>Générateur</button>
      <button onClick={() => onAdd('RESISTOR')}>Resistor</button>
      <button onClick={() => onAdd('LED')}>LED</button>
      <button onClick={() => onAdd('LM339')}>LM339</button>
      <button onClick={() => onAdd('SWITCH')}>Interrupteur</button>
      <button onClick={() => onAdd('HC08')}>HC08 (AND)</button>
      <button onClick={() => onAdd('HC04')}>HC04 (NOT)</button>
    </div>
  );
}

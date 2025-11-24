import React, { useState, useEffect, useRef } from 'react';
import CanvasView from './CanvasView';
import Palette from './Palette';
import Inspector from './Inspector';
import { buildNetlist } from '../netlist';
import { Solver } from '../solver';
import { Generateur, Resistor, LM339, LED, SwitchComp, HC08, HC04 } from '../components';
import { saveToLocalStorage, loadFromLocalStorage, downloadCircuit, importCircuit } from '../utils/circuitStorage';

export default function App() {
  const [components, setComponents] = useState<any[]>([]);
  const [wires, setWires] = useState<[any,any][]>([]);
  const [result, setResult] = useState<any | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const isInitialLoad = useRef(true);

  // Charger depuis localStorage au démarrage
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      const saved = loadFromLocalStorage();
      if (saved) {
        // Initialiser la couleur pour les LED qui n'en ont pas
        saved.components.forEach((cmp: any) => {
          if (cmp.type === 'LED' && !cmp.color) {
            cmp.color = '#ff0000';
          }
        });
        setComponents(saved.components);
        setWires(saved.wires);
      }
    }
  }, []);

  // Sauvegarder automatiquement dans localStorage quand le circuit change
  useEffect(() => {
    if (!isInitialLoad.current) {
      saveToLocalStorage(components, wires);
      setSavedIndicator(true);
      const timer = setTimeout(() => setSavedIndicator(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [components, wires]);

  const addComponent = (type: string) => {
    const id = `${type}_${Date.now().toString(36).slice(-4)}`;
    let cmp;
    if (type === 'GENERATEUR' || type === 'V_SOURCE') cmp = new Generateur(id, 5, 'PLUS', 'GND', null);
    else if (type === 'RESISTOR') cmp = new Resistor(id, 1000, 'A', 'B');
    else if (type === 'LM339') cmp = new LM339(id);
    else if (type === 'LED') cmp = new LED(id, 2.0, 20, '#ff0000');
    else if (type === 'SWITCH') cmp = new SwitchComp(id, false);
    else if (type === 'HC08') cmp = new HC08(id, 5);
    else if (type === 'HC04') cmp = new HC04(id, 5);
    else return;
    
    // Initialiser la position directement pour que le composant soit visible
    // Positionner dans la zone visible du SVG (qui fait 500px de haut)
    const existingCount = components.length;
    const maxY = 400; // Limite pour rester visible dans le SVG de 500px
    const yPos = Math.min(150 + Math.floor(existingCount / 3) * 120, maxY);
    cmp.position = { 
      x: 200 + (existingCount % 3) * 200, 
      y: yPos
    };
    
    setComponents(prev => [...prev, cmp]);
    // Sélectionner automatiquement le nouveau composant
    setSelectedComponent(cmp);
  };

  const handleExport = () => {
    downloadCircuit(components, wires, `circuit-${Date.now()}.json`);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const json = event.target.result;
        const imported = importCircuit(json);
        if (imported) {
          setComponents(imported.components);
          setWires(imported.wires);
          setResult(null);
          alert('Circuit importé avec succès !');
        } else {
          alert('Erreur lors de l\'import du circuit. Vérifiez le format du fichier.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClear = () => {
    if (confirm('Êtes-vous sûr de vouloir effacer le circuit ?')) {
      setComponents([]);
      setWires([]);
      setResult(null);
      localStorage.removeItem('ectronics-simulator-circuit');
    }
  };

  const runSim = () => {
    const { components: comps } = buildNetlist(components, wires);
    // buildNetlist modifie les composants en place, donc on force une mise à jour du state
    setComponents([...comps]);
    const solver = new Solver(comps as any);
    const r = solver.solve(100, 1e-3);
    setResult(r);
  };

  return (
    <div className="app">
      <div className="left">
        <Palette onAdd={addComponent} />
        {savedIndicator && (
          <div style={{
            marginTop: 10,
            padding: 8,
            backgroundColor: '#4CAF50',
            color: 'white',
            borderRadius: 4,
            fontSize: 12,
            textAlign: 'center'
          }}>
            ✓ Sauvegardé automatiquement
          </div>
        )}
      </div>
      <div className="center">
        <CanvasView 
          components={components} 
          wires={wires} 
          setWires={setWires} 
          setComponents={setComponents}
          selectedComponent={selectedComponent}
          setSelectedComponent={setSelectedComponent}
          result={result}
        />
        <div style={{marginTop:10, display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={runSim}>Run Simulation</button>
          <button onClick={handleExport} style={{backgroundColor:'#4CAF50', color:'white'}}>
            📥 Exporter
          </button>
          <button onClick={handleImport} style={{backgroundColor:'#2196F3', color:'white'}}>
            📤 Importer
          </button>
          <button onClick={handleClear} style={{backgroundColor:'#f44336', color:'white'}}>
            🗑️ Effacer
          </button>
        </div>
        {result && (
          <div style={{marginTop:10}}>
            <strong>Converged:</strong> {String(result.converged)} — iterations: {result.iterations}
            <pre style={{maxHeight:200, overflow:'auto'}}>{JSON.stringify(result.nodeVoltages, null, 2)}</pre>
          </div>
        )}
      </div>
      <div className="right">
        <Inspector 
          components={components} 
          selectedComponent={selectedComponent}
          setSelectedComponent={setSelectedComponent}
          setComponents={setComponents}
          wires={wires}
          setWires={setWires}
          result={result}
        />
      </div>
    </div>
  );
}

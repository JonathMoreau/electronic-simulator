// src/utils/circuitStorage.ts
import { Generateur, Resistor, LM339, LED, SwitchComp, HC08, HC04 } from '../components';
import { Pin } from '../models';

export interface CircuitData {
  version: string;
  components: Array<{
    type: string;
    id: string;
    properties: Record<string, any>;
    position?: { x: number; y: number };
  }>;
  wires: Array<[string, string]>; // [pinId1, pinId2]
}

const STORAGE_KEY = 'ectronics-simulator-circuit';
const CURRENT_VERSION = '1.0';

/**
 * Sérialise un circuit pour l'export
 */
export function serializeCircuit(components: any[], wires: [any, any][]): CircuitData {
  const serializedComponents = components.map(cmp => {
    const data: any = {
      type: cmp.type,
      id: cmp.id,
      properties: {}
    };

    // Extraire les propriétés spécifiques selon le type
    switch (cmp.type) {
      case 'GENERATEUR':
      case 'V_SOURCE': // Compatibilité avec anciens circuits
        data.properties = { voltage: cmp.voltage, plus: cmp.pins[0].name, minus: cmp.pins[1].name, maxCurrent: cmp.maxCurrent ?? null };
        break;
      case 'RESISTOR':
        data.properties = { rOhm: cmp.rOhm, a: cmp.pins[0].name, b: cmp.pins[1].name };
        break;
      case 'LED':
        data.properties = { vf: cmp.vf, rSeries: cmp.rSeries, color: cmp.color || '#ff0000' };
        break;
      case 'LM339':
        data.properties = {};
        break;
      case 'SWITCH':
        data.properties = { closed: cmp.closed };
        break;
      case 'HC08':
        data.properties = { vcc: cmp.vcc || 5 };
        break;
      case 'HC04':
        data.properties = { vcc: (cmp as HC04).vcc || 5 };
        break;
      default:
        // Pour les autres types, essayer de copier les propriétés publiques
        Object.keys(cmp).forEach(key => {
          if (key !== 'id' && key !== 'type' && key !== 'pins' && key !== 'position') {
            data.properties[key] = (cmp as any)[key];
          }
        });
    }

    // Sauvegarder la position si elle existe
    if (cmp.position) {
      data.position = cmp.position;
    }

    return data;
  });

  // Sérialiser les connexions en utilisant les IDs des pins
  const serializedWires: [string, string][] = wires.map(([pin1, pin2]) => [pin1.id, pin2.id]);

  return {
    version: CURRENT_VERSION,
    components: serializedComponents,
    wires: serializedWires
  };
}

/**
 * Désérialise un circuit depuis un export
 */
export function deserializeCircuit(data: CircuitData): { components: any[]; wires: [any, any][] } {
  const components: any[] = [];
  const wireMap = new Map<string, Pin>(); // pinId -> Pin

  // Recréer les composants
  data.components.forEach(compData => {
    let cmp: any;

    switch (compData.type) {
      case 'GENERATEUR':
      case 'V_SOURCE': // Compatibilité avec anciens circuits
        cmp = new Generateur(
          compData.id,
          compData.properties.voltage || 5,
          compData.properties.plus || 'PLUS',
          compData.properties.minus || 'GND',
          compData.properties.maxCurrent ?? null
        );
        break;
      case 'RESISTOR':
        cmp = new Resistor(
          compData.id,
          compData.properties.rOhm || 1000,
          compData.properties.a || 'A',
          compData.properties.b || 'B'
        );
        break;
      case 'LED':
        cmp = new LED(
          compData.id,
          compData.properties.vf || 2.0,
          compData.properties.rSeries || 20,
          compData.properties.color || '#ff0000'
        );
        // S'assurer que la couleur est définie même si elle n'était pas dans les propriétés
        if (!cmp.color) {
          cmp.color = '#ff0000';
        }
        break;
      case 'LM339':
        cmp = new LM339(compData.id);
        break;
      case 'SWITCH':
        cmp = new SwitchComp(
          compData.id,
          compData.properties.closed ?? false
        );
        break;
      case 'HC08':
        cmp = new HC08(
          compData.id,
          compData.properties.vcc || 5
        );
        break;
      case 'HC04':
        cmp = new HC04(
          compData.id,
          compData.properties.vcc || 5
        );
        break;
      default:
        console.warn(`Type de composant inconnu: ${compData.type}`);
        return;
    }

    // Restaurer la position si elle existe
    if (compData.position) {
      cmp.position = compData.position;
    }

    // Indexer les pins pour la reconstruction des connexions
    cmp.pins.forEach((pin: Pin) => {
      wireMap.set(pin.id, pin);
    });

    components.push(cmp);
  });

  // Reconstruire les connexions
  const wires: [any, any][] = [];
  data.wires.forEach(([pinId1, pinId2]) => {
    const pin1 = wireMap.get(pinId1);
    const pin2 = wireMap.get(pinId2);
    if (pin1 && pin2) {
      wires.push([pin1, pin2]);
    } else {
      console.warn(`Pin non trouvé pour la connexion: ${pinId1} ↔ ${pinId2}`);
    }
  });

  return { components, wires };
}

/**
 * Sauvegarde le circuit dans le localStorage
 */
export function saveToLocalStorage(components: any[], wires: [any, any][]): void {
  try {
    const data = serializeCircuit(components, wires);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde dans localStorage:', error);
  }
}

/**
 * Charge le circuit depuis le localStorage
 */
export function loadFromLocalStorage(): { components: any[]; wires: [any, any][] } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as CircuitData;
    return deserializeCircuit(data);
  } catch (error) {
    console.error('Erreur lors du chargement depuis localStorage:', error);
    return null;
  }
}

/**
 * Exporte le circuit en JSON pour téléchargement
 */
export function exportCircuit(components: any[], wires: [any, any][]): string {
  const data = serializeCircuit(components, wires);
  return JSON.stringify(data, null, 2);
}

/**
 * Importe un circuit depuis un JSON
 */
export function importCircuit(jsonString: string): { components: any[]; wires: [any, any][] } | null {
  try {
    const data = JSON.parse(jsonString) as CircuitData;
    return deserializeCircuit(data);
  } catch (error) {
    console.error('Erreur lors de l\'import du circuit:', error);
    return null;
  }
}

/**
 * Télécharge le circuit en tant que fichier JSON
 */
export function downloadCircuit(components: any[], wires: [any, any][], filename: string = 'circuit.json'): void {
  const json = exportCircuit(components, wires);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


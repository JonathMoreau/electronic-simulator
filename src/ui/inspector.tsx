import React, { useState, useEffect } from 'react';

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, '');
}

function formatResistanceValue(rOhm: number): string {
  if (rOhm >= 1e6) return `${trimTrailingZeros((rOhm / 1e6).toFixed(3))} MΩ`;
  if (rOhm >= 1e3) return `${trimTrailingZeros((rOhm / 1e3).toFixed(3))} kΩ`;
  const decimals = rOhm >= 10 ? 1 : 2;
  return `${trimTrailingZeros(rOhm.toFixed(decimals))} Ω`;
}

type ColorBand = { label: string; hex: string };

const DIGIT_COLORS: ColorBand[] = [
  { label: 'Noir (0)', hex: '#000000' },
  { label: 'Marron (1)', hex: '#5D4037' },
  { label: 'Rouge (2)', hex: '#C62828' },
  { label: 'Orange (3)', hex: '#EF6C00' },
  { label: 'Jaune (4)', hex: '#FBC02D' },
  { label: 'Vert (5)', hex: '#2E7D32' },
  { label: 'Bleu (6)', hex: '#1565C0' },
  { label: 'Violet (7)', hex: '#6A1B9A' },
  { label: 'Gris (8)', hex: '#616161' },
  { label: 'Blanc (9)', hex: '#F5F5F5' }
];

const MULTIPLIER_COLORS: Record<number, ColorBand> = {
  [-2]: { label: 'Argent (×10⁻²)', hex: '#BDBDBD' },
  [-1]: { label: 'Or (×10⁻¹)', hex: '#D4AF37' },
  0: { label: 'Noir (×10⁰)', hex: '#000000' },
  1: { label: 'Marron (×10¹)', hex: '#5D4037' },
  2: { label: 'Rouge (×10²)', hex: '#C62828' },
  3: { label: 'Orange (×10³)', hex: '#EF6C00' },
  4: { label: 'Jaune (×10⁴)', hex: '#FBC02D' },
  5: { label: 'Vert (×10⁵)', hex: '#2E7D32' },
  6: { label: 'Bleu (×10⁶)', hex: '#1565C0' },
  7: { label: 'Violet (×10⁷)', hex: '#6A1B9A' },
  8: { label: 'Gris (×10⁸)', hex: '#616161' },
  9: { label: 'Blanc (×10⁹)', hex: '#F5F5F5' }
};

const TOLERANCE_BAND_1P: ColorBand = { label: 'Marron (±1%)', hex: '#5D4037' };

const RESISTOR_STOCK: number[] = [
  1,
  2.2,
  3.3,
  10,
  22,
  47,
  68,
  100,
  120,
  150,
  220,
  330,
  470,
  560,
  1000,
  2000,
  2200,
  4700,
  5600,
  10000,
  22000,
  47000,
  100000,
  1000000
];

const RESISTOR_STOCK_SET = new Set(RESISTOR_STOCK);

function isValueInStock(value: number): boolean {
  if (!isFinite(value)) return false;
  if (RESISTOR_STOCK_SET.has(value)) return true;
  // Tolérance numérique très serrée pour les flottants (ex: 2.2000000001)
  return RESISTOR_STOCK.some((stockValue) => Math.abs(stockValue - value) <= Math.max(1e-6, stockValue * 1e-6));
}

type ResistorSuggestion = {
  value: number;
  parts: number[];
  mode: 'single' | 'series' | 'parallel';
  errorPct: number;
};

const SUGGESTION_LABELS: Record<ResistorSuggestion['mode'], string> = {
  single: 'Résistance unique',
  series: 'Deux en série',
  parallel: 'Deux en parallèle'
};

function formatParts(parts: number[], mode: ResistorSuggestion['mode']): string {
  if (mode === 'single') return formatResistanceValue(parts[0]);
  const separator = mode === 'series' ? ' + ' : ' ∥ ';
  return parts.map((p) => formatResistanceValue(p)).join(separator);
}

function buildSuggestion(value: number, parts: number[], mode: ResistorSuggestion['mode'], target: number): ResistorSuggestion {
  const errorPct = Math.abs(value - target) / target * 100;
  return { value, parts, mode, errorPct };
}

function getResistorSuggestions(target: number): ResistorSuggestion[] {
  if (!isFinite(target) || target <= 0) return [];
  const suggestions: ResistorSuggestion[] = [];

  // Singles
  let bestSingle: ResistorSuggestion | null = null;
  for (const r of RESISTOR_STOCK) {
    const candidate = buildSuggestion(r, [r], 'single', target);
    if (!bestSingle || candidate.errorPct < bestSingle.errorPct) {
      bestSingle = candidate;
    }
  }
  if (bestSingle) suggestions.push(bestSingle);

  // Series & parallel combinations of two resistors (allow same value twice)
  let bestSeries: ResistorSuggestion | null = null;
  let bestParallel: ResistorSuggestion | null = null;
  for (let i = 0; i < RESISTOR_STOCK.length; i++) {
    for (let j = i; j < RESISTOR_STOCK.length; j++) {
      const r1 = RESISTOR_STOCK[i];
      const r2 = RESISTOR_STOCK[j];
      const seriesValue = r1 + r2;
      const parallelValue = (r1 * r2) / (r1 + r2);

      const seriesSuggestion = buildSuggestion(seriesValue, [r1, r2], 'series', target);
      if (!bestSeries || seriesSuggestion.errorPct < bestSeries.errorPct) {
        bestSeries = seriesSuggestion;
      }

      const parallelSuggestion = buildSuggestion(parallelValue, [r1, r2], 'parallel', target);
      if (!bestParallel || parallelSuggestion.errorPct < bestParallel.errorPct) {
        bestParallel = parallelSuggestion;
      }
    }
  }

  if (bestSeries) suggestions.push(bestSeries);
  if (bestParallel) suggestions.push(bestParallel);

  return suggestions
    .filter((s, idx, arr) => arr.findIndex((o) => o.mode === s.mode) === idx)
    .sort((a, b) => a.errorPct - b.errorPct)
    .slice(0, 3);
}

function computeColorBands(valueOhm: number) {
  if (!isFinite(valueOhm) || valueOhm <= 0) return null;
  const exponent = Math.floor(Math.log10(valueOhm));
  const normalized = valueOhm / Math.pow(10, exponent);
  let firstThree = Math.round(normalized * 100);
  let multiplierExponent = exponent - 2;

  if (firstThree >= 1000) {
    firstThree = Math.round(firstThree / 10);
    multiplierExponent += 1;
  }

  const firstDigit = Math.floor(firstThree / 100);
  const secondDigit = Math.floor((firstThree % 100) / 10);
  const thirdDigit = firstThree % 10;
  const multiplierBand = MULTIPLIER_COLORS[multiplierExponent];

  if (
    firstDigit < 0 ||
    firstDigit > 9 ||
    secondDigit < 0 ||
    secondDigit > 9 ||
    thirdDigit < 0 ||
    thirdDigit > 9 ||
    !multiplierBand
  ) {
    return null;
  }

  return {
    bands: [
      DIGIT_COLORS[firstDigit],
      DIGIT_COLORS[secondDigit],
      DIGIT_COLORS[thirdDigit],
      multiplierBand,
      TOLERANCE_BAND_1P
    ]
  };
}

export default function Inspector({ components, selectedComponent, setSelectedComponent, setComponents, wires, setWires, result }: any) {
  const [localValue, setLocalValue] = useState<string>('');
  const isResistorSelected = selectedComponent?.type === 'RESISTOR' && 'rOhm' in selectedComponent;
  const resistorColorInfo = isResistorSelected ? computeColorBands(selectedComponent.rOhm) : null;
  const resistorInStock = isResistorSelected ? isValueInStock(selectedComponent.rOhm) : false;
  const resistorSuggestions = isResistorSelected ? getResistorSuggestions(selectedComponent.rOhm) : [];

  useEffect(() => {
    if (selectedComponent?.type === 'RESISTOR' && 'rOhm' in selectedComponent) {
      setLocalValue(selectedComponent.rOhm.toString());
    } else if ((selectedComponent?.type === 'GENERATEUR' || selectedComponent?.type === 'V_SOURCE') && 'voltage' in selectedComponent) {
      setLocalValue(selectedComponent.voltage.toString());
    } else if (selectedComponent?.type === 'LED' && 'vf' in selectedComponent) {
      setLocalValue(selectedComponent.vf.toString());
    } else {
      setLocalValue('');
    }
  }, [selectedComponent]);

  const updateComponent = (newValue: number) => {
    if (!selectedComponent) return;
    
    setComponents((prev: any[]) => 
      prev.map((c: any) => {
        if (c.id === selectedComponent.id) {
          if (c.type === 'RESISTOR' && 'rOhm' in c) {
            c.rOhm = newValue;
          } else if ((c.type === 'GENERATEUR' || c.type === 'V_SOURCE') && 'voltage' in c) {
            c.voltage = newValue;
          } else if (c.type === 'LED' && 'vf' in c) {
            c.vf = newValue;
          }
          return c;
        }
        return c;
      })
    );
    
    // Update selected component reference
    if (selectedComponent.type === 'RESISTOR') {
      selectedComponent.rOhm = newValue;
    } else if (selectedComponent.type === 'V_SOURCE') {
      selectedComponent.voltage = newValue;
    } else if (selectedComponent.type === 'LED') {
      selectedComponent.vf = newValue;
    }
    setSelectedComponent({ ...selectedComponent });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleValueSubmit = () => {
    const numValue = parseFloat(localValue);
    if (!isNaN(numValue) && numValue > 0) {
      updateComponent(numValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleValueSubmit();
    }
  };

  return (
    <div style={{padding:10}}>
      <h3>Inspector</h3>
      <div>Components: {components.length}</div>
      
      {selectedComponent ? (
        <div style={{marginTop: 15, padding: 10, border: '1px solid #ccc', borderRadius: 4}}>
          <div style={{fontWeight: 700, marginBottom: 8}}>
            {selectedComponent.type} — {selectedComponent.id}
          </div>
          
          {/* Affichage des mesures (tension et courant) */}
          {result?.nodeVoltages && (() => {
            const pins = selectedComponent.pins || [];
            let voltage: number | null = null;
            let current: number | null = null;
            
            if (pins.length >= 2) {
              const node1 = pins[0].node;
              const node2 = pins[1].node;
              if (node1 && node2) {
                const v1 = result.nodeVoltages[node1] ?? 0;
                const v2 = result.nodeVoltages[node2] ?? 0;
                voltage = v1 - v2;
                
                // Calculer le courant selon le type de composant
                if (selectedComponent.type === 'RESISTOR' && selectedComponent.rOhm && selectedComponent.rOhm > 0) {
                  current = voltage / selectedComponent.rOhm;
                } else if (selectedComponent.type === 'GENERATEUR' || selectedComponent.type === 'V_SOURCE') {
                  current = result.voltageSourceCurrents?.[selectedComponent.id] ?? null;
                } else if (selectedComponent.type === 'LED') {
                  // Vérifier si la LED est allumée en comparant la tension différentielle avec Vf
                  const vf = selectedComponent.vf || 2.0;
                  if (voltage >= vf && selectedComponent.rSeries && selectedComponent.rSeries > 0) {
                    // Le courant réel dans une LED dépend de la résistance totale du circuit
                    // On cherche une résistance connectée en série avec la LED pour calculer le courant réel
                    // Sinon, on utilise une approximation avec la résistance interne seule
                    let calculatedCurrent: number | null = null;
                    
                    // Chercher une résistance connectée à la cathode de la LED
                    const cathodeNode = pins.find((p: any) => p.name === 'K')?.node;
                    if (cathodeNode && result.nodeVoltages) {
                      // Chercher une résistance connectée à ce nœud
                      const connectedResistor = components.find((c: any) => {
                        if (c.type !== 'RESISTOR') return false;
                        const resistorPins = c.pins || [];
                        return resistorPins.some((p: any) => p.node === cathodeNode);
                      });
                      
                      if (connectedResistor && connectedResistor.rOhm) {
                        // Calculer le courant via la résistance externe
                        const resistorPins = connectedResistor.pins || [];
                        const resistorNode1 = resistorPins[0]?.node;
                        const resistorNode2 = resistorPins[1]?.node;
                        if (resistorNode1 && resistorNode2 && result.nodeVoltages[resistorNode1] !== undefined && result.nodeVoltages[resistorNode2] !== undefined) {
                          const resistorVoltage = Math.abs(result.nodeVoltages[resistorNode1] - result.nodeVoltages[resistorNode2]);
                          calculatedCurrent = resistorVoltage / connectedResistor.rOhm;
                        }
                      }
                    }
                    
                    // Si on a trouvé un courant via une résistance externe, l'utiliser
                    // Sinon, utiliser une approximation avec la résistance interne
                    if (calculatedCurrent !== null && calculatedCurrent > 0) {
                      current = calculatedCurrent;
                    } else {
                      // Approximation : utiliser la tension totale divisée par rSeries
                      const conductance = 1.0 / selectedComponent.rSeries;
                      current = voltage * conductance;
                    }
                  } else {
                    current = 0;
                  }
                } else if (selectedComponent.type === 'SWITCH') {
                  current = selectedComponent.closed ? null : 0; // null si fermé (court-circuit)
                }
              }
            }
            
            const formatCurrent = (i: number): string => {
              const absI = Math.abs(i);
              if (absI >= 1) return `${i.toFixed(3)} A`;
              if (absI >= 1e-3) return `${(i * 1e3).toFixed(2)} mA`;
              if (absI >= 1e-6) return `${(i * 1e6).toFixed(2)} µA`;
              return `${(i * 1e9).toFixed(2)} nA`;
            };
            
            return (
              <div style={{marginTop: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4}}>
                <div style={{fontSize: 11, fontWeight: 600, marginBottom: 4}}>Mesures:</div>
                {voltage !== null && (
                  <div style={{fontSize: 11, color: '#0066cc'}}>
                    Tension: <strong>{voltage.toFixed(3)} V</strong>
                  </div>
                )}
                {current !== null && (
                  <div style={{fontSize: 11, color: '#ff6600', marginTop: 2}}>
                    Courant: <strong>{formatCurrent(current)}</strong>
                  </div>
                )}
                {current === null && selectedComponent.type === 'SWITCH' && selectedComponent.closed && (
                  <div style={{fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic'}}>
                    Courant: calculé via autres composants
                  </div>
                )}
              </div>
            );
          })()}
          
          {selectedComponent.type === 'RESISTOR' && 'rOhm' in selectedComponent && (
            <div style={{marginTop: 8}}>
              <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                Résistance (Ω):
              </label>
              <div style={{display: 'flex', gap: 4}}>
                <input
                  type="number"
                  value={localValue}
                  onChange={handleValueChange}
                  onKeyPress={handleKeyPress}
                  onBlur={handleValueSubmit}
                  style={{flex: 1, padding: 4}}
                  min="0.1"
                  step="0.1"
                />
                <button onClick={handleValueSubmit} style={{padding: '4px 8px'}}>
                  ✓
                </button>
              </div>
              <div style={{fontSize: 11, color: '#666', marginTop: 4}}>
                {formatResistanceValue(selectedComponent.rOhm)}
              </div>
              <div style={{marginTop: 10, padding: 8, border: '1px solid #e0e0e0', borderRadius: 4, backgroundColor: '#fafafa'}}>
                <div style={{fontSize: 12, fontWeight: 600}}>Code couleur 5 bandes (1%, 1/2 W)</div>
                {resistorColorInfo ? (
                  <>
                    <div style={{display: 'flex', gap: 12, marginTop: 8}}>
                      {resistorColorInfo.bands.map((band, idx) => (
                        <div key={`${band.label}-${idx}`} style={{textAlign: 'center', fontSize: 10}}>
                          <div
                            style={{
                              width: 20,
                              height: 50,
                              margin: '0 auto',
                              borderRadius: 3,
                              border: '1px solid #444',
                              backgroundColor: band.hex
                            }}
                            title={band.label}
                          />
                          <div style={{marginTop: 4}}>{band.label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{marginTop: 8, fontSize: 11, color: '#E65100'}}>
                    ⚠️ Impossible de calculer le code couleur pour cette valeur.
                  </div>
                )}
                <div style={{marginTop: 8, fontSize: 11}}>
                  {resistorInStock ? (
                    <span style={{color: '#2E7D32', fontWeight: 600}}>
                      ✓ Disponible dans votre stock (1/2 W)
                    </span>
                  ) : (
                    <span style={{color: '#B71C1C', fontWeight: 600}}>
                      ⚠️ Valeur absente de votre stock personnel
                    </span>
                  )}
                </div>
                {!resistorInStock && resistorSuggestions.length > 0 && (
                  <div style={{marginTop: 10, padding: 8, border: '1px dashed #bdbdbd', borderRadius: 4, backgroundColor: '#fff'}}>
                    <div style={{fontSize: 12, fontWeight: 600}}>Alternatives proposées</div>
                    <div style={{fontSize: 11, color: '#555', marginTop: 4}}>
                      Objectif: {formatResistanceValue(selectedComponent.rOhm)}
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8}}>
                      {resistorSuggestions.map((suggestion, idx) => (
                        <div
                          key={`${suggestion.mode}-${idx}`}
                          style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            padding: 6,
                            backgroundColor: '#fdfdfd'
                          }}
                        >
                          <div style={{fontSize: 11, fontWeight: 600}}>
                            {SUGGESTION_LABELS[suggestion.mode]}
                          </div>
                          <div style={{fontSize: 11}}>
                            ≈ {formatResistanceValue(suggestion.value)} ({suggestion.errorPct.toFixed(2)}% d'écart)
                          </div>
                          {suggestion.mode !== 'single' && (
                            <div style={{fontSize: 10, color: '#555', marginTop: 2}}>
                              {formatParts(suggestion.parts, suggestion.mode)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {(selectedComponent.type === 'GENERATEUR' || selectedComponent.type === 'V_SOURCE') && 'voltage' in selectedComponent && (
            <div>
              <div style={{marginTop: 8}}>
                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                  Tension (V):
                </label>
                <div style={{display: 'flex', gap: 4}}>
                  <input
                    type="number"
                    value={localValue}
                    onChange={handleValueChange}
                    onKeyPress={handleKeyPress}
                    onBlur={handleValueSubmit}
                    style={{flex: 1, padding: 4}}
                    step="0.1"
                  />
                  <button onClick={handleValueSubmit} style={{padding: '4px 8px'}}>
                    ✓
                  </button>
                </div>
              </div>
              
              <div style={{marginTop: 8}}>
                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                  Courant maximum (A) - optionnel:
                </label>
                <div style={{display: 'flex', gap: 4}}>
                  <input
                    type="number"
                    value={selectedComponent.maxCurrent !== null ? selectedComponent.maxCurrent.toString() : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setComponents((prev: any[]) =>
                          prev.map((c: any) => {
                            if (c.id === selectedComponent.id) {
                              c.maxCurrent = null;
                              return c;
                            }
                            return c;
                          })
                        );
                        selectedComponent.maxCurrent = null;
                        setSelectedComponent({ ...selectedComponent });
                      } else {
                        const numVal = parseFloat(val);
                        if (!isNaN(numVal) && numVal > 0) {
                          setComponents((prev: any[]) =>
                            prev.map((c: any) => {
                              if (c.id === selectedComponent.id) {
                                c.maxCurrent = numVal;
                                return c;
                              }
                              return c;
                            })
                          );
                          selectedComponent.maxCurrent = numVal;
                          setSelectedComponent({ ...selectedComponent });
                        }
                      }
                    }}
                    placeholder="Illimité"
                    style={{flex: 1, padding: 4}}
                    min="0"
                    step="0.001"
                  />
                </div>
                <div style={{fontSize: 11, color: '#666', marginTop: 4}}>
                  {selectedComponent.maxCurrent !== null && selectedComponent.maxCurrent > 0
                    ? `Résistance interne: ${(selectedComponent.voltage / selectedComponent.maxCurrent).toFixed(2)} Ω`
                    : 'Source idéale (courant illimité)'}
                </div>
              </div>
            </div>
          )}
          
          {selectedComponent.type === 'LED' && 'vf' in selectedComponent && (
            <div>
              <div style={{marginTop: 8}}>
                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                  Tension de seuil Vf (V):
                </label>
                <div style={{display: 'flex', gap: 4}}>
                  <input
                    type="number"
                    value={localValue}
                    onChange={handleValueChange}
                    onKeyPress={handleKeyPress}
                    onBlur={handleValueSubmit}
                    style={{flex: 1, padding: 4}}
                    min="0.1"
                    step="0.1"
                  />
                  <button onClick={handleValueSubmit} style={{padding: '4px 8px'}}>
                    ✓
                  </button>
                </div>
              </div>
              <div style={{marginTop: 8}}>
                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                  Couleur:
                </label>
                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
                  <input
                    type="color"
                    value={selectedComponent.color || '#ff0000'}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setComponents((prev: any[]) =>
                        prev.map((c: any) => {
                          if (c.id === selectedComponent.id) {
                            c.color = newColor;
                            selectedComponent.color = newColor;
                          }
                          return c;
                        })
                      );
                      setSelectedComponent({ ...selectedComponent, color: newColor });
                    }}
                    style={{ width: 50, height: 30, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4 }}
                  />
                  <div style={{fontSize: 11, color: '#666'}}>
                    Couleurs prédéfinies:
                  </div>
                  {['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#ffffff'].map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setComponents((prev: any[]) =>
                          prev.map((c: any) => {
                            if (c.id === selectedComponent.id) {
                              c.color = color;
                              selectedComponent.color = color;
                            }
                            return c;
                          })
                        );
                        setSelectedComponent({ ...selectedComponent, color });
                      }}
                      style={{
                        width: 30,
                        height: 30,
                        backgroundColor: color,
                        border: (selectedComponent.color || '#ff0000') === color ? '3px solid #0066ff' : '1px solid #ccc',
                        borderRadius: 4,
                        cursor: 'pointer',
                        boxShadow: (selectedComponent.color || '#ff0000') === color ? '0 0 5px rgba(0,102,255,0.5)' : 'none'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {selectedComponent.type === 'SWITCH' && 'closed' in selectedComponent && (
            <div style={{marginTop: 8}}>
              <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                État de l'interrupteur:
              </label>
              <button
                onClick={() => {
                  const newClosed = !selectedComponent.closed;
                  setComponents((prev: any[]) => {
                    const updated = prev.map((c: any) => {
                      if (c.id === selectedComponent.id) {
                        // Modifier directement la propriété closed sur l'instance
                        // Cela préserve les méthodes de la classe
                        c.closed = newClosed;
                        // Mettre à jour aussi selectedComponent pour que l'UI se mette à jour immédiatement
                        selectedComponent.closed = newClosed;
                      }
                      return c;
                    });
                    // Retourner un nouveau tableau pour forcer React à détecter le changement
                    return [...updated];
                  });
                  // Forcer la mise à jour du composant sélectionné
                  setSelectedComponent({ ...selectedComponent, closed: newClosed });
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  backgroundColor: selectedComponent.closed ? '#4CAF50' : '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  width: '100%'
                }}
              >
                {selectedComponent.closed ? '● FERMÉ (ON)' : '○ OUVERT (OFF)'}
              </button>
              <div style={{fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center'}}>
                {selectedComponent.closed 
                  ? 'Court-circuit (0V entre A et B)' 
                  : 'Circuit ouvert (pas de connexion)'}
              </div>
            </div>
          )}
          
          <div style={{marginTop: 10, display: 'flex', gap: 8}}>
            <button 
              onClick={() => setSelectedComponent(null)}
              style={{padding: '4px 8px', fontSize: 11}}
            >
              Désélectionner
            </button>
            <button 
              onClick={() => {
                if (confirm(`Supprimer le composant ${selectedComponent.id} ?`)) {
                  // Supprimer le composant
                  setComponents((prev: any[]) => prev.filter((c: any) => c.id !== selectedComponent.id));
                  // Supprimer toutes les connexions liées à ce composant
                  setWires((prev: any[]) => 
                    prev.filter((w: any) => {
                      const [pin1, pin2] = w;
                      const cmp1 = components.find((c: any) => c.pins.some((p: any) => p.id === pin1.id));
                      const cmp2 = components.find((c: any) => c.pins.some((p: any) => p.id === pin2.id));
                      return cmp1?.id !== selectedComponent.id && cmp2?.id !== selectedComponent.id;
                    })
                  );
                  setSelectedComponent(null);
                }
              }}
              style={{
                padding: '4px 8px', 
                fontSize: 11, 
                backgroundColor: '#f44336', 
                color: 'white',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer'
              }}
            >
              🗑️ Supprimer
            </button>
          </div>
        </div>
      ) : (
        <div style={{marginTop: 10, fontSize: 12, color: '#666'}}>
          Cliquez sur un composant dans le canvas pour l'inspecter
        </div>
      )}
      
      <div style={{marginTop: 15}}>
        <strong>Tous les composants:</strong>
        <ul style={{fontSize: 12, marginTop: 4}}>
          {components.map((c:any) => (
            <li 
              key={c.id}
              onClick={() => setSelectedComponent(c)}
              style={{
                cursor: 'pointer',
                color: selectedComponent?.id === c.id ? '#0066ff' : 'inherit',
                fontWeight: selectedComponent?.id === c.id ? 'bold' : 'normal'
              }}
            >
              {c.id} ({c.type})
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{marginTop: 15}}>
        <strong>Connexions ({wires.length}):</strong>
        <ul style={{fontSize: 12, marginTop: 4}}>
          {wires.map((wire: any, idx: number) => {
            const [pin1, pin2] = wire;
            const cmp1 = components.find((c: any) => c.pins.some((p: any) => p.id === pin1.id));
            const cmp2 = components.find((c: any) => c.pins.some((p: any) => p.id === pin2.id));
            const label1 = cmp1 ? `${cmp1.type}_${cmp1.id}:${pin1.name}` : pin1.id;
            const label2 = cmp2 ? `${cmp2.type}_${cmp2.id}:${pin2.name}` : pin2.id;
            return (
              <li 
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 2
                }}
              >
                <span style={{fontSize: 11}}>
                  {label1} ↔ {label2}
                </span>
                <button
                  onClick={() => {
                    if (confirm('Supprimer cette connexion ?')) {
                      setWires((prev: any[]) => prev.filter((_, i) => i !== idx));
                    }
                  }}
                  style={{
                    padding: '2px 6px',
                    fontSize: 10,
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    marginLeft: 8
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
          {wires.length === 0 && (
            <li style={{fontSize: 11, color: '#666', fontStyle: 'italic'}}>
              Aucune connexion
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

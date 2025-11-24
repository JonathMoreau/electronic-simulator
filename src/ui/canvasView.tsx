import React, { useState, useRef, useEffect } from 'react';

interface ComponentPosition {
  x: number;
  y: number;
}

export default function CanvasView({ components, wires, setWires, setComponents, selectedComponent, setSelectedComponent, result }: any) {
  const [selectedPin, setSelectedPin] = useState<any | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });
  
  // Synchroniser les refs avec les états
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  
  // Dimensions de base du canvas
  const baseWidth = 1000;
  const baseHeight = 500;
  
  // Initialiser les positions des composants s'ils n'en ont pas
  useEffect(() => {
    let updated = false;
    const newComponents = components.map((c: any, idx: number) => {
      if (!c.position) {
        updated = true;
        // Ajouter la position directement à l'instance pour préserver les méthodes
        // Positionner dans la zone visible
        const maxY = 400;
        const yPos = Math.min(150 + Math.floor(idx / 3) * 120, maxY);
        c.position = { 
          x: 200 + (idx % 3) * 200, 
          y: yPos
        };
      }
      return c;
    });
    if (updated) {
      setComponents([...newComponents]);
    }
  }, [components.length]);

  // Intercepter le zoom du navigateur avec Ctrl+molette sur le conteneur SVG
  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const handleWheelCapture = (e: WheelEvent) => {
      // Si Ctrl est pressé, empêcher le zoom du navigateur et gérer le zoom nous-mêmes
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const rect = svgElement.getBoundingClientRect();
        if (!rect) return;
        
        // Utiliser les valeurs à jour via les refs
        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        
        // Point de la souris dans le SVG
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Point dans le système de coordonnées du viewBox
        const viewBoxX = (mouseX / rect.width) * (baseWidth / currentZoom) + currentPan.x;
        const viewBoxY = (mouseY / rect.height) * (baseHeight / currentZoom) + currentPan.y;
        
        // Zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.5, Math.min(3.0, currentZoom * delta));
        
        // Ajuster le pan pour zoomer vers le point de la souris
        const newPanX = viewBoxX - (mouseX / rect.width) * (baseWidth / newZoom);
        const newPanY = viewBoxY - (mouseY / rect.height) * (baseHeight / newZoom);
        
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    };

    // Utiliser capture phase pour intercepter avant le navigateur
    svgElement.addEventListener('wheel', handleWheelCapture, { passive: false, capture: true });
    
    return () => {
      svgElement.removeEventListener('wheel', handleWheelCapture, { capture: true });
    };
  }, [baseWidth, baseHeight]);

  const onPinClick = (cmp: any, pin: any, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!selectedPin) {
      setSelectedPin({ cmp, pin });
      return;
    }
    // make wire between selectedPin and current
    if (selectedPin.pin.id !== pin.id) {
      setWires((w: any) => [...w, [selectedPin.pin, pin]]);
    }
    setSelectedPin(null);
  };

  const formatResistance = (rOhm: number): string => {
    if (rOhm >= 1e6) return `${(rOhm / 1e6).toFixed(2)} MΩ`;
    if (rOhm >= 1e3) return `${(rOhm / 1e3).toFixed(2)} kΩ`;
    return `${rOhm.toFixed(0)} Ω`;
  };

  const getLEDState = (led: any): boolean | null => {
    if (!result?.nodeVoltages || led.type !== 'LED') return null;
    const anode = led.pins?.find((p: any) => p.name === 'AN');
    const cathode = led.pins?.find((p: any) => p.name === 'K');
    if (!anode?.node || !cathode?.node) return null;
    
    // Vérifier que la cathode est connectée à quelque chose
    // Si le pin de la cathode n'apparaît dans aucun wire, il n'est pas connecté
    const cathodeConnected = wires.some((wire: any) => {
      const [pin1, pin2] = wire;
      return pin1?.id === cathode.id || pin2?.id === cathode.id;
    });
    
    // Si la cathode n'est pas connectée, la LED ne peut pas être allumée
    if (!cathodeConnected) return false;
    
    // Vérifier que la cathode est connectée à GND (nœud '0') ou à un pin GND d'un composant
    const cathodeNode = cathode.node;
    
    // Vérification directe : nœud '0' ou pin GND sur le même nœud
    let isConnectedToGnd = cathodeNode === '0' || 
      components.some((c: any) => {
        return c.pins?.some((p: any) => 
          p.name?.toUpperCase() === 'GND' && p.node === cathodeNode
        );
      });
    
    // Vérifier si la cathode est connectée à une sortie de comparateur LM339 active
    // Un comparateur actif tire sa sortie vers GND (IN+ <= IN-)
    if (!isConnectedToGnd) {
      const comparatorOutput = components.find((c: any) => {
        if (c.type !== 'LM339') return false;
        const outPin = c.pins?.find((p: any) => p.name === 'OUT');
        return outPin?.node === cathodeNode;
      });
      if (comparatorOutput && result?.nodeVoltages) {
        // Vérifier si le comparateur est actif en comparant IN+ et IN-
        const inPlusPin = comparatorOutput.pins?.find((p: any) => p.name === 'IN+');
        const inMinusPin = comparatorOutput.pins?.find((p: any) => p.name === 'IN-');
        if (inPlusPin?.node && inMinusPin?.node) {
          const vInPlus = result.nodeVoltages[inPlusPin.node] ?? 0;
          const vInMinus = result.nodeVoltages[inMinusPin.node] ?? 0;
          // Si IN+ <= IN-, le comparateur est actif et tire la sortie vers GND
          if (vInPlus <= vInMinus) {
            // Le comparateur tire la sortie vers GND, donc la cathode est effectivement à GND
            isConnectedToGnd = true;
          }
        }
      }
    }
    
    // Si pas de connexion directe, vérifier les connexions indirectes via les wires et composants
    if (!isConnectedToGnd) {
      // Chercher si le nœud de la cathode est connecté à un nœud qui est GND
      // via les wires et les composants
      const visitedNodes = new Set<string>();
      const nodesToCheck = [cathodeNode];
      
      while (nodesToCheck.length > 0 && !isConnectedToGnd) {
        const currentNode = nodesToCheck.pop()!;
        if (visitedNodes.has(currentNode)) continue;
        visitedNodes.add(currentNode);
        
        // Si ce nœud est GND, on a trouvé une connexion
        if (currentNode === '0') {
          isConnectedToGnd = true;
          break;
        }
        
        // Chercher tous les pins connectés à ce nœud
        components.forEach((c: any) => {
          c.pins?.forEach((p: any) => {
            if (p.node === currentNode) {
              // Si c'est un pin GND, on est connecté à GND
              if (p.name?.toUpperCase() === 'GND') {
                isConnectedToGnd = true;
              }
              
              // Pour les composants à deux pins (résistances, etc.), 
              // les deux pins sont connectés ensemble
              // Donc si un pin est sur currentNode, l'autre pin est aussi connecté
              if (c.pins && c.pins.length >= 2) {
                c.pins.forEach((otherPin: any) => {
                  if (otherPin.id !== p.id && otherPin.node && !visitedNodes.has(otherPin.node)) {
                    nodesToCheck.push(otherPin.node);
                  }
                });
              }
              
              // Chercher aussi les wires connectés à ce pin
              wires.forEach((wire: any) => {
                const [pin1, pin2] = wire;
                if (pin1?.id === p.id || pin2?.id === p.id) {
                  const otherPin = pin1?.id === p.id ? pin2 : pin1;
                  if (otherPin?.node && !visitedNodes.has(otherPin.node)) {
                    nodesToCheck.push(otherPin.node);
                  }
                }
              });
            }
          });
        });
      }
    }
    
    // Si la cathode n'est pas connectée à GND, la LED ne peut pas être allumée
    if (!isConnectedToGnd) return false;
    
    // Vérifier que les tensions sont bien définies dans le résultat (pas flottantes)
    const vAnode = result.nodeVoltages[anode.node];
    const vCathode = result.nodeVoltages[cathode.node];
    
    // Si une des tensions n'est pas définie, la LED ne peut pas être allumée
    if (vAnode === undefined || vCathode === undefined) return false;
    
    // Vérifier que les deux nœuds sont différents (pas un court-circuit)
    if (anode.node === cathode.node) return false;
    
    // Vérifier que l'anode est alimentée
    // Si un interrupteur est connecté à l'anode, il doit être fermé
    const anodeNode = anode.node;
    const switchesConnectedToAnode = components.filter((c: any) => {
      if (c.type !== 'SWITCH') return false;
      const switchPins = c.pins || [];
      return switchPins.some((p: any) => p.node === anodeNode);
    });
    
    // Si un interrupteur est connecté à l'anode, vérifier qu'il est fermé
    if (switchesConnectedToAnode.length > 0) {
      const allSwitchesOpen = switchesConnectedToAnode.every((sw: any) => !sw.closed);
      // Si tous les interrupteurs connectés à l'anode sont ouverts, la LED ne peut pas être allumée
      if (allSwitchesOpen) return false;
    }
    
    const forwardV = vAnode - vCathode;
    const vf = led.vf ?? 2.0;
    
    // La LED s'allume seulement si la tension directe est suffisante
    return forwardV >= vf;
  };

  const getPinPosition = (cmp: any, pin: any): { x: number; y: number } => {
    const pos = cmp.position || { x: 100, y: 100 };
    const pinIndex = cmp.pins.findIndex((p: any) => p.id === pin.id);
    const totalPins = cmp.pins.length;
    
    // Positionner les pins autour du composant
    const angle = (pinIndex / totalPins) * 2 * Math.PI - Math.PI / 2; // Commencer en haut
    const radius = 40;
    return {
      x: pos.x + Math.cos(angle) * radius,
      y: pos.y + Math.sin(angle) * radius
    };
  };

  const handleMouseDown = (cmp: any, event: React.MouseEvent) => {
    // Si Shift+clic ou clic droit, on panne au lieu de déplacer le composant
    if (event.shiftKey || event.button !== 0) {
      handleMouseDownPan(event);
      return;
    }
    
    const pos = cmp.position || { x: 100, y: 100 };
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Convertir les coordonnées de l'écran vers le système de coordonnées du viewBox
    const viewBoxX = (event.clientX - rect.left) / rect.width * (baseWidth / zoom) + pan.x;
    const viewBoxY = (event.clientY - rect.top) / rect.height * (baseHeight / zoom) + pan.y;
    
    setDragging(cmp.id);
    setDragOffset({
      x: viewBoxX - pos.x,
      y: viewBoxY - pos.y
    });
    setSelectedComponent(cmp);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isPanning && !dragging) {
      handleMouseMovePan(event);
      return;
    }
    
    if (!dragging) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Convertir les coordonnées de l'écran vers le système de coordonnées du viewBox
    const viewBoxX = (event.clientX - rect.left) / rect.width * (baseWidth / zoom) + pan.x;
    const viewBoxY = (event.clientY - rect.top) / rect.height * (baseHeight / zoom) + pan.y;
    
    const newX = viewBoxX - dragOffset.x;
    const newY = viewBoxY - dragOffset.y;
    
    setComponents((prev: any[]) =>
      prev.map((c: any) => {
        if (c.id === dragging) {
          // Modifier directement l'instance pour préserver les méthodes
          c.position = { x: Math.max(50, newX), y: Math.max(50, newY) };
        }
        return c;
      })
    );
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Si Ctrl est pressé, on gère le zoom nous-mêmes
    if (e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      // Point de la souris dans le SVG
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Point dans le système de coordonnées du viewBox
      const viewBoxX = (mouseX / rect.width) * (baseWidth / zoom) + pan.x;
      const viewBoxY = (mouseY / rect.height) * (baseHeight / zoom) + pan.y;
      
      // Zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(3.0, zoom * delta));
      
      // Ajuster le pan pour zoomer vers le point de la souris
      const newPanX = viewBoxX - (mouseX / rect.width) * (baseWidth / newZoom);
      const newPanY = viewBoxY - (mouseY / rect.height) * (baseHeight / newZoom);
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
    // Si Ctrl n'est pas pressé, on laisse le comportement par défaut (scroll normal si nécessaire)
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    // Pan avec clic droit ou clic milieu, ou espace + clic
    if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanStart({ 
        x: e.clientX - pan.x * (rect.width / (baseWidth / zoom)), 
        y: e.clientY - pan.y * (rect.height / (baseHeight / zoom))
      });
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isPanning && !dragging) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const newPanX = (e.clientX - panStart.x) * (baseWidth / zoom / rect.width);
      const newPanY = (e.clientY - panStart.y) * (baseHeight / zoom / rect.height);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const handleZoomIn = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(prev => Math.min(3.0, prev * 1.2));
      return;
    }
    
    // Zoomer vers le centre de la vue
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Point central dans le système de coordonnées du viewBox
    const viewBoxCenterX = (centerX / rect.width) * (baseWidth / zoom) + pan.x;
    const viewBoxCenterY = (centerY / rect.height) * (baseHeight / zoom) + pan.y;
    
    // Nouveau zoom
    const newZoom = Math.min(3.0, zoom * 1.2);
    
    // Ajuster le pan pour zoomer vers le centre
    const newPanX = viewBoxCenterX - (centerX / rect.width) * (baseWidth / newZoom);
    const newPanY = viewBoxCenterY - (centerY / rect.height) * (baseHeight / newZoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomOut = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(prev => Math.max(0.5, prev / 1.2));
      return;
    }
    
    // Zoomer vers le centre de la vue
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Point central dans le système de coordonnées du viewBox
    const viewBoxCenterX = (centerX / rect.width) * (baseWidth / zoom) + pan.x;
    const viewBoxCenterY = (centerY / rect.height) * (baseHeight / zoom) + pan.y;
    
    // Nouveau zoom
    const newZoom = Math.max(0.5, zoom / 1.2);
    
    // Ajuster le pan pour zoomer vers le centre
    const newPanX = viewBoxCenterX - (centerX / rect.width) * (baseWidth / newZoom);
    const newPanY = viewBoxCenterY - (centerY / rect.height) * (baseHeight / newZoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToView = () => {
    // Calculer les bornes de tous les composants
    if (components.length === 0) {
      handleZoomReset();
      return;
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    components.forEach((cmp: any) => {
      const pos = cmp.position || { x: 100, y: 100 };
      minX = Math.min(minX, pos.x - 100);
      minY = Math.min(minY, pos.y - 100);
      maxX = Math.max(maxX, pos.x + 100);
      maxY = Math.max(maxY, pos.y + 100);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    const margin = 50;
    
    const scaleX = baseWidth / (width + 2 * margin);
    const scaleY = baseHeight / (height + 2 * margin);
    const newZoom = Math.min(scaleX, scaleY, 2.0);
    
    setZoom(newZoom);
    setPan({ 
      x: minX - margin - (baseWidth / newZoom - width - 2 * margin) / 2,
      y: minY - margin - (baseHeight / newZoom - height - 2 * margin) / 2
    });
  };

  // Rendu des composants SVG
  const renderComponent = (cmp: any) => {
    const pos = cmp.position || { x: 100, y: 100 };
    const isSelected = selectedComponent?.id === cmp.id;
    const isDragging = dragging === cmp.id;

    switch (cmp.type) {
      case 'GENERATEUR':
      case 'V_SOURCE': // Compatibilité
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle cx={0} cy={0} r={25} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} />
            <text x={0} y={-35} textAnchor="middle" fontSize="10" fill="#666">G</text>
            <text x={0} y={-25} textAnchor="middle" fontSize="10" fontWeight="bold">{cmp.voltage?.toFixed(1) || '5.0'}V</text>
            {cmp.maxCurrent !== null && cmp.maxCurrent > 0 && (
              <text x={0} y={-15} textAnchor="middle" fontSize="8" fill="#ff6600">
                I_max: {(cmp.maxCurrent * 1000).toFixed(0)}mA
              </text>
            )}
            <line x1={0} y1={cmp.maxCurrent !== null && cmp.maxCurrent > 0 ? -5 : -15} x2={0} y2={15} stroke="#333" strokeWidth={2} />
            <line x1={-8} y1={-8} x2={8} y2={-8} stroke="#333" strokeWidth={2} />
            <line x1={-8} y1={8} x2={8} y2={8} stroke="#333" strokeWidth={2} />
            {/* Pins */}
            {cmp.pins.map((pin: any, idx: number) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'RESISTOR':
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-30} y={-15} width={60} height={30} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={-25} textAnchor="middle" fontSize="10" fill="#666">R</text>
            <text x={0} y={5} textAnchor="middle" fontSize="9" fontWeight="bold" fill={isSelected ? '#0066ff' : '#000'}>
              {formatResistance(cmp.rOhm || 1000)}
            </text>
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'LED':
        const ledState = getLEDState(cmp);
        const isOn = ledState === true;
        const ledColor = cmp.color || '#ff0000'; // Couleur par défaut rouge
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <path
              d="M -20,-15 L 0,0 L -20,15 L -10,0 Z"
              fill={isOn ? ledColor : 'white'}
              stroke={isSelected ? '#0066ff' : '#333'}
              strokeWidth={isSelected ? 3 : 2}
            />
            {/* Lueur quand allumée */}
            {isOn && (
              <path
                d="M -20,-15 L 0,0 L -20,15 L -10,0 Z"
                fill={ledColor}
                opacity="0.3"
                filter="url(#glow)"
              />
            )}
            <line x1={0} y1={0} x2={20} y2={0} stroke="#333" strokeWidth={2} />
            <line x1={-20} y1={-15} x2={-20} y2={15} stroke="#333" strokeWidth={2} />
            <text x={0} y={-25} textAnchor="middle" fontSize="9" fill="#666">LED</text>
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'LM339':
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-30} y={-25} width={60} height={50} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={-35} textAnchor="middle" fontSize="9" fill="#666">LM339</text>
            <text x={0} y={5} textAnchor="middle" fontSize="8" fill="#999">Comparator</text>
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'SWITCH':
        const isClosed = cmp.closed ?? false;
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            {/* Corps de l'interrupteur */}
            <rect x={-25} y={-12} width={50} height={24} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={-20} textAnchor="middle" fontSize="9" fill="#666">SW</text>
            {/* Ligne de base */}
            <line x1={-20} y1={0} x2={20} y2={0} stroke="#333" strokeWidth={2} />
            {/* Contact mobile selon l'état */}
            {isClosed ? (
              // Interrupteur fermé : ligne continue
              <line x1={-20} y1={0} x2={20} y2={0} stroke="#4CAF50" strokeWidth={3} />
            ) : (
              // Interrupteur ouvert : ligne brisée
              <g>
                <line x1={-20} y1={0} x2={-5} y2={0} stroke="#f44336" strokeWidth={3} />
                <line x1={5} y1={0} x2={20} y2={0} stroke="#f44336" strokeWidth={3} />
                <circle cx={0} cy={0} r={3} fill="#f44336" />
              </g>
            )}
            {/* Indicateur d'état */}
            <text x={0} y={15} textAnchor="middle" fontSize="8" fill={isClosed ? '#4CAF50' : '#f44336'} fontWeight="bold">
              {isClosed ? 'ON' : 'OFF'}
            </text>
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'HC08':
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-30} y={-25} width={60} height={50} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={-35} textAnchor="middle" fontSize="9" fill="#666">HC08</text>
            <text x={0} y={5} textAnchor="middle" fontSize="8" fill="#999">AND</text>
            {/* Symbole AND - forme D avec côté droit arrondi */}
            <path d="M -10,-12 L -10,12 L 5,12 L 5,-12 Z" stroke="#333" strokeWidth={2} fill="none" />
            <path d="M 5,-12 Q 8,-12 8,0 Q 8,12 5,12" stroke="#333" strokeWidth={2} fill="none" />
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      case 'HC04':
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-30} y={-25} width={60} height={50} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={-35} textAnchor="middle" fontSize="9" fill="#666">HC04</text>
            <text x={0} y={5} textAnchor="middle" fontSize="8" fill="#999">NOT</text>
            {/* Symbole NOT - triangle avec cercle */}
            <path d="M -10,-12 L -10,12 L 5,0 Z" stroke="#333" strokeWidth={2} fill="none" />
            <circle cx={8} cy={0} r={3} stroke="#333" strokeWidth={2} fill="none" />
            {cmp.pins.map((pin: any) => {
              const pinPos = getPinPosition(cmp, pin);
              const isSelectedPin = selectedPin?.pin.id === pin.id;
              return (
                <g key={pin.id}>
                  <circle
                    cx={pinPos.x - pos.x}
                    cy={pinPos.y - pos.y}
                    r={4}
                    fill={isSelectedPin ? '#ff6600' : '#666'}
                    stroke="white"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onPinClick(cmp, pin, e)}
                  />
                  <text
                    x={pinPos.x - pos.x}
                    y={pinPos.y - pos.y - 8}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#666"
                  >
                    {pin.name}
                  </text>
                </g>
              );
            })}
          </g>
        );

      default:
        return (
          <g key={cmp.id} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x={-30} y={-20} width={60} height={40} fill="white" stroke={isSelected ? '#0066ff' : '#333'} strokeWidth={isSelected ? 3 : 2} rx={4} />
            <text x={0} y={0} textAnchor="middle" fontSize="10">{cmp.type}</text>
          </g>
        );
    }
  };

  // Calculer le courant dans un composant
  const calculateCurrent = (cmp: any): number | null => {
    if (!result?.nodeVoltages) return null;
    
    const pins = cmp.pins || [];
    if (pins.length < 2) return null;
    
    const node1 = pins[0].node;
    const node2 = pins[1].node;
    if (!node1 || !node2) return null;
    
    const v1 = result.nodeVoltages[node1] ?? 0;
    const v2 = result.nodeVoltages[node2] ?? 0;
    const deltaV = v1 - v2;
    
    switch (cmp.type) {
      case 'RESISTOR':
        if (cmp.rOhm && cmp.rOhm > 0) {
          return deltaV / cmp.rOhm;
        }
        return null;
        
      case 'LED':
        // Pour la LED, le courant dépend de l'état (on/off)
        // L'état est dans this.state, pas dans result
        // On peut aussi vérifier si deltaV >= vf pour déterminer si elle est allumée
        if (deltaV >= (cmp.vf || 2.0) && cmp.rSeries && cmp.rSeries > 0) {
          // LED allumée : approximer comme résistance série
          return deltaV / cmp.rSeries;
        }
        return 0; // LED éteinte = pas de courant
        
      case 'SWITCH':
        if (cmp.closed) {
          // Interrupteur fermé : court-circuit, courant peut être calculé via les autres composants
          // Pour simplifier, on retourne null et on calculera via les autres composants connectés
          return null;
        }
        return 0; // Interrupteur ouvert = pas de courant
        
      case 'GENERATEUR':
      case 'V_SOURCE': // Compatibilité
        // Le courant des générateurs est déjà dans voltageSourceCurrents
        const vsId = cmp.id;
        return result.voltageSourceCurrents?.[vsId] ?? null;
        
      default:
        return null;
    }
  };

  // Rendu des connexions
  const renderWires = () => {
    return wires.map((wire: any, idx: number) => {
      const [pin1, pin2] = wire;
      const cmp1 = components.find((c: any) => c.pins.some((p: any) => p.id === pin1.id));
      const cmp2 = components.find((c: any) => c.pins.some((p: any) => p.id === pin2.id));
      
      if (!cmp1 || !cmp2) return null;
      
      const pos1 = getPinPosition(cmp1, pin1);
      const pos2 = getPinPosition(cmp2, pin2);
      
      // Obtenir le nœud si disponible
      const node = pin1.node || pin2.node;
      const voltage = result?.nodeVoltages?.[node];
      const voltageText = voltage !== undefined ? `${voltage.toFixed(2)}V` : '';
      
      // Calculer le courant dans la connexion
      // Le courant dans un fil est déterminé par les composants connectés
      // On cherche le composant qui a ses deux pins sur cette connexion
      let current: number | null = null;
      
      // Vérifier si un des composants a ses deux pins sur cette connexion
      const cmp1HasBothPins = cmp1.pins.some((p: any) => p.id === pin1.id) && 
                              cmp1.pins.some((p: any) => p.id === pin2.id);
      const cmp2HasBothPins = cmp2.pins.some((p: any) => p.id === pin1.id) && 
                              cmp2.pins.some((p: any) => p.id === pin2.id);
      
      if (cmp1HasBothPins) {
        current = calculateCurrent(cmp1);
      } else if (cmp2HasBothPins) {
        current = calculateCurrent(cmp2);
      } else {
        // Sinon, prendre le courant du composant qui a le pin1
        current = calculateCurrent(cmp1);
        if (current === null) {
          current = calculateCurrent(cmp2);
        }
      }
      
      const formatCurrent = (i: number): string => {
        const absI = Math.abs(i);
        if (absI >= 1) return `${i.toFixed(3)}A`;
        if (absI >= 1e-3) return `${(i * 1e3).toFixed(2)}mA`;
        if (absI >= 1e-6) return `${(i * 1e6).toFixed(2)}µA`;
        return `${(i * 1e9).toFixed(2)}nA`;
      };
      
      const currentText = current !== null ? formatCurrent(current) : '';
      
      // Calculer le point milieu pour le clic
      const midX = (pos1.x + pos2.x) / 2;
      const midY = (pos1.y + pos2.y) / 2;
      
      return (
        <g key={idx}>
          {/* Ligne invisible plus large pour faciliter le clic */}
          <line
            x1={pos1.x}
            y1={pos1.y}
            x2={pos2.x}
            y2={pos2.y}
            stroke="transparent"
            strokeWidth={10}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Supprimer cette connexion ?')) {
                setWires((prev: any[]) => prev.filter((_, i) => i !== idx));
              }
            }}
          />
          {/* Ligne visible */}
          <line
            x1={pos1.x}
            y1={pos1.y}
            x2={pos2.x}
            y2={pos2.y}
            stroke="#666"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
            style={{ pointerEvents: 'none' }}
          />
          {/* Affichage tension et courant */}
          {voltageText && (
            <text
              x={midX}
              y={midY - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#0066cc"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {voltageText}
            </text>
          )}
          {currentText && (
            <text
              x={midX}
              y={midY + 8}
              textAnchor="middle"
              fontSize="9"
              fill="#ff6600"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {currentText}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: 10, minHeight: 600, position: 'relative' }}>
      <div style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Schéma du circuit</h4>
        <small style={{ color: '#666' }}>
          {selectedPin 
            ? 'Cliquez sur un autre pin pour connecter' 
            : 'Cliquez sur un pin puis sur un autre pour créer une connexion • Cliquez sur une connexion pour la supprimer'}
        </small>
      </div>
      
      <div 
        style={{ position: 'relative', overflow: 'hidden' }}
        onWheel={(e) => {
          // Empêcher le zoom du navigateur si Ctrl est pressé
          if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Contrôles de zoom */}
        <div style={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          backgroundColor: 'white',
          padding: 8,
          borderRadius: 4,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <button 
            onClick={handleZoomIn}
            style={{ padding: '4px 8px', fontSize: 14, cursor: 'pointer' }}
            title="Zoomer (molette vers le haut)"
          >
            +
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#666', padding: '2px 0' }}>
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={handleZoomOut}
            style={{ padding: '4px 8px', fontSize: 14, cursor: 'pointer' }}
            title="Dézoomer (molette vers le bas)"
          >
            −
          </button>
          <button 
            onClick={handleZoomReset}
            style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
            title="Réinitialiser le zoom"
          >
            ⟲
          </button>
          <button 
            onClick={handleFitToView}
            style={{ padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
            title="Ajuster à la vue"
          >
            ⛶
          </button>
        </div>
        
        <svg
          ref={svgRef}
          width="100%"
          height="500"
          viewBox={`${pan.x} ${pan.y} ${baseWidth / zoom} ${baseHeight / zoom}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ 
            border: '1px solid #eee', 
            backgroundColor: '#fafafa', 
            cursor: isPanning ? 'grabbing' : (dragging ? 'grabbing' : 'default'),
            overflow: 'hidden',
            touchAction: 'none', // Empêcher le zoom tactile par défaut
            display: 'block'
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()} // Désactiver le menu contextuel pour le pan
        >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="#666" />
          </marker>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Connexions */}
        {renderWires()}
        
        {/* Composants */}
        {components.map((cmp: any) => (
          <g
            key={cmp.id}
            onMouseDown={(e) => handleMouseDown(cmp, e)}
            style={{ cursor: 'grab' }}
          >
            {renderComponent(cmp)}
          </g>
        ))}
        </svg>
      </div>
      
      <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
        💡 Ctrl+Molette pour zoomer • Shift+Clic pour déplacer la vue
      </div>
      
      {selectedPin && (
        <div style={{ marginTop: 10, padding: 8, backgroundColor: '#fff3cd', borderRadius: 4 }}>
          <strong>Pin sélectionné:</strong> {selectedPin.cmp.type} - {selectedPin.pin.name}
          <button onClick={() => setSelectedPin(null)} style={{ marginLeft: 10 }}>Annuler</button>
        </div>
      )}
    </div>
  );
}

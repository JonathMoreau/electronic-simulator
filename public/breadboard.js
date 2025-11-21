// Configuration de la breadboard
const BREADBOARD_CONFIG = {
    powerRailSize: 63, // Nombre de trous dans les rails d'alimentation
    centralRows: 30,   // Nombre de rangées dans la zone centrale
    columnsPerGroup: 5, // Colonnes par groupe (A-E)
    numColumnGroups: 10 // Nombre de groupes de colonnes
};

// Note: POWER_CONFIG est défini dans index.html avant le chargement de ce script

// État de la breadboard
let breadboardState = {
    selectedHole: null,
    connections: new Map(), // Map pour stocker les connexions
    components: new Map(),   // Map pour stocker les composants (holeId -> Component)
    placedComponents: new Map(), // Map pour stocker les composants placés (componentId -> Component)
    cables: new Map(), // Map pour stocker les câbles (cableId -> Cable)
    placementMode: null, // Mode de placement actif ('generic', etc.)
    componentToPlace: null, // Composant en attente de placement
    moveMode: false, // Mode de déplacement actif
    componentToMove: null, // Composant à déplacer
    connectionMode: false, // Mode de connexion actif
    componentToConnect: null, // Composant à connecter
    pinToConnect: null // Pin du composant à connecter (optionnel)
};

// Initialisation de la breadboard
function initBreadboard() {
    const breadboard = document.getElementById('breadboard');
    if (!breadboard) {
        console.error('Élément breadboard introuvable dans le DOM');
        return;
    }
    breadboard.innerHTML = '';
    
    // Rail d'alimentation supérieur (positif)
    createPowerRail(breadboard, 'positive', 'top');
    
    // Zone centrale avec colonnes
    createCentralZone(breadboard);
    
    // Rail d'alimentation inférieur (négatif)
    createPowerRail(breadboard, 'negative', 'bottom');
    
    // Ajouter les écouteurs d'événements
    setupEventListeners();
    
    console.log('Breadboard initialisée avec succès!');

    // Charger un montage (circuit)
    // Changer cette fonction pour charger un autre montage :
    // - setupTwoLEDsInSeries() : Deux LEDs en série
    // - setupThreeLEDsInSeries() : Trois LEDs en série
    // - setupThreeSubcircuitsWithVsum() : Trois sous-circuits avec Vsum
    // - setupEmpty() : Breadboard vide
    if (typeof window.setupThreeSubcircuitsWithVsum === 'function') {
        window.setupThreeSubcircuitsWithVsum(breadboardState);
    } else {
        console.warn('Fonction setupThreeSubcircuitsWithVsum non disponible. Breadboard vide.');
    }
}

// Créer un rail d'alimentation
function createPowerRail(container, type, position) {
    const railDiv = document.createElement('div');
    railDiv.className = 'power-rail';
    
    const label = document.createElement('div');
    label.className = `power-rail-label ${type}`;
    label.textContent = position === 'top' 
        ? (type === 'positive' ? 'RAIL + (Positif)' : 'RAIL - (Négatif)')
        : (type === 'positive' ? 'RAIL + (Positif)' : 'RAIL - (Négatif)');
    railDiv.appendChild(label);
    
    const row = document.createElement('div');
    row.className = 'breadboard-row';
    
    for (let i = 0; i < BREADBOARD_CONFIG.powerRailSize; i++) {
        const hole = createHole(`power-${position}-${type}-${i}`, type);
        row.appendChild(hole);
    }
    
    railDiv.appendChild(row);
    container.appendChild(railDiv);
}

// Créer la zone centrale
function createCentralZone(container) {
    const centralZone = document.createElement('div');
    centralZone.className = 'central-zone';
    
    // Créer les groupes de colonnes
    for (let group = 0; group < BREADBOARD_CONFIG.numColumnGroups; group++) {
        const columnGroup = document.createElement('div');
        columnGroup.className = 'column-group';
        columnGroup.id = `group-${group}`;
        
        // Créer les rangées pour ce groupe
        for (let row = 0; row < BREADBOARD_CONFIG.centralRows; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'breadboard-row';
            
            // Créer les colonnes (A-E) pour cette rangée
            const columns = ['A', 'B', 'C', 'D', 'E'];
            for (let col = 0; col < BREADBOARD_CONFIG.columnsPerGroup; col++) {
                const holeId = `central-${row}-${columns[col]}-${group}`;
                const hole = createHole(holeId, 'central');
                rowDiv.appendChild(hole);
            }
            
            columnGroup.appendChild(rowDiv);
        }
        
        centralZone.appendChild(columnGroup);
        
        // Ajouter un séparateur entre les groupes (sauf après le dernier)
        if (group < BREADBOARD_CONFIG.numColumnGroups - 1) {
            const separator = document.createElement('div');
            separator.className = 'column-group-separator';
            centralZone.appendChild(separator);
        }
    }
    
    container.appendChild(centralZone);
}

// Créer un trou individuel
function createHole(id, type) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.id = id;
    hole.dataset.type = type;
    hole.dataset.holeId = id;
    
    // Tooltip avec les informations du trou
    hole.title = `Trou: ${id}\nType: ${type}`;
    
    return hole;
}

// Configurer les écouteurs d'événements
function setupEventListeners() {
    // Écouteurs pour les trous
    document.querySelectorAll('.hole').forEach(hole => {
        hole.addEventListener('click', handleHoleClick);
        // Retiré : mouseenter et mouseleave - les infos s'affichent maintenant au clic
    });
    
    // Boutons de contrôle
    document.getElementById('clearBtn').addEventListener('click', clearBreadboard);
    document.getElementById('resetBtn').addEventListener('click', resetBreadboard);
    
    // Boutons de composants
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.addEventListener('click', handleComponentButtonClick);
    });
}

// Gérer le clic sur un trou
function handleHoleClick(event) {
    event.stopPropagation(); // Empêcher la propagation de l'événement
    
    const hole = event.target;
    const holeId = hole.dataset.holeId || hole.id; // Utiliser aussi l'id si holeId n'est pas défini
    
    if (!holeId) {
        console.error('Aucun holeId trouvé pour le trou cliqué');
        return;
    }
    
    console.log('Clic sur trou:', holeId, 'Type:', hole.dataset.type, 'Mode connexion:', breadboardState.connectionMode);
    
    // Si on est en mode connexion (vérifier en premier pour permettre la connexion aux rails)
    if (breadboardState.connectionMode && breadboardState.componentToConnect) {
        console.log('Mode connexion actif, tentative de connexion...');
        connectComponentToHole(holeId);
        return;
    }
    
    // Si on est en mode déplacement
    if (breadboardState.moveMode && breadboardState.componentToMove) {
        moveComponentToHole(holeId);
        return;
    }
    
    // Si on est en mode placement de composant
    if (breadboardState.placementMode) {
        placeComponentOnHole(holeId);
        return;
    }
    
    // Vérifier si le trou a déjà un composant
    if (breadboardState.components.has(holeId)) {
        const component = breadboardState.components.get(holeId);
        
        // Si on est en mode connexion, essayer de connecter au composant
        if (breadboardState.connectionMode && breadboardState.componentToConnect) {
            connectComponentToComponent(component, holeId);
            return;
        }
        
        // Sinon, sélectionner le composant normalement
        component.select();
        return;
    }
    
    // Désélectionner le trou précédent
    if (breadboardState.selectedHole) {
        const prevHole = document.getElementById(breadboardState.selectedHole);
        if (prevHole) {
            prevHole.classList.remove('selected');
        }
    }
    
    // Si on clique sur le même trou, désélectionner
    if (breadboardState.selectedHole === holeId) {
        breadboardState.selectedHole = null;
        updateInfo('Aucun trou sélectionné');
    } else {
        // Sélectionner le nouveau trou et afficher ses informations détaillées au clic
        breadboardState.selectedHole = holeId;
        hole.classList.add('selected');
        
        // Afficher les informations détaillées du trou au clic
        let info = `Trou: ${holeId}\nType: ${hole.dataset.type}`;
        
        if (breadboardState.connections.has(holeId)) {
            info += `\nConnexions: ${breadboardState.connections.get(holeId).length}`;
        }
        
        if (breadboardState.components.has(holeId)) {
            const component = breadboardState.components.get(holeId);
            info += `\nComposant: ${component.name}`;
        }
        
        updateInfo(info);
    }
}

// Note: Les fonctions handleHoleHover et handleHoleLeave ont été supprimées
// Les informations s'affichent maintenant uniquement au clic

// Gérer le clic sur un bouton de composant
function handleComponentButtonClick(event) {
    const button = event.currentTarget;
    const componentType = button.dataset.componentType;
    
    // Activer le mode de placement
    breadboardState.placementMode = componentType;
    
    // Créer une instance du composant
    if (componentType === 'generic') {
        breadboardState.componentToPlace = new Component(
            null,
            'Composant Générique',
            {
                type: 'generic',
                pins: [],
                properties: {
                    voltage: 0,
                    current: 0
                }
            }
        );
    } else if (componentType === 'led') {
        breadboardState.componentToPlace = new LED(null, {
            color: 'red',
            voltage: 3.3,
            current: 0.02
        });
    } else if (componentType === 'resistance') {
        breadboardState.componentToPlace = new Resistance(null, {
            resistance: 1000 // 1kΩ par défaut
        });
    } else if (componentType === 'cable') {
        breadboardState.componentToPlace = new Cable(null, {
            color: '#4caf50'
        });
    }
    
    // Mettre à jour l'interface
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    updatePlacementStatus(`Mode: Placement - ${breadboardState.componentToPlace.name}`);
    updateInfo('Mode placement activé. Cliquez sur un trou de la zone centrale pour placer le composant.');
}

/**
 * Ajouter un composant à la breadboard
 * @param {Component} component - Composant à ajouter
 * @param {string} holeId - Identifiant du trou où placer le composant
 * @returns {boolean} - True si le composant a été ajouté avec succès
 */
function addComponent(component, holeId) {
    if (!component || !holeId) {
        console.error('addComponent: paramètres invalides');
        return false;
    }
    
    // Placer le composant
    const success = component.place(holeId, breadboardState);
    
    if (success) {
        // Créer l'élément DOM avec breadboardState pour les écouteurs
        component.createDOMElement(breadboardState);
        
        // Enregistrer le composant
        breadboardState.placedComponents.set(component.id, component);
        
        // Si c'est un câble, l'ajouter aussi à la liste des câbles
        if (component.type === 'cable' && breadboardState.cables) {
            breadboardState.cables.set(component.id, component);
        }
        
        return true;
    }
    
    return false;
}

// Placer un composant sur un trou
function placeComponentOnHole(holeId) {
    if (!breadboardState.componentToPlace) {
        return;
    }
    
    // Vérifier que c'est un trou de la zone centrale
    const hole = document.getElementById(holeId);
    if (!hole || hole.dataset.type !== 'central') {
        updateInfo('Les composants ne peuvent être placés que dans la zone centrale');
        return;
    }
    
    // Créer une nouvelle instance pour éviter les problèmes de référence
    const component = breadboardState.componentToPlace;
    
    // Utiliser la méthode addComponent
    const success = addComponent(component, holeId);
    
    if (success) {
        // Réinitialiser le mode de placement
        breadboardState.placementMode = null;
        breadboardState.componentToPlace = null;
        
        // Mettre à jour l'interface
        document.querySelectorAll('.component-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        updatePlacementStatus('Mode: Sélection');
        updateInfo(`Composant placé avec succès à ${holeId}`);
    } else {
        updateInfo('Impossible de placer le composant. Le trou est peut-être déjà occupé.');
    }
}

// Mettre à jour le statut de placement
function updatePlacementStatus(message) {
    const statusElement = document.getElementById('placementStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Activer le mode de déplacement pour un composant
function activateMoveMode(component) {
    // Désactiver le mode de placement s'il est actif
    breadboardState.placementMode = null;
    breadboardState.componentToPlace = null;
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activer le mode de déplacement
    breadboardState.moveMode = true;
    breadboardState.componentToMove = component;
    
    // Mettre à jour l'interface
    updatePlacementStatus(`Mode: Déplacement - ${component.name}`);
    updateInfo(`Mode déplacement activé. Cliquez sur un nouveau trou pour déplacer "${component.name}".\nAppuyez sur Échap pour annuler.`);
    
    // Ajouter un indicateur visuel au composant
    if (component.domElement) {
        component.domElement.classList.add('moving');
    }
}

// Désactiver le mode de déplacement
function deactivateMoveMode() {
    if (breadboardState.componentToMove && breadboardState.componentToMove.domElement) {
        breadboardState.componentToMove.domElement.classList.remove('moving');
    }
    
    breadboardState.moveMode = false;
    breadboardState.componentToMove = null;
    updatePlacementStatus('Mode: Sélection');
    updateInfo('Mode déplacement désactivé');
}

// Déplacer un composant vers un nouveau trou
function moveComponentToHole(newHoleId) {
    const component = breadboardState.componentToMove;
    if (!component) {
        return;
    }
    
    // Vérifier que c'est un trou de la zone centrale
    const hole = document.getElementById(newHoleId);
    if (!hole || hole.dataset.type !== 'central') {
        updateInfo('Les composants ne peuvent être déplacés que dans la zone centrale');
        return;
    }
    
    // Vérifier que le nouveau trou n'est pas déjà occupé (sauf par ce composant)
    const requiredHoles = component.getRequiredHoles(component.parseHoleId(newHoleId));
    const isOccupiedByOther = requiredHoles.some(holeId => {
        const existingComponent = breadboardState.components.get(holeId);
        return existingComponent && existingComponent.id !== component.id;
    });
    
    if (isOccupiedByOther) {
        updateInfo('Impossible de déplacer le composant. Le trou est déjà occupé par un autre composant.');
        return;
    }
    
    // Sauvegarder l'ancienne position
    const oldHoleId = component.position.holeId;
    
    // Retirer le composant de l'ancienne position (sans le supprimer complètement)
    component.position.holes.forEach(holeId => {
        breadboardState.components.delete(holeId);
        const holeElement = document.getElementById(holeId);
        if (holeElement) {
            holeElement.classList.remove('has-component');
        }
    });
    
    // Mettre à jour la position
    const newPosition = component.parseHoleId(newHoleId);
    if (!newPosition) {
        updateInfo('Erreur: Impossible de parser le nouveau trou');
        deactivateMoveMode();
        return;
    }
    
    const newRequiredHoles = component.getRequiredHoles(newPosition);
    component.position = {
        ...newPosition,
        holes: newRequiredHoles
    };
    
    // Marquer les nouveaux trous comme occupés
    newRequiredHoles.forEach(holeId => {
        breadboardState.components.set(holeId, component);
        const holeElement = document.getElementById(holeId);
        if (holeElement) {
            holeElement.classList.add('has-component');
        }
    });
    
    // Mettre à jour la position visuelle du composant
    updateComponentPosition(component);
    
    // Désactiver le mode de déplacement
    deactivateMoveMode();
    
    updateInfo(`Composant "${component.name}" déplacé de ${oldHoleId} vers ${newHoleId}`);
    console.log(`Composant ${component.name} déplacé de ${oldHoleId} vers ${newHoleId}`);
}

// Mettre à jour la position visuelle d'un composant (en tenant compte du zoom)
function updateComponentPosition(component) {
    if (!component.domElement || !component.position.holeId) {
        return;
    }
    
    const baseHole = document.getElementById(component.position.holeId);
    if (!baseHole) {
        return;
    }
    
    const breadboard = document.getElementById('breadboard');
    if (!breadboard) {
        return;
    }
    
    // Obtenir la position relative du trou dans la breadboard
    let holeX = 0;
    let holeY = 0;
    let element = baseHole;
    while (element && element !== breadboard) {
        holeX += element.offsetLeft;
        holeY += element.offsetTop;
        element = element.offsetParent;
    }
    
    // Calculer la position du composant (centré sur le trou)
    const holeWidth = baseHole.offsetWidth || 12;
    const holeHeight = baseHole.offsetHeight || 12;
    const componentSize = 30; // Taille du composant
    
    component.domElement.style.left = `${holeX + holeWidth / 2 - componentSize / 2}px`;
    component.domElement.style.top = `${holeY + holeHeight / 2 - componentSize / 2}px`;
}

// Activer le mode de connexion pour un composant
function activateConnectionMode(component) {
    // Désactiver les autres modes
    deactivateMoveMode();
    breadboardState.placementMode = null;
    breadboardState.componentToPlace = null;
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activer le mode de connexion
    breadboardState.connectionMode = true;
    breadboardState.componentToConnect = component;

    // Mettre à jour l'interface
    if (component.type === 'led') {
        updatePlacementStatus(`Mode: Connexion LED - ${component.name}`);
    }
    
    // Afficher les informations formatées avec l'interface de gestion des connexions
    // Cette méthode affiche déjà tout ce qu'il faut (U, I, listes déroulantes, etc.)
    component.displayInfoWithConnections();
}

// Désactiver le mode de connexion
function deactivateConnectionMode() {
    breadboardState.connectionMode = false;
    breadboardState.componentToConnect = null;
    updatePlacementStatus('Mode: Sélection');
    updateInfo('Mode connexion désactivé');
}

// Connecter un composant à un autre composant (fonction globale)
function connectComponentToComponent(targetComponent, holeId) {
    const sourceComponent = breadboardState.componentToConnect;
    if (!sourceComponent) {
        console.error('Aucun composant source à connecter');
        return false;
    }
    
    if (sourceComponent === targetComponent) {
        // Si on clique sur le même composant, le sélectionner et désactiver le mode connexion
        targetComponent.select();
        if (typeof activateConnectionMode === 'function') {
            activateConnectionMode(targetComponent);
        }
        return true;
    }
    
    // Pour les LEDs, déterminer automatiquement quel pin connecter
    if (sourceComponent.type === 'led' && targetComponent.type === 'led') {
        // Vérifier si on peut faire une connexion série : cathode LED1 → anode LED2
        const sourceCathodeFree = !sourceComponent.powerConnection.negative && 
                                   !sourceComponent.isPinConnected('cathode');
        const targetAnodeFree = !targetComponent.powerConnection.positive && 
                                !targetComponent.isPinConnected('anode');
        
        if (sourceCathodeFree && targetAnodeFree) {
            // Créer un câble pour la connexion série
            const cable = new Cable(null, { color: '#4caf50' });
            const sourceHole = sourceComponent.getHoleForPin('cathode');
            const targetHole = targetComponent.getHoleForPin('anode');
            
            // Placer le câble (utiliser le trou source comme position de base)
            if (sourceHole && addComponent(cable, sourceHole)) {
                // Le câble est déjà ajouté par addComponent
            }
            
            // Connexion série : cathode LED1 → anode LED2 via câble
            const success = sourceComponent.connectPinToPin('cathode', targetComponent, 'anode', holeId, cable);
            if (success) {
                updateInfo(`✅ Connexion série établie !\n${sourceComponent.name}.cathode → ${targetComponent.name}.anode\n\nConnectez maintenant:\n- ${sourceComponent.name}.anode au rail +\n- ${targetComponent.name}.cathode au rail -`);
                // Vérifier l'état électrique des deux LED
                sourceComponent.checkPowerState();
                targetComponent.checkPowerState();
                sourceComponent.updateVisualState();
                targetComponent.updateVisualState();
                // Ne pas désactiver le mode connexion, permettre de continuer
                // Le composant cible devient le nouveau composant à connecter
                breadboardState.componentToConnect = targetComponent;
                breadboardState.pinToConnect = null;
                // Mettre à jour l'interface pour le nouveau composant
                activateConnectionMode(targetComponent);
                return true;
            } else {
                updateInfo(`❌ Échec de la connexion série.\nVérifiez que les pins sont disponibles.\n\n💡 Cliquez à nouveau sur ${targetComponent.name} pour la sélectionner.`);
                return false;
            }
        } else {
            // Expliquer pourquoi la connexion n'est pas possible
            let reason = '';
            if (!sourceCathodeFree) {
                reason += `\n- ${sourceComponent.name}.cathode est déjà connectée`;
            }
            if (!targetAnodeFree) {
                reason += `\n- ${targetComponent.name}.anode est déjà connectée`;
            }
            updateInfo(`⚠️ Connexion série impossible:${reason}\n\nPour connecter en série:\n1. ${sourceComponent.name}.anode → rail +\n2. ${sourceComponent.name}.cathode → ${targetComponent.name}.anode\n3. ${targetComponent.name}.cathode → rail -\n\n💡 Astuce: Cliquez à nouveau sur ${targetComponent.name} pour la sélectionner et continuer le branchement.`);
            // Retourner false pour permettre la sélection du composant
            return false;
        }
    }
    
    // Connexion générique : utiliser le système de pins
    // Si un pin spécifique est sélectionné, l'utiliser
    if (breadboardState.pinToConnect) {
        // Trouver un pin compatible sur le composant cible
        const targetPins = targetComponent.pins.filter(p => 
            p.type !== sourceComponent.pins.find(sp => sp.id === breadboardState.pinToConnect)?.type
        );
        
        if (targetPins.length > 0) {
            const targetPin = targetPins[0]; // Prendre le premier pin compatible
            
            // Créer un câble pour la connexion
            const cable = new Cable(null, { color: '#4caf50' });
            const sourceHole = sourceComponent.getHoleForPin(breadboardState.pinToConnect);
            const targetHole = targetComponent.getHoleForPin(targetPin.id);
            
            // Placer le câble
            if (sourceHole && addComponent(cable, sourceHole)) {
                // Le câble est déjà ajouté par addComponent
            }
            
            const success = sourceComponent.connectPinToPin(
                breadboardState.pinToConnect,
                targetComponent,
                targetPin.id,
                holeId,
                cable
            );
            if (success) {
                updateInfo(`✅ Connexion établie !\n${sourceComponent.name}.${breadboardState.pinToConnect} → ${targetComponent.name}.${targetPin.id}`);
                sourceComponent.updateVisualState();
                targetComponent.updateVisualState();
                deactivateConnectionMode();
                return;
            }
        }
    }
    
    // Si aucune connexion n'a pu être établie, permettre de sélectionner le composant cible
    updateInfo(`⚠️ Connexion non supportée entre ${sourceComponent.name} et ${targetComponent.name}\n\n💡 Cliquez à nouveau sur ${targetComponent.name} pour la sélectionner et continuer le branchement.`);
    return false;
}

// Connecter un composant à un trou (rail d'alimentation ou autre composant)
function connectComponentToHole(holeId) {
    const component = breadboardState.componentToConnect;
    if (!component) {
        console.error('Aucun composant à connecter');
        return;
    }
    
    const hole = document.getElementById(holeId);
    if (!hole) {
        console.error(`Trou introuvable: ${holeId}`);
        return;
    }
    
    const holeType = hole.dataset.type;
    console.log(`Tentative de connexion au trou ${holeId}, type: ${holeType}`);
    
    // Vérifier si c'est un rail d'alimentation
    if (holeType === 'positive') {
        console.log('Rail positif détecté');
        // Connecter l'anode de la LED au rail positif
        if (component.type === 'led') {
            console.log('LED détectée, connexion de l\'anode...');
            // Vérifier que la LED a bien une anode
            if (!component.anode) {
                console.error('LED sans anode définie');
                updateInfo('Erreur: La LED n\'a pas d\'anode définie');
                return;
            }
            
            // Connecter l'anode au rail positif
            component.connectAnodeToPositive(holeId);
            console.log('Anode connectée à:', holeId);
            
            // Mettre à jour visuellement le rail
            const railHole = document.getElementById(holeId);
            if (railHole) {
                railHole.classList.add('connected-to-component');
                railHole.classList.add('power-connected');
            }
            
            // Vérifier l'état électrique (peut allumer la LED si cathode déjà connectée)
            component.checkPowerState();
            // Mettre à jour visuellement la LED
            component.updateVisualState();
            
            const railMatch = holeId.match(/power-(top|bottom)-positive-(\d+)/);
            const railIndex = railMatch ? parseInt(railMatch[2], 10) : '?';
            updateInfo(`✅ Anode de la LED connectée au rail + (trou ${railIndex})\nConnectez maintenant la cathode au rail -`);
            
            // Ne pas désactiver le mode connexion, attendre la connexion de la cathode
            return;
        } else {
            console.log('Composant non-LED sur rail positif, ignoré');
        }
    } else if (holeType === 'negative') {
        console.log('Rail négatif détecté');
        // Connecter la cathode de la LED au rail négatif
        if (component.type === 'led') {
            // Vérifier que la LED a bien une cathode
            if (!component.cathode) {
                updateInfo('Erreur: La LED n\'a pas de cathode définie');
                return;
            }
            
            // Connecter la cathode au rail négatif
            component.connectCathodeToNegative(holeId);
            
            // Mettre à jour visuellement le rail
            const railHole = document.getElementById(holeId);
            if (railHole) {
                railHole.classList.add('connected-to-component');
                railHole.classList.add('power-connected');
            }
            
            // Vérifier l'état électrique (va allumer la LED si les deux connexions sont faites)
            component.checkPowerState();
            // Mettre à jour visuellement la LED
            component.updateVisualState();
            
            const railMatch = holeId.match(/power-(top|bottom)-negative-(\d+)/);
            const railIndex = railMatch ? parseInt(railMatch[2], 10) : '?';
            
            // Vérifier si la LED est maintenant allumée
            if (component.powerConnection.positive && component.powerConnection.negative) {
                updateInfo(`✅ Cathode connectée au rail - (trou ${railIndex})\n🎉 LED connectée et ALLUMÉE ! ✅`);
                // Désactiver le mode connexion après connexion complète
                setTimeout(() => {
                    deactivateConnectionMode();
                }, 2000);
            } else {
                updateInfo(`✅ Cathode connectée au rail - (trou ${railIndex})\nConnectez maintenant l'anode au rail +`);
            }
            return;
        }
    } else if (holeType === 'central') {
        // C'est un trou central, vérifier s'il y a un composant dessus
        if (breadboardState.components.has(holeId)) {
            const targetComponent = breadboardState.components.get(holeId);
            connectComponentToComponent(targetComponent, holeId);
            return;
        } else {
            updateInfo(`⚠️ Pour connecter entre composants, cliquez directement sur un composant\nOu connectez aux rails d'alimentation (+ ou -)`);
            return;
        }
    } else {
        updateInfo(`⚠️ Les connexions doivent être faites aux rails d'alimentation (+ ou -) ou à un autre composant\nType de trou détecté: ${holeType || 'inconnu'}`);
        console.log('Trou non valide pour connexion:', holeId, 'Type:', holeType);
        return;
    }
    
    // Si on arrive ici, le composant n'est pas une LED ou il y a un problème
    updateInfo(`Erreur: Type de composant non supporté pour la connexion: ${component.type}`);
}

// Effacer la breadboard
function clearBreadboard() {
    breadboardState.selectedHole = null;
    breadboardState.connections.clear();
    
    // Désactiver les modes actifs
    deactivateMoveMode();
    deactivateConnectionMode();
    breadboardState.placementMode = null;
    breadboardState.componentToPlace = null;
    
    // Retirer tous les composants
    breadboardState.placedComponents.forEach(component => {
        component.remove(breadboardState);
    });
    breadboardState.placedComponents.clear();
    breadboardState.components.clear();
    
    // Supprimer tous les câbles
    if (breadboardState.cables) {
        breadboardState.cables.forEach(cable => {
            cable.remove(breadboardState);
        });
        breadboardState.cables.clear();
    }
    
    // Supprimer le conteneur SVG des câbles
    const svgContainer = document.getElementById('cables-svg-container');
    if (svgContainer) {
        svgContainer.remove();
    }
    
    // Réinitialiser le mode de placement
    document.querySelectorAll('.component-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    updatePlacementStatus('Mode: Sélection');
    
    document.querySelectorAll('.hole').forEach(hole => {
        hole.classList.remove('selected', 'connected', 'has-component');
    });
    
    // Supprimer tous les éléments de composants du DOM
    document.querySelectorAll('.component').forEach(comp => {
        comp.remove();
    });
    
    updateInfo('Breadboard effacée');
    console.log('Breadboard effacée');
}

// Réinitialiser la breadboard
function resetBreadboard() {
    clearBreadboard();
    initBreadboard();
    updatePlacementStatus('Mode: Sélection');
    updateInfo('Breadboard réinitialisée');
    console.log('Breadboard réinitialisée');
}

// Mettre à jour le panneau d'information
function updateInfo(message) {
    const infoDiv = document.getElementById('info');
    if (infoDiv) {
        // Si le message est du texte brut, l'afficher comme texte
        // Sinon, si c'est du HTML, utiliser innerHTML
        if (typeof message === 'string' && !message.includes('<')) {
            infoDiv.textContent = message;
        } else {
            infoDiv.innerHTML = message;
        }
    }
}

// Gestion du zoom
let currentZoom = 0.75; // Zoom initial à 75%

function updateZoom(zoom) {
    currentZoom = Math.max(0.3, Math.min(2.0, zoom)); // Limiter entre 30% et 200%
    const breadboard = document.getElementById('breadboard');
    if (breadboard) {
        breadboard.style.transform = `scale(${currentZoom})`;
        
        // Mettre à jour les positions de tous les composants après le zoom
        breadboardState.placedComponents.forEach(component => {
            if (component.domElement && component.position.holeId) {
                updateComponentPosition(component);
            }
        });
        
        // Mettre à jour la visualisation de tous les câbles après le zoom
        if (breadboardState.cables) {
            breadboardState.cables.forEach(cable => {
                if (cable.updateWireVisualization) {
                    cable.updateWireVisualization();
                }
            });
        }
    }
    const zoomLevel = document.getElementById('zoomLevel');
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(currentZoom * 100)}%`;
    }
}

function zoomIn() {
    updateZoom(currentZoom + 0.1);
}

function zoomOut() {
    updateZoom(currentZoom - 0.1);
}

function zoomReset() {
    updateZoom(0.75);
}

// Rendre les fonctions accessibles globalement
window.connectComponentToComponent = connectComponentToComponent;
window.addComponent = addComponent;

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', () => {
    initBreadboard();
    updatePlacementStatus('Mode: Sélection');
    updateInfo('Breadboard initialisée. Sélectionnez un composant pour commencer le placement.');
    
    // Initialiser le zoom
    updateZoom(currentZoom);
    
    // Boutons de zoom
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', zoomIn);
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', zoomOut);
    }
    if (zoomResetBtn) {
        zoomResetBtn.addEventListener('click', zoomReset);
    }
    
    // Gérer la molette de la souris pour zoomer (avec Ctrl)
    const breadboardContainer = document.querySelector('.breadboard-container');
    if (breadboardContainer) {
        breadboardContainer.addEventListener('wheel', (event) => {
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                if (event.deltaY < 0) {
                    zoomIn();
                } else {
                    zoomOut();
                }
            }
        });
    }
    
    // Gérer la touche Échap pour annuler les modes
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (breadboardState.moveMode) {
                deactivateMoveMode();
            } else if (breadboardState.connectionMode) {
                deactivateConnectionMode();
            }
        }
    });
    
    // Cliquer en dehors de la breadboard pour annuler les modes
    document.addEventListener('click', (event) => {
        // Ne pas annuler les modes si on clique dans le panneau d'informations
        if (event.target.closest('.info-panel') || event.target.closest('#info')) {
            return;
        }
        
        if (breadboardState.moveMode && !event.target.closest('#breadboard') && !event.target.closest('.component')) {
            deactivateMoveMode();
        } else if (breadboardState.connectionMode && !event.target.closest('#breadboard') && !event.target.closest('.component')) {
            deactivateConnectionMode();
        }
    });
});


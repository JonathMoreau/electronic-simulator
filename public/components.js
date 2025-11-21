/**
 * Classe de base Component - Node autonome
 * Cette classe peut être héritée pour créer différents types de composants électroniques
 */
class Component {
    /**
     * Constructeur du composant générique
     * @param {string} id - Identifiant unique du composant
     * @param {string} name - Nom du composant
     * @param {Object} config - Configuration du composant (pins, propriétés, etc.)
     */
    constructor(id, name, config = {}) {
        this.id = id || `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = name || 'Composant Générique';
        this.type = config.type || 'generic';
        
        // Pins du composant (points de connexion)
        this.pins = config.pins || [];
        
        // Position sur la breadboard
        this.position = {
            row: null,
            column: null,
            group: null,
            holes: [] // Liste des trous occupés par ce composant
        };
        
        // Propriétés du composant
        this.properties = {
            ...config.properties,
            voltage: config.properties?.voltage || 0,
            current: config.properties?.current || 0,
            resistance: config.properties?.resistance || null
        };
        
        // État du composant
        this.state = {
            placed: false,
            active: false,
            connected: false
        };
        
        // Connexions avec d'autres composants
        this.connections = [];
        
        // Connexions de pins (pour les connexions entre composants)
        // Structure: { pinId: { component: Component, pinId: string, holeId: string } }
        this.pinConnections = new Map();
        
        // Élément DOM représentant le composant
        this.domElement = null;
        
        // Callbacks
        this.onPlace = config.onPlace || null;
        this.onRemove = config.onRemove || null;
        this.onUpdate = config.onUpdate || null;
    }
    
    /**
     * Placer le composant sur la breadboard
     * @param {string} holeId - Identifiant du trou où placer le composant
     * @param {Object} breadboardState - État de la breadboard
     * @returns {boolean} - True si le placement a réussi
     */
    place(holeId, breadboardState) {
        if (this.state.placed) {
            console.warn(`Le composant ${this.id} est déjà placé`);
            return false;
        }
        
        // Parser le holeId pour obtenir la position
        const position = this.parseHoleId(holeId);
        if (!position) {
            console.error(`Impossible de parser le holeId: ${holeId}`);
            return false;
        }
        
        // Vérifier si les trous sont disponibles
        const requiredHoles = this.getRequiredHoles(position);
        if (!this.areHolesAvailable(requiredHoles, breadboardState)) {
            console.warn('Les trous requis ne sont pas disponibles');
            return false;
        }
        
        // Mettre à jour la position
        this.position = {
            ...position,
            holes: requiredHoles
        };
        
        // Marquer les trous comme occupés
        requiredHoles.forEach(holeId => {
            breadboardState.components.set(holeId, this);
        });
        
        // Mettre à jour l'état
        this.state.placed = true;
        
        // Créer l'élément DOM (breadboardState sera passé lors de l'appel depuis breadboard.js)
        // Note: createDOMElement sera appelé avec breadboardState depuis breadboard.js
        
        // Appeler le callback
        if (this.onPlace) {
            this.onPlace(this, position);
        }
        
        console.log(`Composant ${this.name} placé à ${holeId}`);
        return true;
    }
    
    /**
     * Retirer le composant de la breadboard
     * @param {Object} breadboardState - État de la breadboard
     */
    remove(breadboardState) {
        if (!this.state.placed) {
            return;
        }
        
        // Déconnecter tous les pins avant de retirer le composant
        if (this.pinConnections) {
            for (const [pinId, connection] of this.pinConnections.entries()) {
                this.disconnectPin(pinId);
            }
        }
        
        // Libérer les trous
        this.position.holes.forEach(holeId => {
            breadboardState.components.delete(holeId);
            const holeElement = document.getElementById(holeId);
            if (holeElement) {
                holeElement.classList.remove('has-component');
            }
        });
        
        // Retirer de la liste des composants placés
        if (breadboardState && breadboardState.placedComponents) {
            breadboardState.placedComponents.delete(this.id);
        }
        
        // Supprimer l'élément DOM
        if (this.domElement && this.domElement.parentNode) {
            this.domElement.parentNode.removeChild(this.domElement);
        }
        
        // Réinitialiser l'état
        this.state.placed = false;
        this.state.connected = false;
        this.position = {
            row: null,
            column: null,
            group: null,
            holes: []
        };
        
        // Réinitialiser les connexions
        this.connections = [];
        if (this.pinConnections) {
            this.pinConnections.clear();
        }
        
        // Appeler le callback
        if (this.onRemove) {
            this.onRemove(this);
        }
        
        console.log(`Composant ${this.name} retiré`);
    }
    
    /**
     * Parser un holeId pour obtenir la position
     * @param {string} holeId - Identifiant du trou
     * @returns {Object|null} - Position {row, column, group} ou null
     */
    parseHoleId(holeId) {
        // Format: central-row-column-group
        const match = holeId.match(/central-(\d+)-([A-E])-(\d+)/);
        if (match) {
            return {
                row: parseInt(match[1]),
                column: match[2],
                group: parseInt(match[3]),
                holeId: holeId
            };
        }
        return null;
    }
    
    /**
     * Obtenir les trous requis pour ce composant
     * Par défaut, un composant générique occupe un seul trou
     * Peut être surchargé dans les classes héritées
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis
     */
    getRequiredHoles(position) {
        // Par défaut, un composant occupe un seul trou
        return [position.holeId];
    }
    
    /**
     * Vérifier si les trous sont disponibles
     * @param {Array<string>} holeIds - Liste des holeIds à vérifier
     * @param {Object} breadboardState - État de la breadboard
     * @returns {boolean} - True si tous les trous sont disponibles
     */
    areHolesAvailable(holeIds, breadboardState) {
        return holeIds.every(holeId => {
            return !breadboardState.components.has(holeId);
        });
    }
    
    /**
     * Créer l'élément DOM représentant le composant
     * @param {Object} breadboardState - État de la breadboard (optionnel, pour les écouteurs)
     */
    createDOMElement(breadboardState = null) {
        if (!this.state.placed) {
            return;
        }
        
        const baseHole = document.getElementById(this.position.holeId);
        if (!baseHole) {
            console.error(`Trou de base introuvable: ${this.position.holeId}`);
            return;
        }
        
        // Créer l'élément du composant
        const componentDiv = document.createElement('div');
        componentDiv.className = `component component-${this.type}`;
        componentDiv.id = `component-${this.id}`;
        componentDiv.dataset.componentId = this.id;
        
        // Contenu du composant
        componentDiv.innerHTML = this.getComponentHTML();
        
        // Positionner le composant (en tenant compte du zoom)
        const breadboard = document.getElementById('breadboard');
        
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
        
        componentDiv.style.position = 'absolute';
        componentDiv.style.left = `${holeX + holeWidth / 2 - componentSize / 2}px`;
        componentDiv.style.top = `${holeY + holeHeight / 2 - componentSize / 2}px`;
        
        // Ajouter au DOM
        breadboard.style.position = 'relative';
        breadboard.appendChild(componentDiv);
        
        this.domElement = componentDiv;
        
        // Marquer les trous comme ayant un composant
        this.position.holes.forEach(holeId => {
            const hole = document.getElementById(holeId);
            if (hole) {
                hole.classList.add('has-component');
            }
        });
        
        // Ajouter les écouteurs d'événements
        this.attachEventListeners(breadboardState);
    }
    
    /**
     * Obtenir le HTML du composant
     * Peut être surchargé dans les classes héritées
     * @returns {string} - HTML du composant
     */
    getComponentHTML() {
        return `
            <div class="component-icon">⚡</div>
            <div class="component-label">${this.name}</div>
        `;
    }
    
    /**
     * Attacher les écouteurs d'événements au composant
     * @param {Object} breadboardState - État de la breadboard
     */
    attachEventListeners(breadboardState = null) {
        if (!this.domElement) {
            return;
        }
        
        // Clic pour sélectionner/supprimer et afficher les informations
        this.domElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Si on est en mode connexion et qu'on clique sur un autre composant
            if (breadboardState && breadboardState.connectionMode && 
                breadboardState.componentToConnect && 
                breadboardState.componentToConnect !== this) {
                // Appeler la fonction de connexion depuis breadboard.js (globale)
                if (typeof window !== 'undefined' && window.connectComponentToComponent) {
                    const result = window.connectComponentToComponent(this, this.position.holeId);
                    // Si la connexion a réussi, ne pas continuer avec handleClick
                    // Si elle a échoué, permettre de sélectionner le composant
                    if (result !== false) {
                        return;
                    }
                    // Si connexion échouée, continuer pour permettre la sélection
                }
            }
            
            this.handleClick(e, breadboardState);
        });
    }
    
    /**
     * Gérer le clic sur le composant
     * @param {Event} event - Événement de clic
     * @param {Object} breadboardState - État de la breadboard (passé depuis breadboard.js)
     */
    handleClick(event, breadboardState = null) {
        event.stopPropagation();
        
        // Double-clic pour supprimer
        if (event.detail === 2) {
            if (confirm(`Voulez-vous supprimer le composant "${this.name}" ?`)) {
                if (breadboardState) {
                    // Désactiver le mode déplacement si actif
                    if (breadboardState.moveMode && breadboardState.componentToMove === this) {
                        if (typeof deactivateMoveMode === 'function') {
                            deactivateMoveMode();
                        }
                    }
                    this.remove(breadboardState);
                }
            }
        } else {
            // Simple clic pour sélectionner
            this.select();
            
            // Si on est déjà en mode connexion, changer le composant à connecter
            if (breadboardState && breadboardState.connectionMode) {
                if (this.type === 'led' && typeof activateConnectionMode === 'function') {
                    console.log('Changement de composant en mode connexion:', this.name);
                    activateConnectionMode(this);
                }
            } else {
                // Pour les LEDs, activer le mode connexion au lieu du mode déplacement
                if (breadboardState) {
                    if (this.type === 'led' && typeof activateConnectionMode === 'function') {
                        console.log('Activation du mode connexion pour LED');
                        activateConnectionMode(this);
                    } else if (this.type !== 'led' && typeof activateMoveMode === 'function') {
                        // Pour les autres composants, activer le mode déplacement
                        console.log('Activation du mode déplacement pour', this.type);
                        activateMoveMode(this);
                    }
                }
            }
        }
    }
    
    /**
     * Sélectionner le composant
     */
    select() {
        // Désélectionner les autres composants
        document.querySelectorAll('.component.selected').forEach(comp => {
            comp.classList.remove('selected');
        });
        
        if (this.domElement) {
            this.domElement.classList.add('selected');
        }
        
        // Afficher les informations avec interface de gestion des connexions
        this.displayInfoWithConnections();
    }
    
    /**
     * Afficher les informations avec interface de gestion des connexions
     */
    displayInfoWithConnections() {
        const infoDiv = document.getElementById('info');
        if (!infoDiv) {
            return;
        }
        
        // Créer l'interface HTML simplifiée
        let html = `<div class="component-info-header">`;
        html += `<h4>${this.name}</h4>`;
        html += `</div>`;
        
        // Section ENTREES
        if (this.pins.length > 0) {
            const inputPins = this.pins.filter(pin => pin && (pin.type === 'input' || (!pin.type && pin.id)));
            
            if (inputPins.length > 0) {
                html += `<div class="info-section">`;
                html += `<h5>ENTREE</h5>`;
                for (const pin of inputPins) {
                    html += this.generatePinConnectionUI(pin, 'input');
                }
                html += `</div>`;
            }
            
            // Section SORTIES
            const outputPins = this.pins.filter(pin => pin && pin.type === 'output');
            if (outputPins.length > 0) {
                html += `<div class="info-section">`;
                html += `<h5>SORTIE</h5>`;
                for (const pin of outputPins) {
                    html += this.generatePinConnectionUI(pin, 'output');
                }
                html += `</div>`;
            }
        }
        
        // Section ETAT (pour les LEDs)
        if (this.type === 'led') {
            html += `<div class="info-section">`;
            html += `<h5>ETAT</h5>`;
            html += `<div class="info-label">État:</div>`;
            html += `<div class="info-value">${this.properties.isOn ? '● ALLUMÉE' : '○ ÉTEINTE'}</div>`;
            html += `<div class="info-label">Couleur:</div>`;
            html += `<div class="info-value">${this.properties.color || 'Non définie'}</div>`;
            html += `<div class="info-label">Tension forward (ΔU):</div>`;
            html += `<div class="info-value">`;
            html += `<input type="number" step="0.1" min="0" max="5" value="${this.properties.forwardVoltage || 2.0}" `;
            html += `class="forward-voltage-input" data-component-id="${this.id}" `;
            html += `style="width: 60px; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">`;
            html += ` <span style="font-size: 11px; color: #666;">V (chute de tension quand allumée)</span>`;
            html += `</div>`;
            html += `</div>`;
        }
        
        // Section ETAT (pour les interrupteurs)
        if (this.type === 'switch') {
            html += `<div class="info-section">`;
            html += `<h5>ETAT</h5>`;
            html += `<div class="info-label">État:</div>`;
            html += `<div class="info-value">${this.properties.isClosed ? '● FERMÉ' : '○ OUVERT'}</div>`;
            html += `<div class="info-value">`;
            html += `<button class="toggle-switch-btn" data-component-id="${this.id}" `;
            html += `style="padding: 8px 16px; margin-top: 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">`;
            html += `${this.properties.isClosed ? 'Ouvrir' : 'Fermer'} l'interrupteur</button>`;
            html += `</div>`;
            html += `</div>`;
        }
        
        // Section ETAT (pour Vsum - Nœud Sommateur)
        if (this.type === 'vsum') {
            html += `<div class="info-section">`;
            html += `<h5>ETAT - NŒUD SOMMATEUR</h5>`;
            html += `<div class="info-label" style="font-size: 11px; color: #666; margin-bottom: 8px;">Réseau de résistances sommateur (Summing Node)</div>`;
            // Obtenir la tension théorique au nœud sommateur (avant connexion à la charge)
            const theoreticalVoltage = this.getTheoreticalVoltage ? this.getTheoreticalVoltage() : null;
            // Obtenir la tension réelle au nœud sommateur (après connexion à la charge)
            const actualVoltage = this.getVoltage ? this.getVoltage() : null;
            // Obtenir la tension de sortie de Vsum (connectée à la LED)
            const outputVoltage = this.getOutputVoltage ? this.getOutputVoltage() : null;
            const totalCurrent = this.getTotalCurrent ? this.getTotalCurrent() : null;
            html += `<div class="info-label">Tension théorique (avant charge) (U):</div>`;
            html += `<div class="info-value">${theoreticalVoltage !== null && theoreticalVoltage !== undefined ? (Math.round(theoreticalVoltage * 1000) / 1000).toFixed(3) + ' V' : '-- V'}</div>`;
            html += `<div class="info-label">Tension réelle au nœud (U):</div>`;
            html += `<div class="info-value">${actualVoltage !== null && actualVoltage !== undefined ? actualVoltage.toFixed(3) + ' V' : '-- V'}</div>`;
            html += `<div class="info-label">Tension de sortie (vers LED) (U):</div>`;
            html += `<div class="info-value">${outputVoltage !== null && outputVoltage !== undefined ? outputVoltage.toFixed(3) + ' V' : '-- V'}</div>`;
            html += `<div class="info-label">Courant total (Σ I):</div>`;
            html += `<div class="info-value">${totalCurrent !== null && totalCurrent !== undefined ? (totalCurrent * 1000).toFixed(3) + ' mA' : '-- mA'}</div>`;
            html += `<div class="info-label">Nombre d'entrées:</div>`;
            html += `<div class="info-value">${this.properties.inputCount || this.pins.filter(p => p.type === 'input').length}</div>`;
            html += `</div>`;
        }
        
        infoDiv.innerHTML = html;
        
        // Empêcher la propagation des clics dans le panneau d'informations
        // pour éviter que les écouteurs globaux n'effacent les informations
        infoDiv.addEventListener('click', (e) => {
            e.stopPropagation();
        }, { capture: true });
        
        // Attacher les écouteurs d'événements pour les listes déroulantes
        this.attachConnectionListeners();
        
        // Attacher les écouteurs pour les champs de propriétés (tension forward pour les LEDs)
        if (this.type === 'led') {
            const forwardVoltageInput = infoDiv.querySelector('.forward-voltage-input');
            if (forwardVoltageInput) {
                // Empêcher la propagation des clics sur le champ input
                forwardVoltageInput.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                forwardVoltageInput.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const newValue = parseFloat(e.target.value);
                    if (!isNaN(newValue) && newValue >= 0 && newValue <= 5) {
                        this.properties.forwardVoltage = newValue;
                        console.log(`Tension forward de ${this.name} modifiée à ${newValue}V`);
                        
                        // Recalculer l'état électrique si la LED est allumée
                        if (this.checkPowerState) {
                            this.checkPowerState();
                        }
                        if (this.updateVisualState) {
                            this.updateVisualState();
                        }
                        
                        // Rafraîchir l'affichage pour mettre à jour les tensions
                        this.displayInfoWithConnections();
                        
                        // Mettre à jour les composants connectés
                        if (this.pinConnections) {
                            for (const connection of this.pinConnections.values()) {
                                if (connection.component && connection.component.checkPowerState) {
                                    connection.component.checkPowerState();
                                }
                                if (connection.component && connection.component.displayInfoWithConnections) {
                                    // Ne pas rafraîchir l'affichage de tous les composants, seulement si sélectionnés
                                }
                            }
                        }
                    } else {
                        // Valeur invalide, restaurer la valeur précédente
                        e.target.value = this.properties.forwardVoltage || 2.0;
                        alert('Valeur invalide. La tension forward doit être entre 0 et 5V.');
                    }
                });
            }
        }
        
        // Attacher les écouteurs pour le bouton de basculement des interrupteurs
        if (this.type === 'switch') {
            const toggleSwitchBtn = infoDiv.querySelector('.toggle-switch-btn');
            if (toggleSwitchBtn) {
                // Empêcher la propagation des clics sur le bouton
                toggleSwitchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Basculer l'état de l'interrupteur
                    if (this.toggle) {
                        this.toggle();
                    } else {
                        this.properties.isClosed = !this.properties.isClosed;
                        if (this.updateVisualState) {
                            this.updateVisualState();
                        }
                    }
                    
                    // Rafraîchir l'affichage
                    this.displayInfoWithConnections();
                    
                    // Mettre à jour les composants connectés (LEDs, résistances, etc.)
                    if (this.pinConnections) {
                        for (const connection of this.pinConnections.values()) {
                            if (connection.component && connection.component.checkPowerState) {
                                connection.component.checkPowerState();
                            }
                            if (connection.component && connection.component.updateVisualState) {
                                connection.component.updateVisualState();
                            }
                        }
                    }
                    
                    console.log(`Interrupteur ${this.properties.isClosed ? 'fermé' : 'ouvert'}`);
                });
            }
        }
    }
    
    /**
     * Générer l'interface de connexion pour un pin
     * @param {Object} pin - Pin à afficher
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {string} - HTML de l'interface
     */
    generatePinConnectionUI(pin, pinType) {
        const pinConnection = this.getPinConnection(pin.id);
        const pinVoltage = this.getPinVoltage(pin.id, pinType);
        const pinCurrent = this.getPinCurrent(pin.id, pinType);
        
        // Vérifier si connecté à un rail (pour les LEDs)
        let isConnectedToRail = false;
        let railConnectionInfo = '';
        if (this.type === 'led') {
            if (pinType === 'input' && pin.id === 'anode') {
                // Vérifier si connecté directement au rail + ou via un câble
                if (this.powerConnection && this.powerConnection.positive) {
                    isConnectedToRail = true;
                    railConnectionInfo = 'Rail + (5V)';
                } else if (this.isAnodeConnectedToPositive && this.isAnodeConnectedToPositive()) {
                    isConnectedToRail = true;
                    railConnectionInfo = 'Rail + (5V)';
                }
            } else if (pinType === 'output' && pin.id === 'cathode') {
                // Vérifier si connecté directement au rail - ou via un câble
                if (this.powerConnection && this.powerConnection.negative) {
                    isConnectedToRail = true;
                    railConnectionInfo = 'Rail - (GND)';
                } else if (this.isCathodeConnectedToNegative && this.isCathodeConnectedToNegative()) {
                    isConnectedToRail = true;
                    railConnectionInfo = 'Rail - (GND)';
                }
            }
        }
        
        // Si connecté à un rail ET à un composant, considérer comme connecté
        const isConnected = pinConnection || isConnectedToRail;
        
        // Obtenir tous les composants disponibles pour la connexion
        const availableComponents = this.getAvailableComponentsForConnection(pin.id, pinType);
        
        let html = `<div class="pin-connection-item">`;
        html += `<div class="pin-header">`;
        html += `<span class="pin-name">${pin.name || pin.id}</span>`;
        if (isConnected) {
            html += `<span class="pin-status connected">● Connecté</span>`;
        } else {
            html += `<span class="pin-status disconnected">○ Non connecté</span>`;
        }
        html += `</div>`;
        
        // Afficher l'info de connexion au rail si applicable
        if (isConnectedToRail && railConnectionInfo) {
            html += `<div class="rail-connection-info" style="margin: 8px 0;">`;
            html += `<span class="rail-badge">✓ ${railConnectionInfo}</span>`;
            html += `</div>`;
        }
        
        // Liste déroulante pour sélectionner le composant
        html += `<div class="connection-controls">`;
        html += `<select class="connection-select" data-pin-id="${pin.id}" data-pin-type="${pinType}">`;
        html += `<option value="">-- Sélectionner un composant --</option>`;
        
        for (const comp of availableComponents) {
            let selected = '';
            let displayName = '';
            
            if (comp.isRail) {
                // Option rail d'alimentation
                displayName = comp.name;
                // Vérifier si ce pin est connecté à un rail
                if (pinType === 'input' && comp.id === 'rail-positive') {
                    if (isConnectedToRail && railConnectionInfo.includes('Rail +')) {
                        selected = 'selected';
                    }
                } else if (pinType === 'output' && comp.id === 'rail-negative') {
                    if (isConnectedToRail && railConnectionInfo.includes('Rail -')) {
                        selected = 'selected';
                    }
                }
            } else {
                // Composant normal
                displayName = `${comp.name} (${comp.type})`;
                if (pinConnection && pinConnection.component && pinConnection.component.id === comp.id) {
                    selected = 'selected';
                }
            }
            
            html += `<option value="${comp.id}" ${selected}>${displayName}</option>`;
        }
        html += `</select>`;
        
        // Liste déroulante pour sélectionner le pin du composant (si un composant est sélectionné)
        if (pinConnection) {
            const targetComponent = pinConnection.component;
            const targetPins = targetComponent.pins || [];
            html += `<select class="connection-pin-select" data-pin-id="${pin.id}" data-target-component-id="${targetComponent.id}">`;
            html += `<option value="">-- Sélectionner un pin --</option>`;
            for (const targetPin of targetPins) {
                const selected = pinConnection.pinId === targetPin.id ? 'selected' : '';
                html += `<option value="${targetPin.id}" ${selected}>${targetPin.name || targetPin.id}</option>`;
            }
            html += `</select>`;
        } else {
            html += `<select class="connection-pin-select" data-pin-id="${pin.id}" style="display: none;">`;
            html += `<option value="">-- Sélectionner un composant d'abord --</option>`;
            html += `</select>`;
        }
        
        // Bouton pour déconnecter (afficher si connecté à un composant OU à un rail)
        if (isConnected) {
            html += `<button class="disconnect-btn" data-pin-id="${pin.id}">Déconnecter</button>`;
        }
        
        html += `</div>`;
        
        // Informations électriques (toujours afficher, même si les valeurs sont null)
        html += `<div class="pin-electrical-info">`;
        if (pinVoltage !== null && pinVoltage !== undefined && !Number.isNaN(pinVoltage)) {
            html += `<span><strong>U:</strong> ${pinVoltage.toFixed(2)} V</span>`;
            // Pour les LEDs, expliquer la chute de tension si applicable
            if (this.type === 'led' && pinType === 'output' && pin.id === 'cathode' && this.properties.isOn) {
                const forwardVoltage = this.properties.forwardVoltage || 2.0;
                html += `<span style="font-size: 10px; color: #999; margin-left: 8px;" title="Chute de tension forward de la LED">(ΔU = -${forwardVoltage}V)</span>`;
            }
        } else {
            html += `<span><strong>U:</strong> -- V</span>`;
        }
        if (pinCurrent !== null && pinCurrent !== undefined && !Number.isNaN(pinCurrent)) {
            html += `<span><strong>I:</strong> ${(pinCurrent * 1000).toFixed(2)} mA</span>`;
        } else {
            html += `<span><strong>I:</strong> -- mA</span>`;
        }
        html += `</div>`;
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Obtenir les composants disponibles pour la connexion
     * @param {string} pinId - Pin à connecter
     * @param {string} pinType - Type du pin
     * @returns {Array} - Liste des options disponibles (composants + rails)
     */
    getAvailableComponentsForConnection(pinId, pinType) {
        const available = [];
        
        // Ajouter les rails d'alimentation comme options spéciales
        if (pinType === 'input') {
            // Pour une entrée, on peut se connecter au rail +
            available.push({ id: 'rail-positive', name: 'Rail + (5V)', type: 'rail', isRail: true });
        }
        if (pinType === 'output') {
            // Pour une sortie, on peut se connecter au rail -
            available.push({ id: 'rail-negative', name: 'Rail - (GND)', type: 'rail', isRail: true });
        }
        
        // Parcourir tous les composants placés
        if (typeof breadboardState !== 'undefined' && breadboardState.placedComponents) {
            for (const component of breadboardState.placedComponents.values()) {
                // Ne pas inclure ce composant lui-même
                if (component.id === this.id) {
                    continue;
                }
                
                // Vérifier si le composant a des pins compatibles
                if (component.pins && component.pins.length > 0) {
                    // Pour une entrée, on peut se connecter à une sortie
                    // Pour une sortie, on peut se connecter à une entrée
                    const compatiblePins = component.pins.filter(p => {
                        if (pinType === 'input') {
                            return p.type === 'output' || !p.type;
                        } else {
                            return p.type === 'input' || !p.type;
                        }
                    });
                    
                    if (compatiblePins.length > 0) {
                        available.push(component);
                    }
                }
            }
        }
        
        return available;
    }
    
    /**
     * Attacher les écouteurs d'événements pour les connexions
     */
    attachConnectionListeners() {
        const infoDiv = document.getElementById('info');
        if (!infoDiv) {
            return;
        }
        
               // Écouter les changements de sélection de composant
               infoDiv.querySelectorAll('.connection-select').forEach(select => {
                   // Empêcher la propagation des clics
                   select.addEventListener('click', (e) => {
                       e.stopPropagation();
                   });
                   select.addEventListener('change', (e) => {
                       e.stopPropagation();
                const pinId = e.target.dataset.pinId;
                const pinType = e.target.dataset.pinType;
                const targetComponentId = e.target.value;
                
                if (targetComponentId) {
                    // Vérifier si c'est un rail d'alimentation
                    if (targetComponentId === 'rail-positive' || targetComponentId === 'rail-negative') {
                        // Connecter au rail via un câble (pour les LEDs)
                        if (this.type === 'led') {
                            const railType = targetComponentId === 'rail-positive' ? 'positive' : 'negative';
                            const railHole = this.findRailHole(railType);
                            
                            if (railHole) {
                                // Créer un câble vers le rail
                                const cable = new Cable(null, { 
                                    color: targetComponentId === 'rail-positive' ? '#f44336' : '#2196f3' 
                                });
                                
                                const componentHole = this.getHoleForPin(pinId);
                                if (componentHole && cable.place(componentHole, breadboardState)) {
                                    breadboardState.placedComponents.set(cable.id, cable);
                                    if (breadboardState.cables) {
                                        breadboardState.cables.set(cable.id, cable);
                                    }
                                    cable.createDOMElement(breadboardState);
                                    
                                    // Connecter le câble au composant et au rail
                                    cable.connectStart(this, pinId);
                                    cable.startHoleId = componentHole;
                                    cable.endHoleId = railHole;
                                    
                                    // Connecter au rail
                                    if (targetComponentId === 'rail-positive' && pinId === 'anode') {
                                        this.connectAnodeToPositive(railHole);
                                    } else if (targetComponentId === 'rail-negative' && pinId === 'cathode') {
                                        this.connectCathodeToNegative(railHole);
                                    }
                                    
                                    // Mettre à jour la visualisation du câble
                                    cable.updateWireVisualization();
                                    
                                    this.displayInfoWithConnections();
                                    if (this.checkPowerState) {
                                        this.checkPowerState();
                                    }
                                }
                            }
                        }
                    } else {
                        // Trouver le composant cible
                        const targetComponent = breadboardState.placedComponents.get(targetComponentId);
                        if (targetComponent) {
                            // Afficher la liste des pins du composant cible
                            this.showTargetPinSelect(pinId, targetComponent);
                        }
                    }
                } else {
                    // Déconnecter le pin
                    this.disconnectPin(pinId);
                    this.displayInfoWithConnections();
                    if (this.checkPowerState) {
                        this.checkPowerState();
                    }
                }
            });
        });
        
               // Écouter les changements de sélection de pin
               infoDiv.querySelectorAll('.connection-pin-select').forEach(select => {
                   // Empêcher la propagation des clics
                   select.addEventListener('click', (e) => {
                       e.stopPropagation();
                   });
                   select.addEventListener('change', (e) => {
                       e.stopPropagation();
                const pinId = e.target.dataset.pinId;
                const targetComponentId = e.target.dataset.targetComponentId;
                const targetPinId = e.target.value;
                
                if (targetComponentId && targetPinId) {
                    const targetComponent = breadboardState.placedComponents.get(targetComponentId);
                    if (targetComponent) {
                        // Établir la connexion
                        this.connectPinToPin(pinId, targetComponent, targetPinId);
                        this.displayInfoWithConnections();
                        if (this.checkPowerState) {
                            this.checkPowerState();
                        }
                        if (targetComponent.checkPowerState) {
                            targetComponent.checkPowerState();
                        }
                    }
                }
            });
        });
        
               // Écouter les clics sur les boutons de déconnexion
               infoDiv.querySelectorAll('.disconnect-btn').forEach(btn => {
                   btn.addEventListener('click', (e) => {
                       e.stopPropagation();
                       const pinId = e.target.dataset.pinId;
                       
                       // Si c'est une LED et que le pin est connecté à un rail, déconnecter du rail
                       if (this.type === 'led') {
                           if (pinId === 'anode' && this.powerConnection && this.powerConnection.positive) {
                               // Déconnecter du rail +
                               this.powerConnection.positive = null;
                               // Supprimer le câble associé si présent
                               const cables = breadboardState.cables || new Map();
                               for (const cable of cables.values()) {
                                   if (cable.startComponent === this && cable.startPinId === 'anode') {
                                       cable.remove(breadboardState);
                                       cables.delete(cable.id);
                                       break;
                                   }
                               }
                           } else if (pinId === 'cathode' && this.powerConnection && this.powerConnection.negative) {
                               // Déconnecter du rail -
                               this.powerConnection.negative = null;
                               // Supprimer le câble associé si présent
                               const cables = breadboardState.cables || new Map();
                               for (const cable of cables.values()) {
                                   if (cable.startComponent === this && cable.startPinId === 'cathode') {
                                       cable.remove(breadboardState);
                                       cables.delete(cable.id);
                                       break;
                                   }
                               }
                           }
                       }
                       
                       // Déconnecter le pin (gère aussi les connexions pin-à-pin)
                       this.disconnectPin(pinId);
                       
                       // Mettre à jour l'affichage et l'état
                       this.displayInfoWithConnections();
                       if (this.checkPowerState) {
                           this.checkPowerState();
                       }
                   });
               });
    }
    
    /**
     * Afficher la liste des pins du composant cible
     * @param {string} pinId - Pin source
     * @param {Component} targetComponent - Composant cible
     */
    showTargetPinSelect(pinId, targetComponent) {
        const pinSelect = document.querySelector(`.connection-pin-select[data-pin-id="${pinId}"]`);
        if (!pinSelect) {
            return;
        }
        
        // Mettre à jour l'attribut data-target-component-id
        pinSelect.dataset.targetComponentId = targetComponent.id;
        
        // Vider et remplir la liste
        pinSelect.innerHTML = '<option value="">-- Sélectionner un pin --</option>';
        const targetPins = targetComponent.pins || [];
        
        // Filtrer les pins compatibles
        const currentPin = this.pins.find(p => p.id === pinId);
        const pinType = currentPin ? currentPin.type : 'input';
        
        const compatiblePins = targetPins.filter(p => {
            if (pinType === 'input') {
                return p.type === 'output' || !p.type;
            } else {
                return p.type === 'input' || !p.type;
            }
        });
        
        for (const targetPin of compatiblePins) {
            const option = document.createElement('option');
            option.value = targetPin.id;
            option.textContent = targetPin.name || targetPin.id;
            pinSelect.appendChild(option);
        }
        
        pinSelect.style.display = 'block';
    }
    
    /**
     * Obtenir les informations du composant
     * @returns {string} - Informations formatées
     */
    getInfo() {
        let info = `Composant: ${this.name}\n`;
        info += `Type: ${this.type}\n`;
        info += `ID: ${this.id}\n`;
        info += `Position: ${this.position.holeId}\n`;
        info += `Pins: ${this.pins.length}\n`;
        
        // Séparer les pins en entrées et sorties
        const inputPins = this.pins.filter(pin => {
            // Un pin est une entrée s'il a type === 'input' ou s'il n'a pas de type mais a un id
            return pin && (pin.type === 'input' || (!pin.type && pin.id));
        });
        const outputPins = this.pins.filter(pin => pin && pin.type === 'output');
        
        // Afficher les informations pour les entrées
        if (inputPins.length > 0) {
            info += `\n\n=== ENTREES ===`;
            for (const pin of inputPins) {
                const pinVoltage = this.getPinVoltage(pin.id, 'input');
                const pinCurrent = this.getPinCurrent(pin.id, 'input');
                const pinConnection = this.getPinConnection(pin.id);
                
                info += `\n${pin.name || pin.id}:`;
                if (pinConnection) {
                    info += ` [→ ${pinConnection.component.name}.${pinConnection.pinId}]`;
                }
                if (pinVoltage !== null && pinVoltage !== undefined) {
                    info += `\n  U = ${pinVoltage.toFixed(2)} V`;
                } else {
                    info += `\n  U = -- V (non connecté)`;
                }
                if (pinCurrent !== null && pinCurrent !== undefined) {
                    info += `\n  I = ${(pinCurrent * 1000).toFixed(2)} mA`;
                } else {
                    info += `\n  I = -- mA (non connecté)`;
                }
            }
        }
        
        // Afficher les informations pour les sorties
        if (outputPins.length > 0) {
            info += `\n\n=== SORTIES ===`;
            for (const pin of outputPins) {
                const pinVoltage = this.getPinVoltage(pin.id, 'output');
                const pinCurrent = this.getPinCurrent(pin.id, 'output');
                const pinConnection = this.getPinConnection(pin.id);
                
                info += `\n${pin.name || pin.id}:`;
                if (pinConnection) {
                    info += ` [→ ${pinConnection.component.name}.${pinConnection.pinId}]`;
                }
                if (pinVoltage !== null && pinVoltage !== undefined) {
                    info += `\n  U = ${pinVoltage.toFixed(2)} V`;
                } else {
                    info += `\n  U = -- V (non connecté)`;
                }
                if (pinCurrent !== null && pinCurrent !== undefined) {
                    info += `\n  I = ${(pinCurrent * 1000).toFixed(2)} mA`;
                } else {
                    info += `\n  I = -- mA (non connecté)`;
                }
            }
        }
        
        // Si pas de pins définis, afficher les informations générales
        if (this.pins.length === 0) {
            const voltage = this.getVoltage();
            const current = this.getCurrent();
            
            info += `\n\n=== INFORMATIONS ELECTRIQUES ===`;
            if (voltage !== null) {
                info += `\nU = ${voltage.toFixed(2)} V`;
            } else {
                info += `\nU = -- V (non connecté)`;
            }
            if (current !== null) {
                info += `\nI = ${(current * 1000).toFixed(2)} mA`;
            } else {
                info += `\nI = -- mA (non connecté)`;
            }
        }
        
        // Propriétés nominales
        if (this.properties.voltage !== undefined && this.properties.voltage !== 0) {
            info += `\n\nTension nominale: ${this.properties.voltage}V`;
        }
        if (this.properties.current !== undefined && this.properties.current !== 0) {
            info += `\nCourant nominal: ${this.properties.current}A`;
        }
        if (this.properties.resistance !== null) {
            info += `\nRésistance: ${this.properties.resistance}Ω`;
        }
        
        return info;
    }
    
    /**
     * Vérifier si une sortie est connectée au rail + (méthode générique)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isOutputConnectedToPositive(visited = new Set()) {
        // Par défaut, retourner false
        // Les classes héritées peuvent surcharger cette méthode
        return false;
    }
    
    /**
     * Vérifier si une entrée est connectée au rail + (méthode générique)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isInputConnectedToPositive(visited = new Set()) {
        // Par défaut, retourner false
        // Les classes héritées peuvent surcharger cette méthode
        return false;
    }
    
    /**
     * Vérifier si une sortie est connectée au rail - (méthode générique)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail -
     */
    isOutputConnectedToNegative(visited = new Set()) {
        // Par défaut, retourner false
        // Les classes héritées peuvent surcharger cette méthode
        return false;
    }
    
    /**
     * Vérifier si une entrée est connectée au rail - (méthode générique)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail -
     */
    isInputConnectedToNegative(visited = new Set()) {
        // Par défaut, retourner false
        // Les classes héritées peuvent surcharger cette méthode
        return false;
    }
    
    /**
     * Obtenir la tension sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @param {Set} visited - Composants déjà visités (pour éviter les récursions infinies)
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getPinVoltage(pinId, pinType, visited = null) {
        // Si visited n'est pas fourni, créer un nouveau Set pour cet appel
        const visitedSet = visited || new Set();
        
        // Protection contre les récursions infinies
        if (visitedSet.has(this.id)) {
            return null;
        }
        visitedSet.add(this.id);
        
        // Vérifier si le pin est connecté à un autre composant
        const connection = this.getPinConnection(pinId);
        if (connection && connection.component) {
            // Si connecté à un autre composant, obtenir la tension de ce composant
            // Les classes héritées peuvent surcharger cette logique
            if (connection.component.getPinVoltage) {
                return connection.component.getPinVoltage(connection.pinId, pinType, visitedSet);
            }
        }
        
        // Par défaut, retourner null (non connecté)
        // Les classes héritées peuvent surcharger cette méthode
        return null;
    }
    
    /**
     * Obtenir l'intensité sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getPinCurrent(pinId, pinType) {
        // Vérifier si le pin est connecté à un autre composant
        const connection = this.getPinConnection(pinId);
        if (connection && connection.component) {
            // Si connecté à un autre composant, obtenir l'intensité de ce composant
            // Les classes héritées peuvent surcharger cette logique
            return connection.component.getPinCurrent(connection.pinId, pinType);
        }
        
        // Par défaut, retourner null (non connecté)
        // Les classes héritées peuvent surcharger cette méthode
        return null;
    }
    
    /**
     * Obtenir la tension du composant
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getVoltage() {
        // Par défaut, retourner la tension nominale ou null
        return this.properties.voltage || null;
    }
    
    /**
     * Obtenir l'intensité du composant
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getCurrent() {
        // Par défaut, retourner le courant nominal ou null
        return this.properties.current || null;
    }
    
    /**
     * Mettre à jour les propriétés du composant
     * @param {Object} newProperties - Nouvelles propriétés
     */
    updateProperties(newProperties) {
        this.properties = {
            ...this.properties,
            ...newProperties
        };
        
        if (this.onUpdate) {
            this.onUpdate(this, this.properties);
        }
    }
    
    /**
     * Connecter ce composant à un autre
     * @param {Component} otherComponent - Autre composant
     * @param {string} pinFrom - Pin de ce composant
     * @param {string} pinTo - Pin de l'autre composant
     */
    connect(otherComponent, pinFrom, pinTo) {
        const connection = {
            from: this,
            to: otherComponent,
            pinFrom: pinFrom,
            pinTo: pinTo,
            id: `conn-${this.id}-${otherComponent.id}`
        };
        
        this.connections.push(connection);
        this.state.connected = true;
        
        console.log(`Connexion établie: ${this.name} (${pinFrom}) -> ${otherComponent.name} (${pinTo})`);
    }
    
    /**
     * Connecter un pin de ce composant à un pin d'un autre composant via un câble
     * @param {string} thisPinId - Pin de ce composant à connecter
     * @param {Component} otherComponent - Autre composant
     * @param {string} otherPinId - Pin de l'autre composant
     * @param {string} holeId - Trou de connexion (optionnel, pour la visualisation)
     * @param {Cable} cable - Câble à utiliser pour la connexion (créé automatiquement si null)
     * @returns {boolean} - True si la connexion a réussi
     */
    connectPinToPin(thisPinId, otherComponent, otherPinId, holeId = null, cable = null) {
        if (!thisPinId || !otherComponent || !otherPinId) {
            console.error('Paramètres de connexion invalides');
            return false;
        }
        
        // Vérifier que les pins existent
        const thisPin = this.pins.find(p => p.id === thisPinId);
        const otherPin = otherComponent.pins.find(p => p.id === otherPinId);
        
        if (!thisPin) {
            console.error(`Pin ${thisPinId} introuvable sur ${this.name}`);
            return false;
        }
        
        if (!otherPin) {
            console.error(`Pin ${otherPinId} introuvable sur ${otherComponent.name}`);
            return false;
        }
        
        // Si aucun câble n'est fourni, créer un câble automatiquement
        if (!cable && typeof Cable !== 'undefined') {
            cable = new Cable(null, { color: '#4caf50' });
            
            // Trouver les trous associés aux pins
            const thisHole = this.getHoleForPin(thisPinId);
            const otherHole = otherComponent.getHoleForPin(otherPinId);
            
            if (thisHole && otherHole) {
                // Placer le câble entre les deux trous
                const cableHole = thisHole; // Utiliser le premier trou comme position de base
                if (breadboardState && breadboardState.placedComponents) {
                    if (cable.place(cableHole, breadboardState)) {
                        breadboardState.placedComponents.set(cable.id, cable);
                        cable.createDOMElement(breadboardState);
                        
                        // Stocker le câble
                        if (breadboardState.cables) {
                            breadboardState.cables.set(cable.id, cable);
                        }
                    }
                }
            }
        }
        
        // Si un câble est fourni, l'utiliser pour la connexion
        if (cable) {
            // Connecter le câble aux deux composants
            cable.connectStart(this, thisPinId);
            cable.connectEnd(otherComponent, otherPinId);
            
            // Mettre à jour la visualisation du câble après un délai pour que le DOM soit prêt
            setTimeout(() => {
                if (cable.updateWireVisualization) {
                    cable.updateWireVisualization();
                }
            }, 50);
        }
        
        // Stocker la connexion avec référence au câble
        this.pinConnections.set(thisPinId, {
            component: otherComponent,
            pinId: otherPinId,
            holeId: holeId,
            cable: cable
        });
        
        // Créer aussi la connexion inverse (bidirectionnelle)
        if (!otherComponent.pinConnections) {
            otherComponent.pinConnections = new Map();
        }
        otherComponent.pinConnections.set(otherPinId, {
            component: this,
            pinId: thisPinId,
            holeId: holeId,
            cable: cable
        });
        
        // Ajouter à la liste des connexions générales
        this.connect(otherComponent, thisPinId, otherPinId);
        
        console.log(`Connexion pin établie via câble: ${this.name}.${thisPinId} <-> ${otherComponent.name}.${otherPinId}`);
        return true;
    }
    
    /**
     * Obtenir le trou associé à un pin
     * @param {string} pinId - Identifiant du pin
     * @returns {string|null} - Identifiant du trou ou null
     */
    getHoleForPin(pinId) {
        // Pour les LEDs, retourner le trou correspondant
        if (this.type === 'led') {
            if (pinId === 'anode' && this.anode) {
                return this.anode;
            }
            if (pinId === 'cathode' && this.cathode) {
                return this.cathode;
            }
        }
        
        // Par défaut, retourner le premier trou du composant
        if (this.position && this.position.holes && this.position.holes.length > 0) {
            return this.position.holes[0];
        }
        
        return this.position.holeId || null;
    }
    
    /**
     * Déconnecter un pin
     * @param {string} pinId - Pin à déconnecter
     */
    disconnectPin(pinId) {
        const connection = this.pinConnections.get(pinId);
        if (connection) {
            // Si la connexion utilise un câble, le supprimer
            if (connection.cable) {
                connection.cable.remove(breadboardState);
                if (breadboardState && breadboardState.cables) {
                    breadboardState.cables.delete(connection.cable.id);
                }
            }
            
            // Déconnecter aussi l'autre composant
            if (connection.component && connection.component.pinConnections) {
                connection.component.pinConnections.delete(connection.pinId);
            }
            this.pinConnections.delete(pinId);
            console.log(`Pin ${pinId} déconnecté de ${this.name}`);
        }
    }
    
    /**
     * Obtenir le composant connecté à un pin
     * @param {string} pinId - Pin à vérifier
     * @returns {Object|null} - { component, pinId } ou null si non connecté
     */
    getPinConnection(pinId) {
        return this.pinConnections.get(pinId) || null;
    }
    
    /**
     * Vérifier si un pin est connecté
     * @param {string} pinId - Pin à vérifier
     * @returns {boolean} - True si le pin est connecté
     */
    isPinConnected(pinId) {
        return this.pinConnections.has(pinId);
    }
    
    /**
     * Obtenir une représentation JSON du composant
     * @returns {Object} - Représentation JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            position: this.position,
            properties: this.properties,
            state: this.state,
            pins: this.pins
        };
    }
}

// Exporter la classe pour utilisation globale
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Component;
}


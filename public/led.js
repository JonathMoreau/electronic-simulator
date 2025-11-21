/**
 * Composant LED - Hérite de Component
 * Une LED a une entrée + (anode) et une sortie - (cathode)
 * Elle s'allume quand elle reçoit de l'alimentation
 */
class LED extends Component {
    /**
     * Constructeur de la LED
     * @param {string} id - Identifiant unique de la LED
     * @param {Object} config - Configuration de la LED
     */
    constructor(id, config = {}) {
        super(id, 'LED', {
            type: 'led',
            pins: [
                { id: 'anode', name: 'Anode (+)', type: 'input' },
                { id: 'cathode', name: 'Cathode (-)', type: 'output' }
            ],
            properties: {
                voltage: config.voltage || 3.3, // Tension nominale de la LED
                current: config.current || 0.02, // Courant nominal (20mA)
                forwardVoltage: config.forwardVoltage || 2.0, // Tension de seuil
                color: config.color || 'red', // Couleur de la LED
                isOn: false // État initial : éteinte
            },
            ...config
        });
        
        // Pins spécifiques à la LED
        this.anode = null; // Trou connecté à l'anode (+)
        this.cathode = null; // Trou connecté à la cathode (-)
        
        // Connexions d'alimentation
        this.powerConnection = {
            positive: null, // Connexion au rail positif
            negative: null  // Connexion au rail négatif
        };
    }
    
    /**
     * Obtenir les trous requis pour placer la LED
     * Une LED nécessite 2 trous (anode et cathode)
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis
     */
    getRequiredHoles(position) {
        // Pour une LED, on a besoin de 2 trous adjacents
        // L'anode sera sur le trou sélectionné
        // La cathode sera sur le trou de la colonne suivante (même rangée)
        
        const { row, column, group, holeId } = position;
        const columns = ['A', 'B', 'C', 'D', 'E'];
        const columnIndex = columns.indexOf(column);
        
        // Si on est sur la dernière colonne (E), on ne peut pas placer la LED
        if (columnIndex === columns.length - 1) {
            return [holeId]; // Retourner seulement le trou sélectionné
        }
        
        // Trou suivant (colonne suivante)
        const nextColumn = columns[columnIndex + 1];
        const cathodeHoleId = `central-${row}-${nextColumn}-${group}`;
        
        return [holeId, cathodeHoleId];
    }
    
    /**
     * Obtenir le HTML du composant LED
     * @returns {string} - HTML de la LED
     */
    getComponentHTML() {
        const isOn = this.properties.isOn;
        const color = this.properties.color;
        const ledColor = isOn ? color : 'gray';
        
        return `
            <div class="component-icon led-icon" style="color: ${ledColor};">
                ${isOn ? '●' : '○'}
            </div>
            <div class="component-label">LED</div>
        `;
    }
    
    /**
     * Placer la LED sur la breadboard
     * @param {string} holeId - Identifiant du trou où placer l'anode
     * @param {Object} breadboardState - État de la breadboard
     * @returns {boolean} - True si le placement a réussi
     */
    place(holeId, breadboardState) {
        const success = super.place(holeId, breadboardState);
        
        if (success && this.position.holes.length >= 2) {
            // L'anode est sur le premier trou
            this.anode = this.position.holes[0];
            // La cathode est sur le deuxième trou
            this.cathode = this.position.holes[1];
            
            // Mettre à jour l'affichage
            this.updateVisualState();
        }
        
        return success;
    }
    
    /**
     * Connecter l'anode au rail positif
     * @param {string} railHoleId - Identifiant du trou du rail positif
     */
    connectAnodeToPositive(railHoleId) {
        this.powerConnection.positive = railHoleId;
        this.checkPowerState();
    }
    
    /**
     * Connecter la cathode au rail négatif
     * @param {string} railHoleId - Identifiant du trou du rail négatif
     */
    connectCathodeToNegative(railHoleId) {
        this.powerConnection.negative = railHoleId;
        this.checkPowerState();
    }
    
    /**
     * Trouver un trou disponible sur un rail d'alimentation
     * @param {string} railType - Type de rail ('positive' ou 'negative')
     * @returns {string|null} - Identifiant du trou ou null si aucun trou disponible
     */
    findRailHole(railType) {
        // Chercher un trou du rail qui n'est pas déjà utilisé
        for (let i = 0; i < 63; i++) {
            const railHoleId = `power-top-${railType}-${i}`;
            const hole = document.getElementById(railHoleId);
            if (hole && !hole.classList.contains('has-component')) {
                return railHoleId;
            }
        }
        // Si aucun trou disponible en haut, essayer en bas
        for (let i = 0; i < 63; i++) {
            const railHoleId = `power-bottom-${railType}-${i}`;
            const hole = document.getElementById(railHoleId);
            if (hole && !hole.classList.contains('has-component')) {
                return railHoleId;
            }
        }
        return null;
    }
    
    /**
     * Vérifier si l'anode est connectée au rail + (directement ou via une chaîne)
     * @param {Set} visited - Composants déjà visités (pour éviter les boucles infinies)
     * @returns {boolean} - True si connecté au rail +
     */
    isAnodeConnectedToPositive(visited = new Set()) {
        // Éviter les boucles infinies
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si connecté directement au rail positif
        if (this.powerConnection.positive !== null) {
            return true;
        }
        
        // Si l'anode est connectée à un autre composant, vérifier récursivement
        if (this.isPinConnected('anode')) {
            const connection = this.getPinConnection('anode');
            if (connection && connection.component) {
                // Pour une LED, si notre anode est connectée à la cathode d'une autre LED,
                // vérifier si l'anode de cette autre LED est au rail +
                if (connection.component.type === 'led' && connection.pinId === 'cathode') {
                    return connection.component.isAnodeConnectedToPositive(visited);
                }
                // Pour Vsum, vérifier si ses entrées sont connectées au rail +
                if (connection.component.type === 'vsum') {
                    // Vérifier si au moins une entrée de Vsum est connectée au rail +
                    const vsum = connection.component;
                    for (const pin of vsum.pins) {
                        if (pin.type === 'input' && vsum.isPinConnected(pin.id)) {
                            const vsumInputConnection = vsum.getPinConnection(pin.id);
                            if (vsumInputConnection && vsumInputConnection.component) {
                                // Si c'est une résistance, vérifier si son entrée est connectée au rail +
                                if (vsumInputConnection.component.type === 'resistance') {
                                    if (vsumInputConnection.component.isInputConnectedToPositive) {
                                        if (vsumInputConnection.component.isInputConnectedToPositive(visited)) {
                                            return true;
                                        }
                                    }
                                } else {
                                    // Pour les autres composants, vérifier si leur sortie est connectée au rail +
                                    if (vsumInputConnection.component.isOutputConnectedToPositive) {
                                        if (vsumInputConnection.component.isOutputConnectedToPositive(visited)) {
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return false;
                }
                // Pour d'autres composants, vérifier si leur sortie est connectée au rail +
                if (connection.component.isOutputConnectedToPositive) {
                    return connection.component.isOutputConnectedToPositive(visited);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier si la cathode est connectée au rail - (directement ou via une chaîne)
     * @param {Set} visited - Composants déjà visités (pour éviter les boucles infinies)
     * @returns {boolean} - True si connecté au rail -
     */
    isCathodeConnectedToNegative(visited = new Set()) {
        // Éviter les boucles infinies
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si connecté directement au rail négatif via powerConnection
        if (this.powerConnection.negative !== null) {
            return true;
        }
        
        // Vérifier aussi si la cathode est connectée au rail via pinConnections
        if (this.isPinConnected('cathode')) {
            const cathodeConnection = this.getPinConnection('cathode');
            if (cathodeConnection && cathodeConnection.component) {
                // Si connecté directement au rail négatif
                if (cathodeConnection.component.isRail && cathodeConnection.component.id === 'rail-negative') {
                    return true;
                }
            }
        }
        
        // Si la cathode est connectée à un autre composant, vérifier récursivement
        if (this.isPinConnected('cathode')) {
            const connection = this.getPinConnection('cathode');
            if (connection && connection.component) {
                // Pour une LED, si notre cathode est connectée à l'anode d'une autre LED,
                // vérifier si la cathode de cette autre LED est connectée au GND
                if (connection.component.type === 'led' && connection.pinId === 'anode') {
                    return connection.component.isCathodeConnectedToNegative(visited);
                }
                // Pour d'autres composants, si notre cathode est connectée à leur entrée,
                // vérifier si leur sortie est connectée au rail - (car le courant passe par le composant)
                if (connection.pinId === 'input' && connection.component.isOutputConnectedToNegative) {
                    return connection.component.isOutputConnectedToNegative(visited);
                }
                // Pour Vsum, vérifier si sa sortie est connectée au rail -
                if (connection.component.type === 'vsum') {
                    if (connection.component.isOutputConnectedToNegative) {
                        return connection.component.isOutputConnectedToNegative(visited);
                    }
                    // Par défaut, Vsum est connecté au rail -
                    return true;
                }
                // Sinon, vérifier si leur entrée est connectée au rail -
                if (connection.component.isInputConnectedToNegative) {
                    return connection.component.isInputConnectedToNegative(visited);
                }
            }
        }
        
        // Si l'anode est connectée à un autre composant, vérifier si cela mène au GND
        // (pour les cas où l'anode est connectée à la cathode d'une autre LED qui est au GND)
        if (this.isPinConnected('anode')) {
            const connection = this.getPinConnection('anode');
            if (connection && connection.component) {
                // Si notre anode est connectée à la cathode d'une autre LED, vérifier si cette LED est au GND
                if (connection.component.type === 'led' && connection.pinId === 'cathode') {
                    return connection.component.isCathodeConnectedToNegative(visited);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier si l'anode est connectée au rail - (pour propagation inverse)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail -
     */
    isAnodeConnectedToNegative(visited = new Set()) {
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si l'anode est connectée à un autre composant
        if (this.isPinConnected('anode')) {
            const connection = this.getPinConnection('anode');
            if (connection && connection.component) {
                // Si notre anode est connectée à la cathode d'une autre LED,
                // vérifier si l'anode de cette autre LED est connectée au GND
                if (connection.component.type === 'led' && connection.pinId === 'cathode') {
                    return connection.component.isAnodeConnectedToNegative(visited);
                }
                return connection.component.isOutputConnectedToNegative(visited);
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier si la cathode est connectée au rail + (pour propagation inverse)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isCathodeConnectedToPositive(visited = new Set()) {
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si la cathode est connectée à un autre composant
        if (this.isPinConnected('cathode')) {
            const connection = this.getPinConnection('cathode');
            if (connection && connection.component) {
                if (connection.component.type === 'led') {
                    return connection.component.isAnodeConnectedToPositive(visited);
                }
                return connection.component.isInputConnectedToPositive(visited);
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier l'état d'alimentation et allumer/éteindre la LED
     * Une LED s'allume UNIQUEMENT si :
     * - L'anode est connectée au rail + (directement ou via une chaîne)
     * - La cathode est connectée au rail - (directement ou via une chaîne)
     * - La tension disponible à l'anode est supérieure ou égale à la tension forward
     */
    checkPowerState(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return;
        }
        visited.add(this.id);
        
        // Vérifier si la LED est connectée à Vsum (cas spécial)
        if (this.isPinConnected('anode')) {
            const anodeConnection = this.getPinConnection('anode');
            if (anodeConnection && anodeConnection.component && anodeConnection.component.type === 'vsum') {
                // Si connectée à Vsum, utiliser directement la tension de Vsum
                const vsum = anodeConnection.component;
                const vsumVoltage = vsum.getVoltage ? vsum.getVoltage() : null;
                const forwardVoltage = this.properties.forwardVoltage || 2.0;
                
                // Vérifier les connexions aux rails
                const anodeToPositive = this.isAnodeConnectedToPositive();
                const cathodeToNegative = this.isCathodeConnectedToNegative();
                
                // Obtenir le courant depuis Vsum
                const totalCurrent = vsum.getTotalCurrent ? vsum.getTotalCurrent() : null;
                
                // La LED s'allume si :
                // 1. Connectée aux deux rails
                // 2. Tension Vsum >= forward voltage
                // 3. Courant > 0
                const hasEnoughVoltage = vsumVoltage !== null && vsumVoltage !== undefined && vsumVoltage >= forwardVoltage;
                const hasCurrent = totalCurrent !== null && totalCurrent !== undefined && totalCurrent > 0;
                const shouldBeOn = anodeToPositive && cathodeToNegative && hasEnoughVoltage && hasCurrent;
                
                // Log pour déboguer
                if (this.properties.color === '#ff9800') { // LED orange de sortie
                    console.log(`LED de sortie (Vsum) - vsumVoltage: ${vsumVoltage}V, forwardVoltage: ${forwardVoltage}V, current: ${totalCurrent ? (totalCurrent * 1000).toFixed(3) : 0}mA, shouldBeOn: ${shouldBeOn}`);
                    console.log(`  - anodeToPositive: ${anodeToPositive}, cathodeToNegative: ${cathodeToNegative}`);
                    console.log(`  - hasEnoughVoltage: ${hasEnoughVoltage}, hasCurrent: ${hasCurrent}`);
                }
                
                if (shouldBeOn !== this.properties.isOn) {
                    this.properties.isOn = shouldBeOn;
                    this.updateVisualState();
                }
                
                // Mettre à jour les composants connectés
                if (this.pinConnections) {
                    for (const [, connection] of this.pinConnections.entries()) {
                        if (connection.component && connection.component.checkPowerState) {
                            connection.component.checkPowerState(visited);
                        }
                    }
                }
                return;
            }
        }
        
        // Utiliser SeriesCircuit pour les autres cas
        if (typeof SeriesCircuit !== 'undefined') {
            const seriesCircuit = SeriesCircuit.fromComponent(this);
            if (seriesCircuit && seriesCircuit.components.length > 0) {
                const { voltages, current } = seriesCircuit.calculateVoltages();
                // La tension à l'anode de cette LED
                const anodeVoltage = voltages[this.id] || this.getAnodeVoltage(new Set());
                const forwardVoltage = this.properties.forwardVoltage || 2.0;
                
                // Vérifier les connexions aux rails
                const anodeToPositive = this.isAnodeConnectedToPositive();
                const cathodeToNegative = this.isCathodeConnectedToNegative();
                
                // La LED s'allume si :
                // 1. Connectée aux deux rails
                // 2. Tension anode >= forward voltage
                // 3. Courant > 0
                const hasEnoughVoltage = anodeVoltage !== null && anodeVoltage !== undefined && anodeVoltage >= forwardVoltage;
                const hasCurrent = current !== null && current !== undefined && current > 0;
                const shouldBeOn = anodeToPositive && cathodeToNegative && hasEnoughVoltage && hasCurrent;
                
                // Log pour déboguer
                if (this.properties.color === '#ff9800') { // LED orange de sortie
                    console.log(`LED de sortie (SeriesCircuit) - anodeVoltage: ${anodeVoltage}V, forwardVoltage: ${forwardVoltage}V, current: ${current ? (current * 1000).toFixed(3) : 0}mA, shouldBeOn: ${shouldBeOn}`);
                    console.log(`  - anodeToPositive: ${anodeToPositive}, cathodeToNegative: ${cathodeToNegative}`);
                    console.log(`  - hasEnoughVoltage: ${hasEnoughVoltage}, hasCurrent: ${hasCurrent}`);
                }
                
                if (shouldBeOn !== this.properties.isOn) {
                    this.properties.isOn = shouldBeOn;
                    this.updateVisualState();
                }
                
                // Mettre à jour les composants connectés
                if (this.pinConnections) {
                    for (const [, connection] of this.pinConnections.entries()) {
                        if (connection.component && connection.component.checkPowerState) {
                            connection.component.checkPowerState(visited);
                        }
                    }
                }
                return;
            }
        }
        
        // Fallback : méthode originale
        const anodeToPositive = this.isAnodeConnectedToPositive();
        const cathodeToNegative = this.isCathodeConnectedToNegative();
        
        if (!anodeToPositive || !cathodeToNegative) {
            if (this.properties.isOn) {
                this.properties.isOn = false;
                this.updateVisualState();
            }
            if (this.properties.color === '#ff9800') {
                console.log(`LED de sortie - anodeToPositive: ${anodeToPositive}, cathodeToNegative: ${cathodeToNegative}`);
            }
            if (this.pinConnections) {
                for (const [pinId, connection] of this.pinConnections.entries()) {
                    if (connection.component && connection.component.checkPowerState) {
                        connection.component.checkPowerState(visited);
                    }
                }
            }
            return;
        }
        
        const anodeVoltage = this.getAnodeVoltage(new Set());
        const forwardVoltage = this.properties.forwardVoltage || 2.0;
        const hasEnoughVoltage = anodeVoltage !== null && anodeVoltage !== undefined && anodeVoltage >= forwardVoltage;
        const shouldBeOn = anodeToPositive && cathodeToNegative && hasEnoughVoltage;
        
        if (this.properties.color === '#ff9800') {
            console.log(`LED de sortie - anodeVoltage: ${anodeVoltage}V, forwardVoltage: ${forwardVoltage}V, hasEnoughVoltage: ${hasEnoughVoltage}, shouldBeOn: ${shouldBeOn}`);
        }
        
        if (shouldBeOn !== this.properties.isOn) {
            this.properties.isOn = shouldBeOn;
            this.updateVisualState();
        }
        
        // Si cette LED est connectée à d'autres composants, mettre à jour leur état aussi
        if (this.pinConnections) {
            for (const [pinId, connection] of this.pinConnections.entries()) {
                if (connection.component && connection.component.checkPowerState) {
                    // Passer le Set visited pour éviter les cycles
                    connection.component.checkPowerState(visited);
                }
            }
        }
    }
    
    /**
     * Mettre à jour l'état visuel de la LED
     */
    updateVisualState() {
        if (!this.domElement) {
            return;
        }
        
        const isOn = this.properties.isOn;
        const hasPositive = this.powerConnection.positive !== null;
        const hasNegative = this.powerConnection.negative !== null;
        const anodeConnected = hasPositive || this.isPinConnected('anode');
        const cathodeConnected = hasNegative || this.isPinConnected('cathode');
        const color = this.properties.color;
        
        // Déterminer la couleur et l'état
        let ledColor;
        let iconChar;
        
        if (isOn) {
            // LED allumée
            ledColor = color;
            iconChar = '●';
            this.domElement.classList.add('led-on');
            this.domElement.classList.remove('led-partial');
        } else if (anodeConnected || cathodeConnected) {
            // Connexion partielle (une seule connexion)
            ledColor = '#ffa500'; // Orange pour indiquer connexion partielle
            iconChar = '◐';
            this.domElement.classList.add('led-partial');
            this.domElement.classList.remove('led-on');
        } else {
            // Pas de connexion
            ledColor = 'gray';
            iconChar = '○';
            this.domElement.classList.remove('led-on', 'led-partial');
        }
        
        // Mettre à jour l'icône
        const icon = this.domElement.querySelector('.led-icon');
        if (icon) {
            icon.style.color = ledColor;
            icon.textContent = iconChar;
        }
    }
    
    /**
     * Obtenir les informations de la LED
     * @returns {string} - Informations formatées
     */
    getInfo() {
        // Appeler la méthode parente qui affiche déjà les entrées/sorties avec U et I
        let info = super.getInfo();
        
        // Ajouter les informations spécifiques à la LED
        info += `\n\nCouleur: ${this.properties.color}`;
        info += `\nÉtat: ${this.properties.isOn ? 'ALLUMÉE' : 'ÉTEINTE'}`;
        
        // Informations de connexion (optionnel, car déjà visible dans les entrées/sorties)
        if (this.powerConnection.positive) {
            info += `\n\nRail + connecté: ${this.powerConnection.positive}`;
        }
        if (this.powerConnection.negative) {
            info += `\nRail - connecté: ${this.powerConnection.negative}`;
        }
        
        return info;
    }
    
    /**
     * Obtenir la tension sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getPinVoltage(pinId, pinType, visited = null) {
        // Si visited n'est pas fourni, créer un nouveau Set pour cet appel
        // Sinon, utiliser le Set partagé pour éviter les récursions infinies
        const visitedSet = visited || new Set();
        
        if (pinId === 'anode' && pinType === 'input') {
            const voltage = this.getAnodeVoltage(visitedSet);
            return voltage !== null && voltage !== undefined ? voltage : null;
        } else if (pinId === 'cathode' && pinType === 'output') {
            const voltage = this.getCathodeVoltage(visitedSet);
            return voltage !== null && voltage !== undefined ? voltage : null;
        }
        return null;
    }
    
    /**
     * Obtenir l'intensité sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getPinCurrent(pinId, pinType) {
        if (pinId === 'anode' && pinType === 'input') {
            return this.getAnodeCurrent();
        } else if (pinId === 'cathode' && pinType === 'output') {
            return this.getCathodeCurrent();
        }
        return null;
    }
    
    /**
     * Obtenir la tension sur l'anode (entrée)
     * @param {Set} visited - Composants déjà visités (pour éviter les récursions infinies)
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getAnodeVoltage(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Si connecté directement au rail positif
        if (this.powerConnection.positive) {
            const voltage = (typeof window !== 'undefined' && window.POWER_CONFIG) 
                ? window.POWER_CONFIG.positiveVoltage 
                : 5.0;
            return voltage;
        }
        
        // Si la cathode est connectée à GND, calculer la tension d'anode
        // Tension anode = tension cathode + forward voltage
        if (this.isPinConnected('cathode')) {
            const cathodeConnection = this.getPinConnection('cathode');
            if (cathodeConnection && cathodeConnection.component) {
                // Si la cathode est connectée directement au rail GND
                if (cathodeConnection.component.isRail && cathodeConnection.component.id === 'rail-negative') {
                    const forwardVoltage = this.properties.forwardVoltage || 2.0;
                    // Tension anode = 0V (cathode) + forward voltage
                    return forwardVoltage;
                }
                // Si la cathode est connectée à GND via un autre composant
                if (this.isCathodeConnectedToNegative && this.isCathodeConnectedToNegative(visited)) {
                    const forwardVoltage = this.properties.forwardVoltage || 2.0;
                    // Tension anode = 0V (cathode) + forward voltage
                    return forwardVoltage;
                }
            }
        }
        
        // Si connecté à un autre composant via pin-à-pin (pour les autres cas)
        if (this.isPinConnected('anode')) {
            const connection = this.getPinConnection('anode');
            
            if (connection && connection.component) {
                // Utiliser la méthode générique getPinVoltage avec le Set visited partagé
                if (connection.component.getPinVoltage) {
                    const pinVoltage = connection.component.getPinVoltage(connection.pinId, 'output', visited);
                    if (pinVoltage !== null && pinVoltage !== undefined) {
                        return pinVoltage;
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Obtenir l'intensité sur l'anode (entrée)
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getAnodeCurrent() {
        // Vérifier si la LED est allumée (a une connexion complète)
        const anodeConnected = this.powerConnection.positive || this.isPinConnected('anode');
        const cathodeConnected = this.powerConnection.negative || this.isPinConnected('cathode');
        
        if (this.properties.isOn && anodeConnected && cathodeConnected) {
            // Si la LED est allumée, retourner le courant nominal
            return this.properties.current || 0.02; // 20mA par défaut
        }
        return null;
    }
    
    /**
     * Obtenir la tension sur la cathode (sortie)
     * @param {Set} visited - Composants déjà visités (pour éviter les récursions infinies)
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getCathodeVoltage(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // PRIORITÉ : Calculer d'abord la tension théorique de sortie de la LED
        // (anode - chute de tension forward) même si connectée au rail GND
        // La tension de sortie de la LED est indépendante de la connexion au rail
        const anodeConnectedToRail = !!this.powerConnection.positive;
        const anodeConnectedToComponent = this.isPinConnected('anode');
        const anodeConnected = anodeConnectedToRail || anodeConnectedToComponent;
        
        if (anodeConnected) {
            let anodeVoltage = null;
            
            // Si connecté directement au rail, utiliser la tension du rail directement
            if (anodeConnectedToRail) {
                anodeVoltage = (typeof window !== 'undefined' && window.POWER_CONFIG) 
                    ? window.POWER_CONFIG.positiveVoltage 
                    : 5.0;
            } else {
                // Si connecté via pin-à-pin, utiliser getPinVoltage avec un nouveau Set visited
                // pour éviter que getAnodeVoltage voie la LED comme déjà visitée
                const anodeVisited = new Set(visited);
                anodeVisited.delete(this.id); // Retirer la LED du Set pour permettre la vérification de l'anode
                anodeVoltage = this.getPinVoltage('anode', 'input', anodeVisited);
            }
            
            if (anodeVoltage !== null && anodeVoltage !== undefined) {
                const forwardVoltage = this.properties.forwardVoltage || 2.0;
                
                // Toujours calculer la tension de sortie théorique (anode - forwardVoltage)
                // même si la LED n'est pas allumée, pour l'affichage
                // Si la LED est allumée, cette valeur est correcte
                // Si la LED n'est pas allumée (tension insuffisante), on calcule quand même la valeur théorique
                const cathodeVoltage = anodeVoltage - forwardVoltage;
                const result = Math.max(0, cathodeVoltage);
                
                return result;
            }
        }
        
        // Si pas d'anode connectée mais cathode connectée à un autre composant, propager la tension
        // (cas rare : cathode connectée sans anode)
        if (this.isPinConnected('cathode')) {
            const connection = this.getPinConnection('cathode');
            if (connection && connection.component) {
                // Pour une LED, si on est connecté à une anode (input), obtenir sa tension
                if (connection.component.type === 'led' && connection.pinId === 'anode') {
                    const anodeVoltage = connection.component.getAnodeVoltage(visited);
                    return anodeVoltage;
                }
                // Sinon, utiliser la méthode générique avec le Set visited partagé
                if (connection.component.getPinVoltage) {
                    const pinVoltage = connection.component.getPinVoltage(connection.pinId, 'input', visited);
                    return pinVoltage;
                }
            }
        }
        
        // Si connecté directement au rail négatif mais pas d'anode connectée
        // (cas où la LED n'a que la cathode connectée au GND)
        if (this.powerConnection.negative) {
            const voltage = (typeof window !== 'undefined' && window.POWER_CONFIG) 
                ? window.POWER_CONFIG.negativeVoltage 
                : 0.0;
            return voltage;
        }
        
        return null;
    }
    
    /**
     * Obtenir l'intensité sur la cathode (sortie)
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getCathodeCurrent() {
        // L'intensité sur la cathode est la même que sur l'anode (circuit série)
        return this.getAnodeCurrent();
    }
    
    /**
     * Obtenir la tension du composant (différence de potentiel)
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getVoltage() {
        const visited = new Set();
        const anodeVoltage = this.getAnodeVoltage(visited);
        visited.clear(); // Réinitialiser pour la cathode
        const cathodeVoltage = this.getCathodeVoltage(visited);
        
        if (anodeVoltage !== null && cathodeVoltage !== null) {
            // Tension aux bornes de la LED = U_anode - U_cathode
            return anodeVoltage - cathodeVoltage;
        }
        return null;
    }
    
    /**
     * Obtenir l'intensité du composant
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getCurrent() {
        return this.getAnodeCurrent();
    }
    
    /**
     * Retirer la LED de la breadboard
     * @param {Object} breadboardState - État de la breadboard
     */
    remove(breadboardState) {
        // Réinitialiser les connexions
        this.powerConnection.positive = null;
        this.powerConnection.negative = null;
        this.anode = null;
        this.cathode = null;
        this.properties.isOn = false;
        
        super.remove(breadboardState);
    }
}

// Exporter la classe pour utilisation globale
if (typeof window !== 'undefined') {
    window.LED = LED;
}



/**
 * Composant Vsum - Nœud Sommateur (Summing Node)
 * 
 * Un nœud sommateur est un point du circuit qui additionne des courants ou des tensions
 * via des résistances. Ce type de circuit apparaît souvent dans :
 * - Les comparateurs (LM339, LM393...)
 * - Les amplis op en configuration sommateur
 * - Les circuits logiques analogiques (somme pondérée)
 * - Les réseaux R-2R, les DAC, etc.
 * 
 * Dans ce simulateur, Vsum représente un réseau de résistances sommateur (resistor summing network)
 * où plusieurs signaux → résistances → Vsum → entrée d'un comparateur/transistor/LED.
 * 
 * Le nœud sommateur :
 * - Additionne les courants de toutes les entrées (loi de Kirchhoff)
 * - Calcule la tension au nœud en fonction des résistances et tensions d'entrée
 * - Peut avoir plusieurs entrées et une sortie vers la charge (LED, GND, etc.)
 */
class Vsum extends Component {
    /**
     * Constructeur de Vsum
     * @param {string} id - Identifiant unique de Vsum
     * @param {Object} config - Configuration de Vsum
     */
    constructor(id, config = {}) {
        // Créer des pins dynamiques (on peut en ajouter plus tard)
        const inputPins = config.inputPins || [
            { id: 'input1', name: 'Entrée 1', type: 'input' },
            { id: 'input2', name: 'Entrée 2', type: 'input' },
            { id: 'input3', name: 'Entrée 3', type: 'input' }
        ];
        
        super(id, 'Vsum', {
            type: 'vsum',
            pins: [
                ...inputPins,
                { id: 'output', name: 'Sortie (GND)', type: 'output' }
            ],
            properties: {
                voltage: 0,
                current: 0,
                inputCount: inputPins.length
            },
            ...config
        });
        
        // Trou associé à Vsum
        this.holeId = null;
    }
    
    /**
     * Obtenir les trous requis pour placer Vsum
     * Vsum occupe un seul trou
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis
     */
    getRequiredHoles(position) {
        return [position.holeId];
    }
    
    /**
     * Obtenir le HTML du composant Vsum
     * @returns {string} - HTML de Vsum
     */
    getComponentHTML() {
        return `
            <div class="component-icon vsum-icon" style="color: #667eea; font-weight: bold;">
                Σ
            </div>
            <div class="component-label">Vsum</div>
        `;
    }
    
    /**
     * Placer Vsum sur la breadboard
     * @param {string} holeId - Identifiant du trou où placer Vsum
     * @param {Object} breadboardState - État de la breadboard
     * @returns {boolean} - True si le placement a réussi
     */
    place(holeId, breadboardState) {
        const success = super.place(holeId, breadboardState);
        
        if (success) {
            this.holeId = holeId;
        }
        
        return success;
    }
    
    /**
     * Obtenir la tension sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @param {Set} visited - Composants déjà visités (pour éviter les récursions infinies)
     * @returns {number|null} - Tension en Volts ou null si non connecté
     */
    getPinVoltage(pinId, pinType, visited = null) {
        const visitedSet = visited || new Set();
        
        // Protection contre les récursions infinies
        if (visitedSet.has(this.id)) {
            return null;
        }
        visitedSet.add(this.id);
        
        // Pour Vsum, tous les pins d'entrée ont la même tension (c'est un nœud)
        if (pinType === 'input' && pinId.startsWith('input')) {
            return this.getInputVoltage(pinId, visitedSet);
        } else if (pinType === 'output' && pinId === 'output') {
            // La sortie de Vsum est connectée au rail - (GND)
            return this.getOutputVoltage(visitedSet);
        }
        
        return null;
    }
    
    /**
     * Obtenir la tension à une entrée de Vsum
     * @param {string} pinId - Identifiant du pin d'entrée
     * @param {Set} visited - Composants déjà visités
     * @returns {number|null} - Tension en Volts
     */
    getInputVoltage(pinId, visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Si ce pin est connecté, obtenir la tension du composant connecté
        if (this.isPinConnected(pinId)) {
            const connection = this.getPinConnection(pinId);
            if (connection && connection.component) {
                // Obtenir la tension de sortie du composant connecté
                // Créer un nouveau Set visited pour éviter que le composant connecté voie Vsum comme déjà visité
                const componentVisited = new Set(visited);
                componentVisited.delete(this.id); // Retirer Vsum du Set pour permettre la vérification
                if (connection.component.getPinVoltage) {
                    const sourceVoltage = connection.component.getPinVoltage(connection.pinId, 'output', componentVisited);
                    if (sourceVoltage !== null && sourceVoltage !== undefined) {
                        return sourceVoltage;
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Obtenir la tension théorique au nœud sommateur avant connexion à la charge
     * 
     * Dans un réseau sommateur, la tension au nœud est calculée selon la formule :
     * V_sum = (V1/R1 + V2/R2 + V3/R3 + ...) / (1/R1 + 1/R2 + 1/R3 + ...)
     * 
     * Cette méthode calcule la tension théorique au nœud en considérant Vsum comme flottant
     * (sans charge connectée). C'est la tension qu'un multimètre mesurerait avant connexion à GND.
     * 
     * @returns {number|null} - Tension théorique en Volts
     */
    getTheoreticalVoltage() {
        // Calculer la tension théorique au nœud sommateur selon la formule :
        // V_sum = Σ(Vi/Ri) / Σ(1/Ri)
        // où Vi = tension d'entrée de la résistance i, Ri = valeur de la résistance i
        
        const resistorData = [];
        
        // Parcourir toutes les entrées pour obtenir les tensions et résistances
        for (const pin of this.pins) {
            if (pin.type === 'input' && this.isPinConnected(pin.id)) {
                const connection = this.getPinConnection(pin.id);
                if (connection && connection.component && connection.component.type === 'resistance') {
                    const resistor = connection.component;
                    const inputVisited = new Set();
                    inputVisited.add(this.id); // Empêcher la récursion avec Vsum
                    const resistorInputVoltage = resistor.getInputVoltage(inputVisited);
                    const resistance = resistor.properties.resistance || 0;
                    
                    if (resistorInputVoltage !== null && resistorInputVoltage !== undefined && resistance > 0) {
                        resistorData.push({
                            voltage: resistorInputVoltage,
                            resistance: resistance
                        });
                    }
                }
            }
        }
        
        if (resistorData.length === 0) {
            return null;
        }
        
        // Calculer selon la formule du nœud sommateur
        // V_sum = Σ(Vi/Ri) / Σ(1/Ri)
        let sumViRi = 0; // Somme des Vi/Ri
        let sum1Ri = 0;  // Somme des 1/Ri
        
        for (const data of resistorData) {
            sumViRi += data.voltage / data.resistance;
            sum1Ri += 1 / data.resistance;
        }
        
        if (sum1Ri > 0) {
            const result = sumViRi / sum1Ri;
            // Arrondir pour éviter les erreurs de précision flottante (ex: 3.0000000000000004 → 3.0)
            return Math.round(result * 1000000) / 1000000;
        }
        
        // Fallback : si toutes les tensions sont identiques, retourner cette valeur
        const allSame = resistorData.every(d => Math.abs(d.voltage - resistorData[0].voltage) < 0.001);
        if (allSame) {
            return resistorData[0].voltage;
        }
        
        return null;
    }
    
    /**
     * Obtenir la tension réelle au nœud sommateur (après connexion à la charge)
     * 
     * La tension réelle au nœud sommateur est déterminée par :
     * 1. Les sources (résistances connectées aux entrées)
     * 2. La charge connectée à la sortie (LED, GND, etc.)
     * 
     * Si une LED est connectée, elle impose sa forward voltage au nœud.
     * Si connecté directement à GND, la tension est 0V.
     * Sinon, la tension est calculée selon le réseau sommateur.
     * 
     * @returns {number|null} - Tension réelle en Volts (comme mesurée par un multimètre)
     */
    getVoltage() {
        // Calculer la tension à Vsum comme un multimètre la mesurerait
        // La tension à Vsum est déterminée par l'équilibre entre les sources (résistances) et la charge (LED)
        
        // Si Vsum est connecté directement au rail GND, la tension est 0V
        if (this.isPinConnected('output')) {
            const connection = this.getPinConnection('output');
            if (connection && connection.component) {
                // Si connecté directement au rail GND
                if (connection.component.isRail && connection.component.id === 'rail-negative') {
                    return 0.0;
                }
            }
        }
        
        // Calculer la tension à Vsum en résolvant le système d'équations
        // 1. Obtenir toutes les résistances connectées et leurs tensions d'entrée
        const resistors = [];
        for (const pin of this.pins) {
            if (pin.type === 'input' && this.isPinConnected(pin.id)) {
                const connection = this.getPinConnection(pin.id);
                if (connection && connection.component && connection.component.type === 'resistance') {
                    const resistor = connection.component;
                    // Obtenir la tension d'entrée de la résistance (sans passer par Vsum)
                    const inputVisited = new Set();
                    inputVisited.add(this.id);
                    const resistorInputVoltage = resistor.getInputVoltage(inputVisited);
                    const resistance = resistor.properties.resistance;
                    if (resistorInputVoltage !== null && resistorInputVoltage !== undefined && resistance > 0) {
                        resistors.push({ inputVoltage: resistorInputVoltage, resistance: resistance });
                    }
                }
            }
        }
        
        // 2. Obtenir la charge connectée (LED)
        let loadForwardVoltage = null;
        if (this.isPinConnected('output')) {
            const connection = this.getPinConnection('output');
            if (connection && connection.component && connection.component.type === 'led') {
                const led = connection.component;
                loadForwardVoltage = led.properties.forwardVoltage || 2.0;
            }
        }
        
        // 3. Calculer la tension à Vsum
        if (resistors.length > 0) {
            if (loadForwardVoltage !== null) {
                // Si une LED est connectée, la tension à Vsum = forward voltage de la LED
                // (car la LED impose sa tension au nœud si elle est allumée)
                return loadForwardVoltage;
            } else {
                // Si pas de charge, la tension à Vsum = moyenne des tensions d'entrée
                // (toutes les résistances ont la même tension d'entrée dans ce circuit)
                const avgInputVoltage = resistors.reduce((sum, r) => sum + r.inputVoltage, 0) / resistors.length;
                return avgInputVoltage;
            }
        }
        
        // Sinon, retourner la tension théorique au nœud
        return this.getTheoreticalVoltage();
    }
    
    /**
     * Obtenir la tension à la sortie de Vsum
     * La sortie de Vsum est connectée à la charge (LED), donc sa tension = tension à Vsum
     * @param {Set} visited - Composants déjà visités
     * @returns {number|null} - Tension en Volts
     */
    getOutputVoltage(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // La sortie de Vsum est connectée à la charge (LED)
        // La tension de sortie = tension à Vsum (qui est la tension de l'anode de la LED)
        // Utiliser getVoltage() pour obtenir la tension réelle à Vsum
        const vsumVoltage = this.getVoltage();
        if (vsumVoltage !== null && vsumVoltage !== undefined) {
            return vsumVoltage;
        }
        
        // Si getVoltage() ne fonctionne pas, vérifier si connecté directement au rail GND
        if (this.isPinConnected('output')) {
            const connection = this.getPinConnection('output');
            if (connection && connection.component) {
                // Si connecté directement au rail GND
                if (connection.component.isRail && connection.component.id === 'rail-negative') {
                    return 0.0;
                }
            }
        }
        
        // Par défaut, retourner la tension théorique
        return this.getTheoreticalVoltage();
    }
    
    /**
     * Obtenir le courant total au nœud sommateur
     * 
     * Selon la loi de Kirchhoff (KCL), la somme des courants entrant dans un nœud
     * est égale à la somme des courants sortant du nœud.
     * 
     * I_total = I1 + I2 + I3 + ... (addition des courants de toutes les entrées)
     * 
     * C'est le principe fondamental d'un nœud sommateur : additionner les courants.
     * 
     * @param {Set} visited - Composants déjà visités
     * @returns {number|null} - Courant total en Ampères (somme des courants entrants)
     */
    getTotalCurrent(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        let totalCurrent = 0;
        let hasConnection = false;
        
        // Parcourir tous les pins d'entrée
        for (const pin of this.pins) {
            if (pin.type === 'input' && this.isPinConnected(pin.id)) {
                hasConnection = true;
                const connection = this.getPinConnection(pin.id);
                if (connection && connection.component) {
                    // Obtenir le courant de sortie du composant connecté
                    if (connection.component.getPinCurrent) {
                        const current = connection.component.getPinCurrent(connection.pinId, 'output', visited);
                        if (current !== null && current !== undefined && !isNaN(current)) {
                            totalCurrent += current;
                        }
                    }
                }
            }
        }
        
        return hasConnection ? totalCurrent : null;
    }
    
    /**
     * Obtenir l'intensité sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getPinCurrent(pinId, pinType) {
        if (pinType === 'input' && pinId.startsWith('input')) {
            // Pour une entrée, obtenir le courant du composant connecté
            if (this.isPinConnected(pinId)) {
                const connection = this.getPinConnection(pinId);
                if (connection && connection.component) {
                    if (connection.component.getPinCurrent) {
                        return connection.component.getPinCurrent(connection.pinId, 'output');
                    }
                }
            }
            return null;
        } else if (pinType === 'output' && pinId === 'output') {
            // Pour la sortie, retourner le courant total (somme de toutes les entrées)
            return this.getTotalCurrent();
        }
        
        return null;
    }
    
    /**
     * Vérifier si une entrée est connectée au rail + (récursif)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isInputConnectedToPositive(visited = new Set()) {
        // Vsum n'est jamais connecté au rail + directement
        // Mais on peut vérifier si une entrée est connectée au rail + via un composant
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Parcourir tous les pins d'entrée
        for (const pin of this.pins) {
            if (pin.type === 'input' && this.isPinConnected(pin.id)) {
                const connection = this.getPinConnection(pin.id);
                if (connection && connection.component) {
                    if (connection.component.isOutputConnectedToPositive) {
                        if (connection.component.isOutputConnectedToPositive(visited)) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier si la sortie est connectée au rail - (récursif)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail -
     */
    isOutputConnectedToNegative(visited = new Set()) {
        // Vsum est toujours connecté au rail - (GND)
        return true;
    }
    
    /**
     * Obtenir le trou associé à un pin
     * @param {string} pinId - Identifiant du pin
     * @returns {string|null} - Identifiant du trou ou null
     */
    getHoleForPin(pinId) {
        // Tous les pins de Vsum sont sur le même trou
        return this.holeId || this.position.holeId || null;
    }
    
    /**
     * Ajouter un nouveau pin d'entrée à Vsum
     * @param {string} pinId - Identifiant du nouveau pin
     * @param {string} pinName - Nom du nouveau pin
     */
    addInputPin(pinId, pinName) {
        const newPin = {
            id: pinId,
            name: pinName || `Entrée ${this.pins.filter(p => p.type === 'input').length + 1}`,
            type: 'input'
        };
        this.pins.push(newPin);
        this.properties.inputCount = this.pins.filter(p => p.type === 'input').length;
    }
}

// Exporter la classe pour utilisation globale
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vsum;
}


/**
 * Composant Résistance - Hérite de Component
 * Une résistance a une entrée et une sortie
 * Elle réduit la tension selon la loi d'Ohm : U = R × I
 */
class Resistance extends Component {
    /**
     * Constructeur de la Résistance
     * @param {string} id - Identifiant unique de la résistance
     * @param {Object} config - Configuration de la résistance
     */
    constructor(id, config = {}) {
        super(id, 'Résistance', {
            type: 'resistance',
            pins: [
                { id: 'input', name: 'Entrée', type: 'input' },
                { id: 'output', name: 'Sortie', type: 'output' }
            ],
            properties: {
                resistance: config.resistance || 1000, // Résistance en ohms (1kΩ par défaut)
                voltage: config.voltage || 0,
                current: config.current || 0,
                tolerance: config.tolerance || 5, // Tolérance en %
                power: config.power || 0.25 // Puissance nominale en watts (1/4W par défaut)
            },
            ...config
        });
        
        // Pins spécifiques à la résistance
        this.inputHole = null; // Trou connecté à l'entrée
        this.outputHole = null; // Trou connecté à la sortie
    }
    
    /**
     * Obtenir les trous requis pour placer la résistance
     * Une résistance nécessite 2 trous (entrée et sortie)
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis
     */
    getRequiredHoles(position) {
        // Pour une résistance, on a besoin de 2 trous adjacents
        // L'entrée sera sur le trou sélectionné
        // La sortie sera sur le trou de la colonne suivante (même rangée)
        
        const { row, column, group, holeId } = position;
        const columns = ['A', 'B', 'C', 'D', 'E'];
        const columnIndex = columns.indexOf(column);
        
        // Si on est sur la dernière colonne (E), on ne peut pas placer la résistance
        if (columnIndex === columns.length - 1) {
            return [holeId]; // Retourner seulement le trou sélectionné
        }
        
        // Trou suivant (colonne suivante)
        const nextColumn = columns[columnIndex + 1];
        const outputHoleId = `central-${row}-${nextColumn}-${group}`;
        
        return [holeId, outputHoleId];
    }
    
    /**
     * Obtenir le HTML du composant Résistance
     * @returns {string} - HTML de la résistance
     */
    getComponentHTML() {
        const resistance = this.properties.resistance;
        let displayValue = '';
        
        // Formater la valeur de résistance
        if (resistance >= 1000000) {
            displayValue = `${(resistance / 1000000).toFixed(1)}MΩ`;
        } else if (resistance >= 1000) {
            displayValue = `${(resistance / 1000).toFixed(1)}kΩ`;
        } else {
            displayValue = `${resistance}Ω`;
        }
        
        return `
            <div class="component-icon resistance-icon">⏱</div>
            <div class="component-label">${displayValue}</div>
        `;
    }
    
    /**
     * Placer la résistance sur la breadboard
     * @param {string} holeId - Identifiant du trou où placer l'entrée
     * @param {Object} breadboardState - État de la breadboard
     * @returns {boolean} - True si le placement a réussi
     */
    place(holeId, breadboardState) {
        const success = super.place(holeId, breadboardState);
        
        if (success && this.position.holes.length >= 2) {
            // L'entrée est sur le premier trou
            this.inputHole = this.position.holes[0];
            // La sortie est sur le deuxième trou
            this.outputHole = this.position.holes[1];
        }
        
        return success;
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
        
        if (pinId === 'input' && pinType === 'input') {
            return this.getInputVoltage(visitedSet);
        } else if (pinId === 'output' && pinType === 'output') {
            return this.getOutputVoltage(visitedSet);
        }
        return null;
    }
    
    /**
     * Obtenir la tension à l'entrée de la résistance
     * @param {Set} visited - Composants déjà visités (pour éviter les cycles)
     * @returns {number|null} - Tension en Volts
     */
    getInputVoltage(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Si connecté directement à un rail positif
        if (this.isInputConnectedToPositive && this.isInputConnectedToPositive(visited)) {
            if (typeof window !== 'undefined' && window.POWER_CONFIG) {
                return window.POWER_CONFIG.positiveVoltage;
            }
            return 5.0; // Valeur par défaut
        }
        
        // Si connecté à un autre composant via pin-à-pin
        if (this.isPinConnected('input')) {
            const connection = this.getPinConnection('input');
            if (connection && connection.component) {
                // Obtenir la tension de sortie du composant connecté avec le Set visited partagé
                if (connection.component.getPinVoltage) {
                    const sourceVoltage = connection.component.getPinVoltage(connection.pinId, 'output', visited);
                    if (sourceVoltage !== null && sourceVoltage !== undefined) {
                        return sourceVoltage;
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Obtenir la tension à la sortie de la résistance
     * @param {Set} visited - Composants déjà visités (pour éviter les cycles)
     * @returns {number|null} - Tension en Volts
     */
    getOutputVoltage(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Utiliser SeriesCircuit pour calculer la tension de sortie
        if (typeof SeriesCircuit !== 'undefined') {
            const seriesCircuit = SeriesCircuit.fromComponent(this);
            if (seriesCircuit) {
                const { voltages } = seriesCircuit.calculateVoltages();
                // La tension de sortie de cette résistance est la tension après elle dans le circuit
                // Chercher la tension du composant suivant ou de la charge
                if (this.isPinConnected('output')) {
                    const connection = this.getPinConnection('output');
                    if (connection && connection.component) {
                        const nextComponent = connection.component;
                        if (voltages[nextComponent.id] !== undefined) {
                            return voltages[nextComponent.id];
                        }
                        // Si c'est la charge (LED), utiliser sa tension
                        if (nextComponent.type === 'led') {
                            return nextComponent.properties.forwardVoltage || 2.0;
                        }
                    }
                }
                // Sinon, utiliser la tension de la charge
                if (voltages['load'] !== undefined) {
                    return voltages['load'];
                }
            }
        }
        
        // Fallback : méthode originale
        const inputVisited = new Set(visited);
        inputVisited.delete(this.id);
        const inputVoltage = this.getInputVoltage(inputVisited);
        if (inputVoltage === null || inputVoltage === undefined) {
            return null;
        }
        
        // Si la sortie est connectée à un composant, obtenir sa tension
        if (this.isPinConnected('output')) {
            const connection = this.getPinConnection('output');
            if (connection && connection.component) {
                const componentVisited = new Set(visited);
                componentVisited.delete(this.id);
                
                if (connection.component.type === 'vsum') {
                    const vsum = connection.component;
                    if (vsum.getVoltage) {
                        const vsumVoltage = vsum.getVoltage();
                        if (vsumVoltage !== null && vsumVoltage !== undefined) {
                            return vsumVoltage;
                        }
                    }
                } else {
                    if (connection.component.getPinVoltage) {
                        const connectedVoltage = connection.component.getPinVoltage(connection.pinId, 'input', componentVisited);
                        if (connectedVoltage !== null && connectedVoltage !== undefined) {
                            return connectedVoltage;
                        }
                    }
                }
            }
        }
        
        return inputVoltage;
    }
    
    /**
     * Obtenir l'intensité sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getPinCurrent(pinId, pinType) {
        // Pour une résistance, le courant est le même en entrée et en sortie
        return this.getCurrent();
    }
    
    /**
     * Obtenir le courant qui traverse la résistance
     * @param {Set} visited - Composants déjà visités (pour éviter les cycles)
     * @returns {number|null} - Courant en Ampères
     */
    getCurrent(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Utiliser SeriesCircuit pour calculer le courant
        if (typeof SeriesCircuit !== 'undefined') {
            const seriesCircuit = SeriesCircuit.fromComponent(this);
            if (seriesCircuit) {
                const { current } = seriesCircuit.calculateVoltages();
                if (current !== null && current !== undefined && current > 0) {
                    return current;
                }
            }
        }
        
        // Fallback : méthode originale
        const inputVisited = new Set(visited);
        inputVisited.delete(this.id);
        const inputVoltage = this.getInputVoltage(inputVisited);
        if (inputVoltage === null || inputVoltage === undefined) {
            return null;
        }
        
        const outputVisited = new Set(visited);
        outputVisited.delete(this.id);
        const outputVoltage = this.getOutputVoltage(outputVisited);
        if (outputVoltage === null || outputVoltage === undefined) {
            return null;
        }
        
        const voltageDifference = inputVoltage - outputVoltage;
        if (voltageDifference <= 0) {
            return 0;
        }
        
        const current = voltageDifference / this.properties.resistance;
        
        return current;
    }
    
    /**
     * Vérifier si l'entrée est connectée au rail + (récursif)
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isInputConnectedToPositive(visited = new Set()) {
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si connecté à un autre composant via pin-à-pin
        if (this.isPinConnected('input')) {
            const connection = this.getPinConnection('input');
            if (connection && connection.component) {
                // Si connecté à une LED (via sa cathode), vérifier si l'anode de la LED est au rail +
                if (connection.component.type === 'led' && connection.pinId === 'cathode') {
                    const led = connection.component;
                    if (led.isAnodeConnectedToPositive) {
                        return led.isAnodeConnectedToPositive(visited);
                    }
                }
                // Pour les autres composants, vérifier si leur sortie est connectée au rail +
                if (connection.component.isOutputConnectedToPositive) {
                    return connection.component.isOutputConnectedToPositive(visited);
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
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si connecté à un autre composant via pin-à-pin
        if (this.isPinConnected('output')) {
            const connection = this.getPinConnection('output');
            if (connection && connection.component) {
                // Vérifier si c'est Vsum (point de convergence connecté au rail -)
                if (connection.component.type === 'vsum') {
                    // Vérifier si Vsum est connecté au rail -
                    if (connection.component.isOutputConnectedToNegative) {
                        return connection.component.isOutputConnectedToNegative(visited);
                    }
                    // Par défaut, Vsum est connecté au rail -
                    return true;
                }
                
                // Vérifier si le composant connecté est connecté au rail -
                if (connection.component.isInputConnectedToNegative) {
                    return connection.component.isInputConnectedToNegative(visited);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Obtenir le trou associé à un pin
     * @param {string} pinId - Identifiant du pin
     * @returns {string|null} - Identifiant du trou ou null
     */
    getHoleForPin(pinId) {
        if (pinId === 'input' && this.inputHole) {
            return this.inputHole;
        }
        if (pinId === 'output' && this.outputHole) {
            return this.outputHole;
        }
        
        // Par défaut, retourner le premier trou du composant
        if (this.position && this.position.holes && this.position.holes.length > 0) {
            return this.position.holes[0];
        }
        
        return this.position.holeId || null;
    }
}

// Exporter la classe pour utilisation globale
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Resistance;
}


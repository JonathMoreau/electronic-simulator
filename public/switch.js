/**
 * Composant Interrupteur (Switch) - Hérite de Component
 * Un interrupteur a une entrée et une sortie
 * Il peut être ouvert (circuit ouvert) ou fermé (circuit fermé)
 */
class Switch extends Component {
    /**
     * Constructeur de l'Interrupteur
     * @param {string} id - Identifiant unique de l'interrupteur
     * @param {Object} config - Configuration de l'interrupteur
     */
    constructor(id, config = {}) {
        super(id, 'Interrupteur', {
            type: 'switch',
            pins: [
                { id: 'input', name: 'Entrée', type: 'input' },
                { id: 'output', name: 'Sortie', type: 'output' }
            ],
            properties: {
                isClosed: config.isClosed !== undefined ? config.isClosed : true, // Par défaut fermé
                voltage: config.voltage || 0,
                current: config.current || 0
            },
            ...config
        });
        
        // Pins spécifiques à l'interrupteur
        this.inputHole = null; // Trou connecté à l'entrée
        this.outputHole = null; // Trou connecté à la sortie
    }
    
    /**
     * Obtenir les trous requis pour placer l'interrupteur
     * Un interrupteur nécessite 2 trous (entrée et sortie)
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis
     */
    getRequiredHoles(position) {
        // Pour un interrupteur, on a besoin de 2 trous adjacents
        // L'entrée sera sur le trou sélectionné
        // La sortie sera sur le trou de la colonne suivante (même rangée)
        
        const { row, column, group, holeId } = position;
        const columns = ['A', 'B', 'C', 'D', 'E'];
        const columnIndex = columns.indexOf(column);
        
        // Si on est sur la dernière colonne (E), on ne peut pas placer l'interrupteur
        if (columnIndex === columns.length - 1) {
            return [holeId]; // Retourner seulement le trou sélectionné
        }
        
        // Trou suivant (colonne suivante)
        const nextColumn = columns[columnIndex + 1];
        const outputHoleId = `central-${row}-${nextColumn}-${group}`;
        
        return [holeId, outputHoleId];
    }
    
    /**
     * Obtenir le HTML du composant Interrupteur
     * @returns {string} - HTML de l'interrupteur
     */
    getComponentHTML() {
        const isClosed = this.properties.isClosed;
        const status = isClosed ? 'Fermé' : 'Ouvert';
        const icon = isClosed ? '●' : '○';
        
        return `
            <div class="component-icon switch-icon" style="color: ${isClosed ? '#4caf50' : '#999'};">
                ${icon}
            </div>
            <div class="component-label">${status}</div>
        `;
    }
    
    /**
     * Placer l'interrupteur sur la breadboard
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
     * Basculer l'état de l'interrupteur (ouvrir/fermer)
     */
    toggle() {
        this.properties.isClosed = !this.properties.isClosed;
        this.updateVisualState();
    }
    
    /**
     * Mettre à jour l'état visuel de l'interrupteur
     */
    updateVisualState() {
        if (this.domElement) {
            this.domElement.innerHTML = this.getComponentHTML();
        }
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
        
        if (pinId === 'input' && pinType === 'input') {
            return this.getInputVoltage(visitedSet);
        } else if (pinId === 'output' && pinType === 'output') {
            return this.getOutputVoltage(visitedSet);
        }
        return null;
    }
    
    /**
     * Obtenir la tension à l'entrée de l'interrupteur
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
                // Vérifier si c'est un rail d'alimentation
                if (connection.component.isRail) {
                    // C'est un rail, retourner la tension du rail
                    if (connection.component.id === 'rail-positive') {
                        if (typeof window !== 'undefined' && window.POWER_CONFIG) {
                            return window.POWER_CONFIG.positiveVoltage;
                        }
                        return 5.0; // Valeur par défaut
                    }
                    return null;
                }
                
                // C'est un vrai composant, obtenir la tension de sortie avec le Set visited partagé
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
     * Obtenir la tension à la sortie de l'interrupteur
     * @param {Set} visited - Composants déjà visités (pour éviter les cycles)
     * @returns {number|null} - Tension en Volts
     */
    getOutputVoltage(visited = new Set()) {
        // Si l'interrupteur est ouvert, pas de tension en sortie
        if (!this.properties.isClosed) {
            return null;
        }
        
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Si l'interrupteur est fermé, la tension de sortie = tension d'entrée
        // Créer un nouveau Set visited pour éviter que l'interrupteur soit considéré comme déjà visité
        // car on veut obtenir la tension de l'entrée, pas de la sortie
        const inputVisited = new Set(visited);
        inputVisited.delete(this.id); // Retirer l'interrupteur du Set pour permettre la vérification de l'entrée
        const inputVoltage = this.getInputVoltage(inputVisited);
        return inputVoltage;
    }
    
    /**
     * Obtenir l'intensité sur un pin spécifique
     * @param {string} pinId - Identifiant du pin
     * @param {string} pinType - Type du pin ('input' ou 'output')
     * @returns {number|null} - Intensité en Ampères ou null si non connecté
     */
    getPinCurrent(pinId, pinType) {
        // Pour un interrupteur, le courant est le même en entrée et en sortie (si fermé)
        return this.getCurrent();
    }
    
    /**
     * Obtenir le courant qui traverse l'interrupteur
     * @param {Set} visited - Composants déjà visités (pour éviter les cycles)
     * @returns {number|null} - Courant en Ampères
     */
    getCurrent(visited = new Set()) {
        // Si l'interrupteur est ouvert, pas de courant
        if (!this.properties.isClosed) {
            return null;
        }
        
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return null;
        }
        visited.add(this.id);
        
        // Vérifier si l'interrupteur est dans un circuit fermé
        const inputVoltage = this.getInputVoltage(visited);
        if (inputVoltage === null || inputVoltage === undefined) {
            return null;
        }
        
        // Vérifier si la sortie est connectée à GND ou à un composant qui mène à GND
        if (!this.isOutputConnectedToNegative || !this.isOutputConnectedToNegative(visited)) {
            // Si la sortie n'est pas connectée à GND, pas de courant
            return null;
        }
        
        // Pour un interrupteur fermé idéal, le courant dépend du circuit connecté
        // On retourne null ici et laisser les composants connectés calculer le courant
        // En pratique, un interrupteur fermé a une résistance très faible (quasi-nulle)
        return null; // Le courant sera calculé par les composants connectés
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
                // Vérifier d'abord si c'est directement un rail d'alimentation
                if (connection.component.isRail && connection.component.id === 'rail-positive') {
                    return true;
                }
                
                // Vérifier si le composant connecté est connecté au rail +
                if (connection.component.isOutputConnectedToPositive) {
                    return connection.component.isOutputConnectedToPositive(visited);
                }
            }
        }
        
        return false;
    }
    
    /**
     * Vérifier si la sortie est connectée au rail + (récursif)
     * La sortie est connectée au rail + si l'interrupteur est fermé ET l'entrée est connectée au rail +
     * @param {Set} visited - Composants déjà visités
     * @returns {boolean} - True si connecté au rail +
     */
    isOutputConnectedToPositive(visited = new Set()) {
        // Si l'interrupteur est ouvert, la sortie n'est pas connectée au rail +
        if (!this.properties.isClosed) {
            return false;
        }
        
        // Protection contre les récursions infinies
        if (visited.has(this.id)) {
            return false;
        }
        visited.add(this.id);
        
        // Si l'interrupteur est fermé, la sortie est connectée au rail + si l'entrée l'est
        // Créer un nouveau Set visited pour éviter que l'interrupteur soit considéré comme déjà visité
        // car on veut vérifier la connexion de l'entrée, pas de la sortie
        const inputVisited = new Set(visited);
        inputVisited.delete(this.id); // Retirer l'interrupteur du Set pour permettre la vérification de l'entrée
        return this.isInputConnectedToPositive(inputVisited);
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
    module.exports = Switch;
}


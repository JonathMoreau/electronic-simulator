/**
 * Classe SeriesCircuit - Gère les calculs pour un montage en série
 * Simplifie les calculs de tension et courant en évitant les récursions complexes
 */
class SeriesCircuit {
    /**
     * Constructeur
     * @param {Array<Component>} components - Liste des composants dans l'ordre série
     * @param {Component} source - Composant source (rail + ou composant connecté au rail +)
     * @param {Component} load - Composant charge (rail - ou composant connecté au rail -)
     */
    constructor(components, source, load) {
        this.components = components; // Composants dans l'ordre série
        this.source = source; // Source de tension
        this.load = load; // Charge
    }
    
    /**
     * Calculer la tension à chaque point du circuit
     * @returns {Object} - Objet avec les tensions à chaque point
     */
    calculateVoltages() {
        const voltages = {};
        
        // Obtenir la tension de la source
        let sourceVoltage = 0;
        if (this.source) {
            if (this.source.isRail && this.source.id === 'rail-positive') {
                sourceVoltage = (typeof window !== 'undefined' && window.POWER_CONFIG)
                    ? window.POWER_CONFIG.positiveVoltage
                    : 5.0;
            } else if (this.source.type === 'switch' && this.source.properties.isClosed) {
                // Si c'est un interrupteur fermé, la tension de sortie = tension d'entrée
                if (this.source.getInputVoltage) {
                    sourceVoltage = this.source.getInputVoltage() || 0;
                } else {
                    sourceVoltage = (typeof window !== 'undefined' && window.POWER_CONFIG)
                        ? window.POWER_CONFIG.positiveVoltage
                        : 5.0;
                }
            } else if (this.source.getOutputVoltage) {
                sourceVoltage = this.source.getOutputVoltage() || 0;
            }
        }
        
        // Obtenir la tension de la charge (GND = 0V ou forward voltage de LED)
        let loadVoltage = 0;
        if (this.load) {
            if (this.load.isRail && this.load.id === 'rail-negative') {
                loadVoltage = 0;
            } else if (this.load.type === 'led') {
                // Si c'est une LED, la tension à la cathode = 0V (GND)
                // La tension à l'anode = forward voltage
                loadVoltage = 0; // La cathode est à GND
            } else if (this.load.getInputVoltage) {
                loadVoltage = this.load.getInputVoltage() || 0;
            }
        }
        
        // Calculer le courant total dans le circuit
        const totalResistance = this.calculateTotalResistance();
        const totalVoltageDrop = sourceVoltage - loadVoltage;
        
        // Pour les LEDs, on doit soustraire leur forward voltage de la tension disponible
        let totalLEDVoltageDrop = 0;
        for (const component of this.components) {
            if (component.type === 'led') {
                totalLEDVoltageDrop += component.properties.forwardVoltage || 2.0;
            }
        }
        
        // Tension disponible pour les résistances = source - load - forward voltages des LEDs
        const availableVoltageForResistors = sourceVoltage - loadVoltage - totalLEDVoltageDrop;
        const totalCurrent = totalResistance > 0 && availableVoltageForResistors > 0 
            ? availableVoltageForResistors / totalResistance 
            : 0;
        
        // Calculer la tension à chaque point
        let currentVoltage = sourceVoltage;
        voltages['source'] = sourceVoltage;
        
        for (let i = 0; i < this.components.length; i++) {
            const component = this.components[i];
            const voltageDrop = this.calculateVoltageDrop(component, totalCurrent);
            currentVoltage -= voltageDrop;
            
            // Pour une LED, la tension à l'anode = currentVoltage, à la cathode = currentVoltage - forwardVoltage
            if (component.type === 'led') {
                voltages[component.id] = currentVoltage; // Tension à l'anode
                voltages[component.id + '_cathode'] = currentVoltage - (component.properties.forwardVoltage || 2.0);
            } else {
                voltages[component.id] = currentVoltage;
            }
        }
        
        voltages['load'] = loadVoltage;
        
        return { voltages, current: totalCurrent };
    }
    
    /**
     * Calculer la résistance totale du circuit
     * @returns {number} - Résistance totale en ohms
     */
    calculateTotalResistance() {
        let totalResistance = 0;
        
        for (const component of this.components) {
            if (component.type === 'resistance') {
                totalResistance += component.properties.resistance || 0;
            } else if (component.type === 'led') {
                // Une LED allumée a une résistance dynamique, mais on peut l'ignorer pour simplifier
                // ou utiliser R = forwardVoltage / current
            }
        }
        
        return totalResistance;
    }
    
    /**
     * Calculer la chute de tension aux bornes d'un composant
     * @param {Component} component - Composant
     * @param {number} current - Courant qui traverse le composant
     * @returns {number} - Chute de tension en Volts
     */
    calculateVoltageDrop(component, current) {
        if (component.type === 'resistance') {
            // Loi d'Ohm : U = R × I
            return (component.properties.resistance || 0) * current;
        } else if (component.type === 'led') {
            // Une LED a une forward voltage fixe
            return component.properties.forwardVoltage || 2.0;
        } else if (component.type === 'switch') {
            // Un interrupteur fermé a une résistance très faible (négligeable)
            return 0;
        }
        
        return 0;
    }
    
    /**
     * Créer un SeriesCircuit à partir d'un composant en remontant/rédendant la chaîne
     * @param {Component} component - Composant de départ
     * @param {string} direction - 'forward' (vers la charge) ou 'backward' (vers la source)
     * @returns {SeriesCircuit|null} - Circuit série ou null si impossible
     */
    static fromComponent(component, direction = 'forward') {
        const components = [];
        const visited = new Set();
        
        let current = component;
        let source = null;
        let load = null;
        
        // Remonter vers la source
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            
            let previousComponent = null;
            
            // Pour une LED, remonter via l'anode
            if (current.type === 'led') {
                if (current.isPinConnected && current.isPinConnected('anode')) {
                    const connection = current.getPinConnection('anode');
                    if (connection && connection.component) {
                        previousComponent = connection.component;
                    }
                }
            } else {
                // Pour les autres composants, remonter via l'entrée
                if (current.isPinConnected && current.isPinConnected('input')) {
                    const connection = current.getPinConnection('input');
                    if (connection && connection.component) {
                        previousComponent = connection.component;
                    }
                }
            }
            
            if (previousComponent) {
                // Si c'est un rail, c'est la source
                if (previousComponent.isRail && previousComponent.id === 'rail-positive') {
                    source = previousComponent;
                    break;
                }
                // Si c'est un interrupteur connecté au rail +
                if (previousComponent.type === 'switch' && previousComponent.isInputConnectedToPositive) {
                    if (previousComponent.isInputConnectedToPositive(new Set())) {
                        // L'interrupteur est la source effective
                        source = previousComponent;
                        components.unshift(previousComponent);
                        break;
                    }
                }
                current = previousComponent;
                components.unshift(current);
            } else {
                break;
            }
        }
        
        // Redescendre vers la charge
        current = component;
        visited.clear();
        
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            
            let nextComponent = null;
            
            // Pour une LED, descendre via la cathode
            if (current.type === 'led') {
                if (current.isPinConnected && current.isPinConnected('cathode')) {
                    const connection = current.getPinConnection('cathode');
                    if (connection && connection.component) {
                        nextComponent = connection.component;
                    }
                }
            } else if (current.type === 'vsum') {
                // Pour Vsum, descendre via la sortie
                if (current.isPinConnected && current.isPinConnected('output')) {
                    const connection = current.getPinConnection('output');
                    if (connection && connection.component) {
                        nextComponent = connection.component;
                    }
                }
            } else {
                // Pour les autres composants, descendre via la sortie
                if (current.isPinConnected && current.isPinConnected('output')) {
                    const connection = current.getPinConnection('output');
                    if (connection && connection.component) {
                        nextComponent = connection.component;
                    }
                }
            }
            
            if (nextComponent) {
                // Si c'est un rail, c'est la charge
                if (nextComponent.isRail && nextComponent.id === 'rail-negative') {
                    load = nextComponent;
                    break;
                }
                // Si c'est une LED connectée au rail -
                if (nextComponent.type === 'led' && nextComponent.isCathodeConnectedToNegative) {
                    if (nextComponent.isCathodeConnectedToNegative(new Set())) {
                        // La LED est la charge
                        load = nextComponent;
                        components.push(nextComponent);
                        break;
                    }
                }
                current = nextComponent;
                components.push(current);
            } else {
                break;
            }
        }
        
        // Ajouter le composant de départ s'il n'est pas déjà dans la liste
        if (!components.includes(component)) {
            // Trouver où l'insérer (après la source, avant la charge)
            const sourceIndex = source ? components.findIndex(c => c === source) : -1;
            if (sourceIndex >= 0) {
                components.splice(sourceIndex + 1, 0, component);
            } else {
                components.unshift(component);
            }
        }
        
        if (components.length > 0 || source || load) {
            return new SeriesCircuit(components, source, load);
        }
        
        return null;
    }
}

// Exporter pour utilisation globale
if (typeof window !== 'undefined') {
    window.SeriesCircuit = SeriesCircuit;
}


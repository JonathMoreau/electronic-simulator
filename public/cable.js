/**
 * Composant Cable - Hérite de Component
 * Un cable visualise une connexion entre deux composants
 */
class Cable extends Component {
    /**
     * Constructeur du Cable
     * @param {string} id - Identifiant unique du cable
     * @param {Object} config - Configuration du cable
     */
    constructor(id, config = {}) {
        super(id, 'Cable', {
            type: 'cable',
            pins: [
                { id: 'start', name: 'Début', type: 'input' },
                { id: 'end', name: 'Fin', type: 'output' }
            ],
            properties: {
                ...config.properties,
                color: config.color || '#4caf50', // Couleur par défaut (vert)
                connectedStart: null, // Composant de départ
                connectedEnd: null,   // Composant d'arrivée
                startPinId: null,     // Pin de départ
                endPinId: null        // Pin d'arrivée
            }
        });
        
        this.startComponent = null;
        this.endComponent = null;
        this.startPinId = null;
        this.endPinId = null;
        this.startHoleId = null; // Trou de départ (pour connexion au rail)
        this.endHoleId = null;   // Trou d'arrivée (pour connexion au rail)
        this.wireElement = null; // Élément SVG de la ligne
    }
    
    /**
     * Obtenir les trous requis pour placer le cable
     * Un cable n'occupe pas de trous physiques, il est juste visuel
     * @param {Object} position - Position de base
     * @returns {Array<string>} - Liste des holeIds requis (vide pour un câble)
     */
    getRequiredHoles(position) {
        // Un câble n'occupe pas de trous physiques, il est juste visuel
        return [];
    }
    
    /**
     * Obtenir le HTML du cable
     * Un câble n'a pas de représentation DOM directe, il est dessiné comme une ligne SVG
     * @returns {string} - HTML du cable (vide car dessiné séparément)
     */
    getComponentHTML() {
        // Le câble sera dessiné comme une ligne SVG, pas comme un composant DOM
        return '';
    }
    
    /**
     * Créer l'élément DOM pour le câble (ligne SVG)
     */
    createDOMElement(breadboardState = null) {
        if (!this.state.placed) {
            return;
        }
        
        // Le câble est dessiné comme une ligne SVG entre les trous
        // Utiliser un délai pour s'assurer que le DOM est prêt
        setTimeout(() => {
            this.updateWireVisualization();
        }, 100);
    }
    
    /**
     * Mettre à jour la visualisation du câble (ligne entre les trous)
     */
    updateWireVisualization() {
        // Obtenir les trous de départ et d'arrivée
        const startHole = this.getStartHole();
        const endHole = this.getEndHole();
        
        if (!startHole || !endHole) {
            console.log('Cable: trous manquants', { startHole: !!startHole, endHole: !!endHole });
            return;
        }
        
        // Supprimer l'ancienne ligne si elle existe
        const oldLine = document.getElementById(`cable-${this.id}`);
        if (oldLine) {
            oldLine.remove();
        }
        
        // Obtenir les positions des trous
        const startPos = this.getHolePosition(startHole);
        const endPos = this.getHolePosition(endHole);
        
        if (!startPos || !endPos) {
            console.log('Cable: positions manquantes', { startPos, endPos });
            return;
        }
        
        console.log('Cable: positions calculées', { startPos, endPos, cableId: this.id });
        
        // Créer ou obtenir le conteneur SVG
        let svgContainer = document.getElementById('cables-svg-container');
        if (!svgContainer) {
            const breadboard = document.getElementById('breadboard');
            if (!breadboard) {
                console.error('Cable: breadboard introuvable');
                return;
            }
            
            svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgContainer.id = 'cables-svg-container';
            svgContainer.setAttribute('width', breadboard.offsetWidth.toString());
            svgContainer.setAttribute('height', breadboard.offsetHeight.toString());
            svgContainer.style.position = 'absolute';
            svgContainer.style.top = '0';
            svgContainer.style.left = '0';
            svgContainer.style.width = '100%';
            svgContainer.style.height = '100%';
            svgContainer.style.pointerEvents = 'none';
            svgContainer.style.zIndex = '10';
            svgContainer.style.overflow = 'visible';
            breadboard.appendChild(svgContainer);
            console.log('Cable: conteneur SVG créé');
        }
        
        // Mettre à jour les dimensions du SVG si nécessaire
        const breadboard = document.getElementById('breadboard');
        if (breadboard) {
            svgContainer.setAttribute('width', breadboard.offsetWidth.toString());
            svgContainer.setAttribute('height', breadboard.offsetHeight.toString());
        }
        
        // Créer la ligne SVG
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.id = `cable-${this.id}`;
        line.setAttribute('x1', startPos.x.toString());
        line.setAttribute('y1', startPos.y.toString());
        line.setAttribute('x2', endPos.x.toString());
        line.setAttribute('y2', endPos.y.toString());
        line.setAttribute('stroke', this.properties.color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('data-cable-id', this.id);
        
        svgContainer.appendChild(line);
        
        this.wireElement = line;
        console.log('Cable: ligne SVG créée', { x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y });
    }
    
    /**
     * Obtenir le trou de départ du câble
     * @returns {HTMLElement|null} - Élément du trou de départ
     */
    getStartHole() {
        // Si un trou de départ est défini (pour connexion au rail)
        if (this.startHoleId) {
            const hole = document.getElementById(this.startHoleId);
            if (hole) return hole;
        }
        
        if (this.startComponent && this.startPinId) {
            const holeId = this.startComponent.getHoleForPin(this.startPinId);
            if (holeId) {
                const hole = document.getElementById(holeId);
                if (hole) return hole;
            }
        }
        
        // Sinon, utiliser le premier trou du câble
        if (this.position && this.position.holes && this.position.holes.length > 0) {
            return document.getElementById(this.position.holes[0]);
        }
        return null;
    }
    
    /**
     * Obtenir le trou d'arrivée du câble
     * @returns {HTMLElement|null} - Élément du trou d'arrivée
     */
    getEndHole() {
        // Si un trou d'arrivée est défini (pour connexion au rail)
        if (this.endHoleId) {
            const hole = document.getElementById(this.endHoleId);
            if (hole) return hole;
        }
        
        if (this.endComponent && this.endPinId) {
            const holeId = this.endComponent.getHoleForPin(this.endPinId);
            if (holeId) {
                const hole = document.getElementById(holeId);
                if (hole) return hole;
            }
        }
        
        // Sinon, utiliser le deuxième trou du câble
        if (this.position && this.position.holes && this.position.holes.length > 1) {
            return document.getElementById(this.position.holes[1]);
        }
        return null;
    }
    
    /**
     * Obtenir la position d'un trou dans le système de coordonnées de la breadboard
     * @param {HTMLElement} hole - Élément du trou
     * @returns {Object|null} - Position {x, y} ou null
     */
    getHolePosition(hole) {
        if (!hole) {
            return null;
        }
        
        const breadboard = document.getElementById('breadboard');
        if (!breadboard) {
            return null;
        }
        
        // Utiliser offsetLeft/offsetTop pour obtenir la position relative dans la breadboard
        // (plus fiable que getBoundingClientRect qui peut être affecté par le transform)
        let x = 0;
        let y = 0;
        let element = hole;
        while (element && element !== breadboard) {
            x += element.offsetLeft;
            y += element.offsetTop;
            element = element.offsetParent;
        }
        
        // Ajouter le centre du trou
        const holeWidth = hole.offsetWidth || 12;
        const holeHeight = hole.offsetHeight || 12;
        x += holeWidth / 2;
        y += holeHeight / 2;
        
        return { x, y };
    }
    
    /**
     * Connecter le début du cable à un composant
     * @param {Component} component - Composant de départ
     * @param {string} pinId - Pin du composant de départ
     */
    connectStart(component, pinId) {
        this.startComponent = component;
        this.startPinId = pinId;
        this.properties.connectedStart = component.id;
        this.properties.startPinId = pinId;
        
        // Mettre à jour la visualisation après un court délai pour que le DOM soit prêt
        setTimeout(() => {
            this.updateWireVisualization();
        }, 10);
    }
    
    /**
     * Connecter la fin du cable à un composant
     * @param {Component} component - Composant d'arrivée
     * @param {string} pinId - Pin du composant d'arrivée
     */
    connectEnd(component, pinId) {
        this.endComponent = component;
        this.endPinId = pinId;
        this.properties.connectedEnd = component.id;
        this.properties.endPinId = pinId;
        
        // Mettre à jour la visualisation après un court délai pour que le DOM soit prêt
        setTimeout(() => {
            this.updateWireVisualization();
        }, 10);
    }
    
    /**
     * Retirer le câble de la breadboard
     * @param {Object} breadboardState - État de la breadboard
     */
    remove(breadboardState) {
        // Supprimer la ligne SVG
        if (this.wireElement) {
            this.wireElement.remove();
        }
        
        const line = document.getElementById(`cable-${this.id}`);
        if (line) {
            line.remove();
        }
        
        // Déconnecter les composants
        if (this.startComponent) {
            this.startComponent.disconnectPin(this.startPinId);
        }
        if (this.endComponent) {
            this.endComponent.disconnectPin(this.endPinId);
        }
        
        // Appeler la méthode parente
        super.remove(breadboardState);
    }
    
    /**
     * Obtenir les informations du cable
     * @returns {string} - Informations formatées
     */
    getInfo() {
        let info = super.getInfo();
        
        info += `\n\nCouleur: ${this.properties.color}`;
        
        if (this.startComponent) {
            info += `\nDébut: ${this.startComponent.name}.${this.startPinId || '?'}`;
        } else {
            info += `\nDébut: Non connecté`;
        }
        
        if (this.endComponent) {
            info += `\nFin: ${this.endComponent.name}.${this.endPinId || '?'}`;
        } else {
            info += `\nFin: Non connecté`;
        }
        
        return info;
    }
}


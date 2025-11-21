/**
 * Fichier de configuration des montages/circuits
 * Chaque fonction configure un montage spécifique sur la breadboard
 */

/**
 * Montage de test : Deux LEDs en série
 * LED1 (rouge) connectée au rail +, cathode connectée à l'anode de LED2 (bleue), cathode de LED2 connectée au rail -
 * @param {Object} breadboardState - État de la breadboard
 */
function setupTwoLEDsInSeries(breadboardState) {
    // Ajouter LED1 (rouge)
    const led1 = new LED(null, {
        color: 'red',
        voltage: 3.3,
        current: 0.02,
        forwardVoltage: 3
    });
    addComponent(led1, 'central-0-A-0');

    // Ajouter LED2 (bleue)
    const led2 = new LED(null, {
        color: 'blue',
        voltage: 3.3,
        current: 0.02
    });
    addComponent(led2, 'central-0-A-1');

    // Créer un câble pour connecter LED1 anode au rail +
    const cable1 = new Cable(null, { color: '#f44336' });
    const led1HoleId = led1.getHoleForPin('anode');
    if (led1HoleId && addComponent(cable1, led1HoleId)) {
        cable1.connectStart(led1, 'anode');
        cable1.startHoleId = led1HoleId;
        cable1.endHoleId = 'power-top-positive-0';
        led1.connectAnodeToPositive('power-top-positive-0');
        setTimeout(() => cable1.updateWireVisualization(), 100);
    }

    // Créer un câble pour connecter LED1 cathode à LED2 anode (connexion série)
    const cable2 = new Cable(null, { color: '#4caf50' });
    const led1CathodeHoleId = led1.getHoleForPin('cathode');
    const led2AnodeHoleId = led2.getHoleForPin('anode');
    console.log('Connexion série - LED1 cathode hole:', led1CathodeHoleId, 'LED2 anode hole:', led2AnodeHoleId);
    if (led1CathodeHoleId && addComponent(cable2, led1CathodeHoleId)) {
        // Connexion série : cathode LED1 → anode LED2
        const success = led1.connectPinToPin('cathode', led2, 'anode', null, cable2);
        console.log('Connexion série établie:', success);
        console.log('LED1 cathode connectée:', led1.isPinConnected('cathode'));
        console.log('LED2 anode connectée:', led2.isPinConnected('anode'));
        setTimeout(() => cable2.updateWireVisualization(), 100);
    }

    // Créer un câble pour connecter LED2 cathode au rail -
    const cable3 = new Cable(null, { color: '#2196f3' });
    const led2CathodeHoleId = led2.getHoleForPin('cathode');
    if (led2CathodeHoleId && addComponent(cable3, led2CathodeHoleId)) {
        cable3.connectStart(led2, 'cathode');
        cable3.startHoleId = led2CathodeHoleId;
        cable3.endHoleId = 'power-bottom-negative-0';
        led2.connectCathodeToNegative('power-bottom-negative-0');
        setTimeout(() => cable3.updateWireVisualization(), 100);
    }

    // Mettre à jour l'état des LEDs après toutes les connexions
    setTimeout(() => {
        console.log('Vérification de l\'état des LEDs...');
        console.log('LED1 - anode connectée au +:', led1.isAnodeConnectedToPositive());
        console.log('LED1 - cathode connectée au -:', led1.isCathodeConnectedToNegative());
        console.log('LED2 - anode connectée au +:', led2.isAnodeConnectedToPositive());
        console.log('LED2 - cathode connectée au -:', led2.isCathodeConnectedToNegative());
        
        led1.checkPowerState();
        led2.checkPowerState();
        led1.updateVisualState();
        led2.updateVisualState();
        
        console.log('LED1 allumée:', led1.properties.isOn);
        console.log('LED2 allumée:', led2.properties.isOn);
    }, 300);

    console.log('LEDs configurées:', { led1: led1.id, led2: led2.id });
}

/**
 * Montage : Trois LEDs en série
 * LED1 (rouge) → LED2 (bleue) → LED3 (verte)
 * @param {Object} breadboardState - État de la breadboard
 */
function setupThreeLEDsInSeries(breadboardState) {
    // Ajouter LED1 (rouge)
    const led1 = new LED(null, {
        color: 'red',
        voltage: 3.3,
        current: 0.02,
        forwardVoltage: 2.0
    });
    addComponent(led1, 'central-0-A-0');

    // Ajouter LED2 (bleue)
    const led2 = new LED(null, {
        color: 'blue',
        voltage: 3.3,
        current: 0.02,
        forwardVoltage: 2.0
    });
    addComponent(led2, 'central-0-A-1');

    // Ajouter LED3 (verte)
    const led3 = new LED(null, {
        color: 'green',
        voltage: 3.3,
        current: 0.02,
        forwardVoltage: 2.0
    });
    addComponent(led3, 'central-0-A-2');

    // Créer un câble pour connecter LED1 anode au rail +
    const cable1 = new Cable(null, { color: '#f44336' });
    const led1HoleId = led1.getHoleForPin('anode');
    if (led1HoleId && addComponent(cable1, led1HoleId)) {
        cable1.connectStart(led1, 'anode');
        cable1.startHoleId = led1HoleId;
        cable1.endHoleId = 'power-top-positive-0';
        led1.connectAnodeToPositive('power-top-positive-0');
        setTimeout(() => cable1.updateWireVisualization(), 100);
    }

    // Créer un câble pour connecter LED1 cathode à LED2 anode (connexion série)
    const cable2 = new Cable(null, { color: '#4caf50' });
    const led1CathodeHoleId = led1.getHoleForPin('cathode');
    const led2AnodeHoleId = led2.getHoleForPin('anode');
    console.log('Connexion série - LED1 cathode → LED2 anode');
    if (led1CathodeHoleId && addComponent(cable2, led1CathodeHoleId)) {
        const success = led1.connectPinToPin('cathode', led2, 'anode', null, cable2);
        console.log('Connexion LED1→LED2 établie:', success);
        setTimeout(() => cable2.updateWireVisualization(), 100);
    }

    // Créer un câble pour connecter LED2 cathode à LED3 anode (connexion série)
    const cable3 = new Cable(null, { color: '#4caf50' });
    const led2CathodeHoleId = led2.getHoleForPin('cathode');
    const led3AnodeHoleId = led3.getHoleForPin('anode');
    console.log('Connexion série - LED2 cathode → LED3 anode');
    if (led2CathodeHoleId && addComponent(cable3, led2CathodeHoleId)) {
        const success = led2.connectPinToPin('cathode', led3, 'anode', null, cable3);
        console.log('Connexion LED2→LED3 établie:', success);
        setTimeout(() => cable3.updateWireVisualization(), 100);
    }

    // Créer un câble pour connecter LED3 cathode au rail -
    const cable4 = new Cable(null, { color: '#2196f3' });
    const led3CathodeHoleId = led3.getHoleForPin('cathode');
    if (led3CathodeHoleId && addComponent(cable4, led3CathodeHoleId)) {
        cable4.connectStart(led3, 'cathode');
        cable4.startHoleId = led3CathodeHoleId;
        cable4.endHoleId = 'power-bottom-negative-0';
        led3.connectCathodeToNegative('power-bottom-negative-0');
        setTimeout(() => cable4.updateWireVisualization(), 100);
    }

    // Mettre à jour l'état des LEDs après toutes les connexions
    setTimeout(() => {
        console.log('Vérification de l\'état des LEDs...');
        console.log('LED1 - anode connectée au +:', led1.isAnodeConnectedToPositive());
        console.log('LED1 - cathode connectée au -:', led1.isCathodeConnectedToNegative());
        console.log('LED2 - anode connectée au +:', led2.isAnodeConnectedToPositive());
        console.log('LED2 - cathode connectée au -:', led2.isCathodeConnectedToNegative());
        console.log('LED3 - anode connectée au +:', led3.isAnodeConnectedToPositive());
        console.log('LED3 - cathode connectée au -:', led3.isCathodeConnectedToNegative());
        
        led1.checkPowerState();
        led2.checkPowerState();
        led3.checkPowerState();
        led1.updateVisualState();
        led2.updateVisualState();
        led3.updateVisualState();
        
        console.log('LED1 allumée:', led1.properties.isOn);
        console.log('LED2 allumée:', led2.properties.isOn);
        console.log('LED3 allumée:', led3.properties.isOn);
    }, 300);

    console.log('Trois LEDs configurées en série:', { led1: led1.id, led2: led2.id, led3: led3.id });
}

/**
 * Montage vide (aucun composant)
 * Utile pour démarrer avec une breadboard vierge
 * @param {Object} breadboardState - État de la breadboard
 */
function setupEmpty(breadboardState) {
    console.log('Breadboard vide - prête pour le placement manuel de composants');
}

/**
 * Montage : Trois sous-circuits avec interrupteur, LED et résistance 47kΩ
 * Chaque sous-circuit : Rail + → Interrupteur → LED → Résistance 47kΩ → Vsum
 * Les 3 sous-circuits convergent vers Vsum qui est connecté au rail -
 * @param {Object} breadboardState - État de la breadboard
 */
function setupThreeSubcircuitsWithVsum(breadboardState) {
    // Point de convergence Vsum (sur une colonne spécifique)
    const vsumHoleId = 'central-5-C-0'; // Point de convergence
    
    // Créer le composant Vsum avec 3 entrées
    const vsum = new Vsum(null, {
        inputPins: [
            { id: 'input1', name: 'Entrée 1', type: 'input' },
            { id: 'input2', name: 'Entrée 2', type: 'input' },
            { id: 'input3', name: 'Entrée 3', type: 'input' }
        ]
    });
    addComponent(vsum, vsumHoleId);
    
    // Créer les 3 sous-circuits
    for (let i = 0; i < 3; i++) {
        const row = i * 2; // Espacer les rangées (0, 2, 4) pour éviter les conflits
        const ledColors = ['red', 'blue', 'green'];
        const ledColor = ledColors[i];
        
        // 1. Créer l'interrupteur (occupe A et B)
        const switchComponent = new Switch(null, {
            isClosed: true 
        });
        const switchHoleId = `central-${row}-A-0`;
        addComponent(switchComponent, switchHoleId);
        
        // 2. Créer la LED (sur C et D, car l'interrupteur occupe A et B)
        const led = new LED(null, {
            color: ledColor,
            voltage: 3.3,
            current: 0.02,
            forwardVoltage: 2.0
        });
        const ledHoleId = `central-${row}-C-0`;
        addComponent(led, ledHoleId);
        
        // 3. Créer la résistance 47kΩ (sur E et la rangée suivante)
        const resistor = new Resistance(null, {
            resistance: 1000 // 1kΩ
        });
        // Placer la résistance sur la rangée suivante pour éviter les conflits
        const resistorHoleId = `central-${row + 1}-A-0`;
        addComponent(resistor, resistorHoleId);
        
        // Connexions du sous-circuit i
        
        // Câble 1: Rail + → Interrupteur (entrée)
        const cable1 = new Cable(null, { color: '#f44336' });
        const switchInputHole = switchComponent.getHoleForPin('input');
        if (switchInputHole && addComponent(cable1, switchInputHole)) {
            cable1.connectStart(switchComponent, 'input');
            cable1.startHoleId = switchInputHole;
            cable1.endHoleId = 'power-top-positive-0';
            // Créer une connexion virtuelle au rail + pour l'interrupteur
            const railConnection = {
                component: { isRail: true, id: 'rail-positive', name: 'Rail +' },
                pinId: 'positive',
                holeId: 'power-top-positive-0',
                cable: cable1
            };
            switchComponent.pinConnections.set('input', railConnection);
            
            // Vérifier que la connexion est bien établie
            console.log(`Interrupteur ${i+1} - Connexion au rail + créée:`, {
                isConnected: switchComponent.isPinConnected('input'),
                connection: switchComponent.getPinConnection('input'),
                inputVoltage: switchComponent.getInputVoltage()
            });
            
            setTimeout(() => cable1.updateWireVisualization(), 100);
        } else {
            console.error(`Impossible de connecter l'interrupteur ${i+1} au rail +`);
        }
        
        // Câble 2: Interrupteur (sortie) → LED (anode)
        const cable2 = new Cable(null, { color: '#4caf50' });
        const switchOutputHole = switchComponent.getHoleForPin('output');
        const ledAnodeHole = led.getHoleForPin('anode');
        if (switchOutputHole && ledAnodeHole && addComponent(cable2, switchOutputHole)) {
            const success = switchComponent.connectPinToPin('output', led, 'anode', null, cable2);
            console.log(`Connexion interrupteur ${i+1} → LED ${i+1}:`, success);
            setTimeout(() => cable2.updateWireVisualization(), 100);
        }
        
        // Câble 3: LED (cathode) → Résistance (entrée)
        const cable3 = new Cable(null, { color: '#4caf50' });
        const ledCathodeHole = led.getHoleForPin('cathode');
        const resistorInputHole = resistor.getHoleForPin('input');
        if (ledCathodeHole && resistorInputHole && addComponent(cable3, ledCathodeHole)) {
            const success = led.connectPinToPin('cathode', resistor, 'input', null, cable3);
            console.log(`Connexion LED ${i+1} → Résistance ${i+1}:`, success);
            setTimeout(() => cable3.updateWireVisualization(), 100);
        }
        
        // Câble 4: Résistance (sortie) → Vsum (entrée i+1)
        const cable4 = new Cable(null, { color: '#2196f3' });
        const resistorOutputHole = resistor.getHoleForPin('output');
        const vsumInputPinId = `input${i + 1}`;
        if (resistorOutputHole && addComponent(cable4, resistorOutputHole)) {
            // Connecter la sortie de la résistance à l'entrée correspondante de Vsum
            const success = resistor.connectPinToPin('output', vsum, vsumInputPinId, null, cable4);
            console.log(`Connexion Résistance ${i+1} → Vsum (${vsumInputPinId}):`, success);
            setTimeout(() => cable4.updateWireVisualization(), 100);
        }
    }
    
    // Ajouter une LED en sortie de Vsum pour visualiser la tension au point Vsum
    const ledOutput = new LED(null, {
        color: '#ff9800', // Orange pour différencier
        voltage: 3.3,
        current: 0.02,
        forwardVoltage: 1.0
    });
    // Placer la LED de sortie après Vsum (sur une rangée différente pour éviter le conflit)
    const ledOutputHoleId = `central-6-C-0`;
    if (!addComponent(ledOutput, ledOutputHoleId)) {
        console.error('Impossible de placer la LED de sortie à', ledOutputHoleId);
    }
    
    // Câble: Vsum (sortie) → LED sortie (anode)
    const vsumToLedCable = new Cable(null, { color: '#ff9800' });
    const vsumOutputHole = vsum.getHoleForPin('output');
    const ledOutputAnodeHole = ledOutput.getHoleForPin('anode');
    if (vsumOutputHole && ledOutputAnodeHole && addComponent(vsumToLedCable, vsumOutputHole)) {
        const success = vsum.connectPinToPin('output', ledOutput, 'anode', null, vsumToLedCable);
        console.log(`Connexion Vsum → LED sortie:`, success);
        setTimeout(() => vsumToLedCable.updateWireVisualization(), 100);
    }
    
    // Câble: LED sortie (cathode) → GND
    const ledToGndCable = new Cable(null, { color: '#ff9800' });
    const ledOutputCathodeHole = ledOutput.getHoleForPin('cathode');
    if (ledOutputCathodeHole && addComponent(ledToGndCable, ledOutputCathodeHole)) {
        ledToGndCable.connectStart(ledOutput, 'cathode');
        ledToGndCable.startHoleId = ledOutputCathodeHole;
        ledToGndCable.endHoleId = 'power-bottom-negative-0';
        // Créer une connexion virtuelle au rail - pour la LED de sortie
        const railConnection = {
            component: { isRail: true, id: 'rail-negative', name: 'Rail -' },
            pinId: 'negative',
            holeId: 'power-bottom-negative-0',
            cable: ledToGndCable
        };
        ledOutput.pinConnections.set('cathode', railConnection);
        console.log(`Connexion LED sortie → GND créée`);
        setTimeout(() => {
            ledToGndCable.updateWireVisualization();
            console.log(`Câble LED → GND visualisé`);
        }, 200);
    } else {
        console.error('Impossible de connecter la LED de sortie au GND');
    }
    
    // Mettre à jour l'état des composants après toutes les connexions
    setTimeout(() => {
        console.log('Vérification de l\'état des composants...');
        
        // Vérifier chaque sous-circuit
        for (let i = 0; i < 3; i++) {
            const row = i * 2; // Même espacement que lors de la création
            const switchHoleId = `central-${row}-A-0`;
            const ledHoleId = `central-${row}-C-0`;
            const resistorHoleId = `central-${row + 1}-A-0`;
            
            // Trouver les composants
            const switchComp = Array.from(breadboardState.placedComponents.values())
                .find(c => c.position.holeId === switchHoleId && c.type === 'switch');
            const ledComp = Array.from(breadboardState.placedComponents.values())
                .find(c => c.position.holeId === ledHoleId && c.type === 'led');
            const resistorComp = Array.from(breadboardState.placedComponents.values())
                .find(c => c.position.holeId === resistorHoleId && c.type === 'resistance');
            
            if (switchComp) {
                console.log(`Interrupteur ${i+1} - fermé:`, switchComp.properties.isClosed);
                console.log(`  - Entrée connectée:`, switchComp.isPinConnected('input'));
                console.log(`  - Sortie connectée:`, switchComp.isPinConnected('output'));
                console.log(`  - Entrée connectée au rail +:`, switchComp.isInputConnectedToPositive());
                console.log(`  - Sortie connectée au rail +:`, switchComp.isOutputConnectedToPositive());
                console.log(`  - Tension d'entrée:`, switchComp.getInputVoltage(), 'V');
                console.log(`  - Tension de sortie:`, switchComp.getOutputVoltage(), 'V');
            }
            if (ledComp) {
                console.log(`LED ${i+1}:`);
                console.log(`  - Anode connectée:`, ledComp.isPinConnected('anode'));
                console.log(`  - Cathode connectée:`, ledComp.isPinConnected('cathode'));
                console.log(`  - Anode connectée au rail +:`, ledComp.isAnodeConnectedToPositive());
                console.log(`  - Cathode connectée au rail -:`, ledComp.isCathodeConnectedToNegative());
                console.log(`  - Tension anode:`, ledComp.getAnodeVoltage(), 'V');
                console.log(`  - Tension cathode:`, ledComp.getCathodeVoltage(), 'V');
                ledComp.checkPowerState();
                ledComp.updateVisualState();
                console.log(`  - LED ${i+1} allumée:`, ledComp.properties.isOn);
            }
            if (resistorComp) {
                console.log(`Résistance ${i+1} - valeur:`, resistorComp.properties.resistance, 'Ω');
                console.log(`  - Entrée connectée:`, resistorComp.isPinConnected('input'));
                console.log(`  - Sortie connectée:`, resistorComp.isPinConnected('output'));
                console.log(`  - Sortie connectée au rail -:`, resistorComp.isOutputConnectedToNegative());
                console.log(`  - Tension d'entrée:`, resistorComp.getInputVoltage(), 'V');
                console.log(`  - Tension de sortie:`, resistorComp.getOutputVoltage(), 'V');
                console.log(`  - Courant d'entrée:`, resistorComp.getCurrent(), 'A');
                console.log(`  - Courant d'entrée (mA):`, resistorComp.getCurrent() ? (resistorComp.getCurrent() * 1000).toFixed(3) : 'N/A', 'mA');
            }
        }
        
        // Afficher les informations de Vsum
        const vsumComp = Array.from(breadboardState.placedComponents.values())
            .find(c => c.type === 'vsum');
        if (vsumComp) {
            console.log('Vsum:');
            console.log(`  - Tension théorique (avant GND):`, vsumComp.getTheoreticalVoltage ? vsumComp.getTheoreticalVoltage() : 'N/A', 'V');
            console.log(`  - Tension réelle (après GND):`, vsumComp.getVoltage ? vsumComp.getVoltage() : 'N/A', 'V');
            console.log(`  - Courant total (sortie):`, vsumComp.getTotalCurrent ? vsumComp.getTotalCurrent() : 'N/A', 'A');
            console.log(`  - Courant total (sortie) (mA):`, vsumComp.getTotalCurrent ? (vsumComp.getTotalCurrent() * 1000).toFixed(3) : 'N/A', 'mA');
            for (let i = 0; i < 3; i++) {
                const pinId = `input${i + 1}`;
                console.log(`  - ${pinId} connectée:`, vsumComp.isPinConnected(pinId));
                if (vsumComp.isPinConnected(pinId)) {
                    const connection = vsumComp.getPinConnection(pinId);
                    if (connection && connection.component) {
                        console.log(`  - ${pinId} connectée à:`, connection.component.type, connection.pinId);
                        console.log(`  - Tension de sortie du composant connecté:`, connection.component.getPinVoltage ? connection.component.getPinVoltage(connection.pinId, 'output') : 'N/A', 'V');
                        // Obtenir le courant d'entrée depuis cette connexion
                        const inputCurrent = connection.component.getCurrent ? connection.component.getCurrent() : null;
                        console.log(`  - Courant d'entrée depuis ${pinId}:`, inputCurrent, 'A');
                        console.log(`  - Courant d'entrée depuis ${pinId} (mA):`, inputCurrent ? (inputCurrent * 1000).toFixed(3) : 'N/A', 'mA');
                    }
                    console.log(`  - Tension ${pinId}:`, vsumComp.getInputVoltage(pinId), 'V');
                }
            }
        }
        
        // Afficher les informations de la LED de sortie
        const ledOutputComp = Array.from(breadboardState.placedComponents.values())
            .find(c => c.position && c.position.holeId === 'central-6-C-0' && c.type === 'led');
        if (ledOutputComp) {
            console.log('LED de sortie (orange):');
            console.log(`  - Anode connectée:`, ledOutputComp.isPinConnected('anode'));
            console.log(`  - Cathode connectée:`, ledOutputComp.isPinConnected('cathode'));
            console.log(`  - Tension anode:`, ledOutputComp.getAnodeVoltage(), 'V');
            console.log(`  - Tension cathode:`, ledOutputComp.getCathodeVoltage(), 'V');
            console.log(`  - Courant:`, ledOutputComp.getAnodeCurrent(), 'A');
            console.log(`  - Courant (mA):`, ledOutputComp.getAnodeCurrent() ? (ledOutputComp.getAnodeCurrent() * 1000).toFixed(3) : 'N/A', 'mA');
            ledOutputComp.checkPowerState();
            ledOutputComp.updateVisualState();
            console.log(`  - LED allumée:`, ledOutputComp.properties.isOn);
        } else {
            console.log('LED de sortie non trouvée');
        }
        
        console.log('Point Vsum configuré à:', vsumHoleId);
    }, 500);
    
    console.log('Trois sous-circuits configurés avec point de convergence Vsum');
}

// Exporter les fonctions pour utilisation globale
if (typeof window !== 'undefined') {
    window.setupTwoLEDsInSeries = setupTwoLEDsInSeries;
    window.setupThreeLEDsInSeries = setupThreeLEDsInSeries;
    window.setupEmpty = setupEmpty;
    window.setupThreeSubcircuitsWithVsum = setupThreeSubcircuitsWithVsum;
}


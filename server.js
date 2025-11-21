import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Servir les fichiers statiques (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API pour gérer l'état de la breadboard
app.get('/api/breadboard', (req, res) => {
    // Retourner l'état initial de la breadboard
    res.json({
        rows: 30, // Nombre de rangées
        cols: 63, // Nombre de colonnes (5 colonnes par groupe + rails)
        powerRails: {
            top: Array(63).fill(null),
            bottom: Array(63).fill(null)
        },
        components: []
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});


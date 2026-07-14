const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { initDB } = require('./db/database');

const app = express();

function resolveFrontendDir() {
  const candidates = [
    path.resolve(__dirname, 'frontend'),
    path.resolve(__dirname, '..', 'frontend'),
    path.resolve(__dirname, '..', 'backend', 'frontend'),
    path.resolve('/app/backend/frontend'),
    path.resolve('/app/frontend')
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'pages'))) || candidates[0];
  console.log('[Frontend] Candidates:', candidates);
  console.log('[Frontend] Resolved to:', resolved);
  console.log('[Frontend] Pages exists:', fs.existsSync(path.join(resolved, 'pages')));
  return resolved;
}

function resolveFrontendFile(relativePath) {
  const frontendDir = resolveFrontendDir();
  return path.join(frontendDir, relativePath);
}

app.use(cors());
app.use(express.json());
app.use(express.static(resolveFrontendDir()));

// Inicializar BD
initDB().catch((err) => {
  console.error('Error inicializando BD:', err);
  process.exit(1);
});

app.use('/api/registros', require('./routes/registros'));
app.use('/api/auth', require('./routes/auth'));

app.get('/registro', (req, res) => {
  res.sendFile(resolveFrontendFile(path.join('pages', 'registro.html')));
});

app.get('/admin', (req, res) => {
  res.sendFile(resolveFrontendFile(path.join('pages', 'admin.html')));
});

app.get('/login', (req, res) => {
  res.sendFile(resolveFrontendFile(path.join('pages', 'login.html')));
});

app.get('/', (req, res) => {
  res.sendFile(resolveFrontendFile(path.join('pages', 'registro.html')));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Formulario alumnos: http://localhost:${PORT}/registro`);
  console.log(`Panel admin:        http://localhost:${PORT}/admin`);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initDB } = require('./db/database');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Inicializar BD
initDB().catch((err) => {
  console.error('Error inicializando BD:', err);
  process.exit(1);
});

app.use('/api/registros', require('./routes/registros'));
app.use('/api/auth', require('./routes/auth'));

app.get('/registro', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/registro.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/admin.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/registro.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Formulario alumnos: http://localhost:${PORT}/registro`);
  console.log(`Panel admin:        http://localhost:${PORT}/admin`);
});

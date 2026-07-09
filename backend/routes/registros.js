const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  crearRegistro,
  listarRegistros,
  obtenerRegistro,
  obtenerStats
} = require('../controllers/registrosController');

// Ruta pública - alumnos crean registros
router.post('/', crearRegistro);

// Rutas protegidas - solo admin
router.get('/stats', requireAuth, obtenerStats);
router.get('/', requireAuth, listarRegistros);
router.get('/:id', requireAuth, obtenerRegistro);

module.exports = router;

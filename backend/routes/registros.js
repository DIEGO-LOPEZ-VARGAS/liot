const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  crearRegistro,
  listarRegistros,
  obtenerRegistro,
  obtenerStats,
  generarCodigoAcceso,
  listarCodigos,
  listarMaterialesPublic,
  listarMaterialesAdmin,
  crearMaterialHandler,
  eliminarMaterialHandler
} = require('../controllers/registrosController');

// Ruta pública - alumnos crean registros
router.post('/', crearRegistro);
router.get('/materiales', listarMaterialesPublic);

// Rutas protegidas - solo admin
router.get('/stats', requireAuth, obtenerStats);
router.get('/codigos', requireAuth, listarCodigos);
router.post('/codigos', requireAuth, generarCodigoAcceso);
router.get('/materiales/gestion', requireAuth, listarMaterialesAdmin);
router.post('/materiales', requireAuth, crearMaterialHandler);
router.delete('/materiales/:id', requireAuth, eliminarMaterialHandler);
router.get('/', requireAuth, listarRegistros);
router.get('/:id', requireAuth, obtenerRegistro);

module.exports = router;

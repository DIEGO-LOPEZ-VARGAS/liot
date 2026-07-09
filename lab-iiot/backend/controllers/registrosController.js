const { createRegistro: guardarRegistro, listRegistros, getRegistro, getStats } = require('../db/database');

// POST /api/registros - Crear nuevo registro
async function crearRegistro(req, res) {
  const { laboratorio, integrantes, materiales } = req.body;

  if (!laboratorio || !integrantes || !materiales) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!Array.isArray(integrantes) || integrantes.length === 0) {
    return res.status(400).json({ error: 'Debe registrar al menos un integrante' });
  }

  if (!Array.isArray(materiales) || materiales.length === 0) {
    return res.status(400).json({ error: 'Debe registrar al menos un material' });
  }

  for (const i of integrantes) {
    if (!i.nombre_completo || !i.matricula) {
      return res.status(400).json({ error: 'Todos los integrantes deben tener nombre y matrícula' });
    }
  }

  for (const m of materiales) {
    if (!m.nombre_material || !m.numero_registro) {
      return res.status(400).json({ error: 'Todos los materiales deben tener nombre y número de registro' });
    }
  }

  try {
    const registro = await guardarRegistro({ laboratorio, integrantes, materiales });
    res.status(201).json({ mensaje: 'Registro guardado correctamente', folio: registro.folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
}

// GET /api/registros - Listar registros (admin)
async function listarRegistrosHandler(req, res) {
  try {
    const { fecha, laboratorio, busqueda } = req.query;
    const registros = await listRegistros({ fecha, laboratorio, busqueda });
    res.json(registros);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener registros' });
  }
}

// GET /api/registros/:id - Detalle de un registro
async function obtenerRegistro(req, res) {
  const { id } = req.params;
  try {
    const registro = await getRegistro(id);
    if (!registro) return res.status(404).json({ error: 'Registro no encontrado' });

    res.json(registro);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el registro' });
  }
}

// GET /api/registros/stats - Estadísticas para el panel
async function obtenerStats(req, res) {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

module.exports = { crearRegistro, listarRegistros: listarRegistrosHandler, obtenerRegistro, obtenerStats };

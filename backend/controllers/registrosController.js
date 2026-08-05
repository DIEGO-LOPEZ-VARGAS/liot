const {
  createRegistro: guardarRegistro,
  listRegistros,
  getRegistro,
  getStats,
  validateAccessCode,
  getMaterialById,
  createAccessCode,
  listAccessCodes,
  createMaterial,
  listMaterials,
  deleteMaterial
} = require('../db/database');

// POST /api/registros - Crear nuevo registro
async function crearRegistro(req, res) {
  const { laboratorio, integrantes, materiales, codigo_acceso } = req.body;

  if (!laboratorio || !integrantes || !materiales || !codigo_acceso) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!Array.isArray(integrantes) || integrantes.length === 0) {
    return res.status(400).json({ error: 'Debe registrar al menos un integrante' });
  }

  if (!Array.isArray(materiales) || materiales.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos un material' });
  }

  for (const i of integrantes) {
    if (!i.nombre_completo || !i.matricula) {
      return res.status(400).json({ error: 'Todos los integrantes deben tener nombre y matrícula' });
    }
  }

  for (const m of materiales) {
    if (!m.id_material || !m.nombre_material || !m.numero_registro) {
      return res.status(400).json({ error: 'Material inválido. Selecciona un material activo y agrega su número de registro.' });
    }
    const materialActivo = await getMaterialById(m.id_material);
    if (!materialActivo) {
      return res.status(400).json({ error: 'Material seleccionado no válido o inactivo' });
    }
  }

  try {
    const codigoValido = await validateAccessCode(codigo_acceso);
    if (!codigoValido) {
      return res.status(400).json({ error: 'Código inválido o expirado. Solicita uno nuevo al profesor.' });
    }

    const registro = await guardarRegistro({ laboratorio, integrantes, materiales, codigo_acceso });
    res.status(201).json({ mensaje: 'Registro guardado correctamente', folio: registro.folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
}

function formatearFechaLocal(fecha) {
  // Formatear fecha en timezone local (América/México_City)
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City'
  }).format(fecha);
}

async function generarCodigoAcceso(req, res) {
  const { expiracion_horas = 2 } = req.body;
  // Generate a 6-digit numeric code, cap expiration between 1 and 24 hours
  const digits = '0123456789';
  const length = 6;
  const maxAttempts = 5;

  const horas = Math.max(1, Math.min(24, Number(expiracion_horas) || 2));
  const expiracion = new Date(Date.now() + horas * 60 * 60 * 1000);

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let codigo = '';
      for (let i = 0; i < length; i++) {
        codigo += digits[Math.floor(Math.random() * digits.length)];
      }

      try {
        const nuevoCodigo = await createAccessCode({ codigo, expiracion: expiracion.toISOString() });
        // Agregar la hora formateada localmente
        nuevoCodigo.expiracion_formateada = formatearFechaLocal(expiracion);
        return res.status(201).json(nuevoCodigo);
      } catch (err) {
        // If duplicate key in Postgres, retry; otherwise propagate
        if (err && err.code === '23505') continue; // unique_violation
        // For JSON storage or other errors, log and return
        console.error(err);
        return res.status(500).json({ error: 'Error al generar el código de acceso' });
      }
    }

    return res.status(500).json({ error: 'No se pudo generar un código único, intente de nuevo' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el código de acceso' });
  }
}

async function listarCodigos(req, res) {
  try {
    const codigos = await listAccessCodes();
    res.json(codigos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los códigos de acceso' });
  }
}

async function listarMaterialesPublic(req, res) {
  try {
    const materiales = await listMaterials({ onlyActive: true });
    res.json(materiales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener materiales' });
  }
}

async function listarMaterialesAdmin(req, res) {
  try {
    const materiales = await listMaterials({ onlyActive: false });
    res.json(materiales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener materiales' });
  }
}

async function crearMaterialHandler(req, res) {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'Nombre del material requerido' });
  }

  try {
    const materialesExistentes = await listMaterials({ onlyActive: false });
    const duplicado = materialesExistentes.some((m) => m.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (duplicado) {
      return res.status(400).json({ error: 'El material ya existe' });
    }
    const material = await createMaterial(nombre.trim());
    res.status(201).json(material);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el material' });
  }
}

async function eliminarMaterialHandler(req, res) {
  const { id } = req.params;
  try {
    await deleteMaterial(id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el material' });
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

module.exports = {
  crearRegistro,
  listarRegistros: listarRegistrosHandler,
  obtenerRegistro,
  obtenerStats,
  generarCodigoAcceso,
  listarCodigos,
  listarMaterialesPublic,
  listarMaterialesAdmin,
  crearMaterialHandler,
  eliminarMaterialHandler
};


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

function formatLocalDate(date) {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City'
  }).format(date);
}

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

  for (const integrante of integrantes) {
    if (!integrante.nombre_completo || !integrante.matricula) {
      return res.status(400).json({ error: 'Todos los integrantes deben tener nombre y matricula' });
    }
  }

  for (const material of materiales) {
    if (!material.id_material || !material.nombre_material || !material.numero_registro) {
      return res.status(400).json({ error: 'Material invalido. Selecciona un material activo y agrega su numero de registro.' });
    }
    const materialActivo = await getMaterialById(material.id_material);
    if (!materialActivo) {
      return res.status(400).json({ error: 'Material seleccionado no valido o inactivo' });
    }
  }

  try {
    const codigoValido = await validateAccessCode(codigo_acceso);
    if (!codigoValido) {
      return res.status(400).json({ error: 'Codigo invalido o expirado. Solicita uno nuevo al profesor.' });
    }

    const registro = await guardarRegistro({ laboratorio, integrantes, materiales, codigo_acceso });
    return res.status(201).json({ mensaje: 'Registro guardado correctamente', folio: registro.folio });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al guardar el registro' });
  }
}

async function generarCodigoAcceso(req, res) {
  const { expiracion_horas = 2 } = req.body;
  const digits = '0123456789';
  const length = 6;
  const maxAttempts = 5;

  const horas = Math.max(1, Math.min(24, Number(expiracion_horas) || 2));
  const expiracion = new Date(Date.now() + horas * 60 * 60 * 1000);

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let codigo = '';
      for (let i = 0; i < length; i += 1) {
        codigo += digits[Math.floor(Math.random() * digits.length)];
      }

      try {
        const nuevoCodigo = await createAccessCode({ codigo, expiracion: expiracion.toISOString() });
        nuevoCodigo.expiracion_formateada = formatLocalDate(expiracion);
        return res.status(201).json(nuevoCodigo);
      } catch (err) {
        if (err && err.code === '23505') {
          continue;
        }
        console.error(err);
        return res.status(500).json({ error: 'Error al generar el codigo de acceso' });
      }
    }

    return res.status(500).json({ error: 'No se pudo generar un codigo unico, intente de nuevo' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al generar el codigo de acceso' });
  }
}

async function listarCodigos(req, res) {
  try {
    const codigos = await listAccessCodes();
    return res.json(codigos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener los codigos de acceso' });
  }
}

async function listarMaterialesPublic(req, res) {
  try {
    const materiales = await listMaterials({ onlyActive: true });
    return res.json(materiales);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener materiales' });
  }
}

async function listarMaterialesAdmin(req, res) {
  try {
    const materiales = await listMaterials({ onlyActive: true });
    return res.json(materiales);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener materiales' });
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
    return res.status(201).json(material);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el material' });
  }
}

async function eliminarMaterialHandler(req, res) {
  const { id } = req.params;
  try {
    await deleteMaterial(id);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al eliminar el material' });
  }
}

async function listarRegistrosHandler(req, res) {
  try {
    const { fecha, laboratorio, busqueda } = req.query;
    const registros = await listRegistros({ fecha, laboratorio, busqueda });
    return res.json(registros);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener registros' });
  }
}

async function obtenerRegistro(req, res) {
  const { id } = req.params;
  try {
    const registro = await getRegistro(id);
    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    return res.json(registro);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el registro' });
  }
}

async function obtenerStats(req, res) {
  try {
    const stats = await getStats();
    return res.json(stats);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener estadisticas' });
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

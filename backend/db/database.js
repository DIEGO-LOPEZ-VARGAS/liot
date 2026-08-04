const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

let pool = null;
let useJSON = false;

async function initDB() {
  if (process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      await pool.query('SELECT 1');
      console.log('✓ Base de datos PostgreSQL conectada');
      await createTablesIfNotExist();
      return;
    } catch (err) {
      console.warn('⚠ No se pudo conectar a PostgreSQL, usando JSON:', err.message);
      useJSON = true;
    }
  } else {
    useJSON = true;
    console.log('ℹ DATABASE_URL no definida, usando almacenamiento JSON local');
  }

  if (useJSON) {
    await initJSONStore();
  }
}

async function createTablesIfNotExist() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS administradores (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        usuario VARCHAR(50) NOT NULL UNIQUE,
        contrasena VARCHAR(255) NOT NULL,
        rol VARCHAR(30) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS registros (
        id SERIAL PRIMARY KEY,
        folio VARCHAR(20) NOT NULL UNIQUE,
        laboratorio VARCHAR(100) NOT NULL,
        numero_integrantes INT NOT NULL,
        estado VARCHAR(20) DEFAULT 'Completado',
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        codigo_acceso VARCHAR(20) NOT NULL,
        integrantes JSONB,
        materiales JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS codigos_acceso (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(12) NOT NULL UNIQUE,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
        expiracion TIMESTAMP NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
      );

      CREATE TABLE IF NOT EXISTS materiales (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL UNIQUE,
        estado VARCHAR(20) NOT NULL DEFAULT 'Activo',
        created_at TIMESTAMP DEFAULT NOW()
      );

      INSERT INTO administradores (nombre, usuario, contrasena, rol)
      VALUES ('Administrador', 'admin', $1, 'admin')
      ON CONFLICT (usuario) DO NOTHING;
    `, [bcrypt.hashSync('admin123', 10)]);
    console.log('✓ Tablas de PostgreSQL listas');
  } finally {
    client.release();
  }
}

async function initJSONStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    const store = {
      administradores: [
        {
          id: 1,
          nombre: 'Administrador',
          usuario: 'admin',
          contrasena: bcrypt.hashSync('admin123', 10),
          rol: 'admin'
        }
      ],
      registros: [],
      codigos_acceso: [],
      materiales: [],
      nextId: 1,
      nextCodigoId: 1,
      nextMaterialId: 1
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
    return store;
  }
  return readJSONStore();
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    return initJSONStore();
  }

  const store = await readJSONStore();

  if (!Array.isArray(store.administradores)) store.administradores = [];
  if (!Array.isArray(store.registros)) store.registros = [];
  if (!Array.isArray(store.codigos_acceso)) store.codigos_acceso = [];
  if (!Array.isArray(store.materiales)) store.materiales = [];
  if (typeof store.nextId !== 'number') {
    store.nextId = Math.max(0, ...store.registros.map((r) => r.id_registro || 0)) + 1;
  }
  if (typeof store.nextCodigoId !== 'number') {
    store.nextCodigoId = Math.max(0, ...store.codigos_acceso.map((c) => c.id_codigo || 0)) + 1;
  }
  if (typeof store.nextMaterialId !== 'number') {
    store.nextMaterialId = Math.max(0, ...store.materiales.map((m) => m.id_material || 0)) + 1;
  }

  await writeJSONStore(store);
  return store;
}

async function readJSONStore() {
  const content = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(content);
}

async function writeJSONStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function updateCodeStatuses(store) {
  const now = new Date().toISOString();
  let changed = false;
  if (!Array.isArray(store.codigos_acceso)) return false;
  for (const item of store.codigos_acceso) {
    if (item.estado === 'Activo' && item.expiracion && item.expiracion < now) {
      item.estado = 'Expirado';
      changed = true;
    }
  }
  return changed;
}

async function loadStore() {
  const store = await ensureStore();
  if (updateCodeStatuses(store)) {
    await writeJSONStore(store);
  }
  return store;
}

async function verifyAdminCredentials(usuario, contrasena) {
  if (pool && !useJSON) {
    const result = await pool.query('SELECT * FROM administradores WHERE usuario = $1', [usuario]);
    if (result.rows.length === 0) return null;
    const admin = result.rows[0];
    const valid = await bcrypt.compare(contrasena, admin.contrasena);
    return valid ? admin : null;
  }

  const store = await readJSONStore();
  const admin = store.administradores.find((a) => a.usuario.toLowerCase() === usuario.toLowerCase());
  if (!admin) return null;
  const valid = await bcrypt.compare(contrasena, admin.contrasena);
  return valid ? admin : null;
}

async function createRegistro({ laboratorio, integrantes, materiales, codigo_acceso }) {
  const fecha = new Date().toISOString().split('T')[0];
  const hora = new Date().toTimeString().split(' ')[0];

  if (pool && !useJSON) {
    const folio = `REG-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO registros (folio, laboratorio, numero_integrantes, estado, fecha, hora, codigo_acceso, integrantes, materiales)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id as id_registro, folio, laboratorio, numero_integrantes, estado, fecha, hora, codigo_acceso, integrantes, materiales`,
      [folio, laboratorio, integrantes.length, 'Completado', fecha, hora, codigo_acceso, JSON.stringify(integrantes), JSON.stringify(materiales)]
    );
    return { ...result.rows[0], integrantes, materiales };
  }

  const store = await readJSONStore();
  const registro = {
    id_registro: store.nextId,
    folio: `REG-${String(store.nextId).padStart(6, '0')}`,
    laboratorio,
    numero_integrantes: integrantes.length,
    estado: 'Completado',
    fecha,
    hora,
    codigo_acceso,
    integrantes,
    materiales
  };
  store.registros.unshift(registro);
  store.nextId += 1;
  await writeJSONStore(store);
  return registro;
}

async function listRegistros(filtros = {}) {
  if (pool && !useJSON) {
    let query = 'SELECT * FROM registros WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filtros.fecha) {
      query += ` AND fecha = $${paramCount}`;
      params.push(filtros.fecha);
      paramCount++;
    }
    if (filtros.laboratorio) {
      query += ` AND laboratorio = $${paramCount}`;
      params.push(filtros.laboratorio);
      paramCount++;
    }
    if (filtros.busqueda) {
      query += ` AND (integrantes::text ILIKE $${paramCount} OR materiales::text ILIKE $${paramCount})`;
      params.push(`%${filtros.busqueda}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows.map((r) => ({
      ...r,
      integrantes: typeof r.integrantes === 'string' ? JSON.parse(r.integrantes) : r.integrantes,
      materiales: typeof r.materiales === 'string' ? JSON.parse(r.materiales) : r.materiales,
      total_materiales: (typeof r.materiales === 'string' ? JSON.parse(r.materiales) : r.materiales).length
    }));
  }

  const store = await readJSONStore();
  let registros = [...store.registros];

  if (filtros.fecha) {
    registros = registros.filter((r) => r.fecha === filtros.fecha);
  }
  if (filtros.laboratorio) {
    registros = registros.filter((r) => r.laboratorio === filtros.laboratorio);
  }
  if (filtros.busqueda) {
    const texto = filtros.busqueda.toLowerCase();
    registros = registros.filter((r) => {
      const coincidenciaIntegrante = r.integrantes.some((i) =>
        `${i.nombre_completo} ${i.matricula}`.toLowerCase().includes(texto)
      );
      const coincidenciaMaterial = r.materiales.some((m) =>
        (m.nombre_material || m.nombre || '').toLowerCase().includes(texto)
      );
      return coincidenciaIntegrante || coincidenciaMaterial;
    });
  }

  return registros.map((r) => ({ ...r, total_materiales: r.materiales.length }));
}

async function getRegistro(id) {
  if (pool && !useJSON) {
    const result = await pool.query('SELECT * FROM registros WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      ...r,
      integrantes: typeof r.integrantes === 'string' ? JSON.parse(r.integrantes) : r.integrantes,
      materiales: typeof r.materiales === 'string' ? JSON.parse(r.materiales) : r.materiales
    };
  }

  const store = await readJSONStore();
  return store.registros.find((r) => r.id_registro === Number(id)) || null;
}

async function getStats() {
  const hoy = new Date().toISOString().split('T')[0];

  if (pool && !useJSON) {
    const result = await pool.query(
      `SELECT
        COUNT(*) as registros_hoy,
        COUNT(DISTINCT laboratorio) as labs_activos,
        SUM(jsonb_array_length(materiales)) as materiales_total,
        COUNT(*) as equipos_atendidos
       FROM registros WHERE fecha = $1`,
      [hoy]
    );
    const row = result.rows[0];
    return {
      registros_hoy: parseInt(row.registros_hoy) || 0,
      labs_activos: parseInt(row.labs_activos) || 0,
      materiales_total: parseInt(row.materiales_total) || 0,
      equipos_atendidos: parseInt(row.equipos_atendidos) || 0
    };
  }

  const store = await readJSONStore();
  const registrosHoy = store.registros.filter((r) => r.fecha === hoy);

  return {
    registros_hoy: registrosHoy.length,
    labs_activos: new Set(registrosHoy.map((r) => r.laboratorio)).size,
    materiales_total: registrosHoy.reduce((sum, r) => sum + r.materiales.length, 0),
    equipos_atendidos: registrosHoy.length
  };
}

async function createAccessCode({ codigo, expiracion }) {
  if (pool && !useJSON) {
    const result = await pool.query(
      `INSERT INTO codigos_acceso (codigo, expiracion, estado)
       VALUES ($1, $2, 'Activo')
       RETURNING id as id_codigo, codigo, creado_en, expiracion, estado`,
      [codigo, expiracion]
    );
    return result.rows[0];
  }

  const store = await readJSONStore();
  const newCode = {
    id_codigo: store.nextCodigoId,
    codigo,
    creado_en: new Date().toISOString(),
    expiracion,
    estado: 'Activo'
  };
  store.codigos_acceso.push(newCode);
  store.nextCodigoId += 1;
  await writeJSONStore(store);
  return newCode;
}

async function getAccessCodeByCodigo(codigo) {
  if (pool && !useJSON) {
    const result = await pool.query(
      `SELECT id, codigo, creado_en, expiracion, estado FROM codigos_acceso WHERE codigo = $1`,
      [codigo]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (new Date(row.expiracion) < new Date() && row.estado !== 'Expirado') {
      await pool.query(`UPDATE codigos_acceso SET estado = 'Expirado' WHERE id = $1`, [row.id]);
      row.estado = 'Expirado';
    }
    return { id_codigo: row.id, codigo: row.codigo, creado_en: row.creado_en, expiracion: row.expiracion, estado: row.estado };
  }

  const store = await loadStore();
  const codigoItem = store.codigos_acceso.find((item) => item.codigo === codigo);
  return codigoItem || null;
}

async function validateAccessCode(codigo) {
  const accessCode = await getAccessCodeByCodigo(codigo);
  if (!accessCode) return null;
  if (accessCode.estado !== 'Activo' || new Date(accessCode.expiracion) < new Date()) {
    return null;
  }
  return accessCode;
}

async function listAccessCodes() {
  if (pool && !useJSON) {
    const result = await pool.query(
      `SELECT id as id_codigo, codigo, creado_en, expiracion,
        CASE WHEN expiracion < NOW() THEN 'Expirado' ELSE estado END as estado
       FROM codigos_acceso ORDER BY creado_en DESC`
    );
    return result.rows;
  }

  const store = await loadStore();
  return [...store.codigos_acceso].sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
}

async function createMaterial(nombre) {
  if (!nombre) throw new Error('Nombre de material requerido');
  if (pool && !useJSON) {
    const result = await pool.query(
      `INSERT INTO materiales (nombre, estado)
       VALUES ($1, 'Activo')
       RETURNING id as id_material, nombre, estado, created_at`,
      [nombre.trim()]
    );
    return result.rows[0];
  }

  const store = await readJSONStore();
  const material = {
    id_material: store.nextMaterialId,
    nombre: nombre.trim(),
    estado: 'Activo',
    created_at: new Date().toISOString()
  };
  store.materiales.push(material);
  store.nextMaterialId += 1;
  await writeJSONStore(store);
  return material;
}

async function listMaterials({ onlyActive = false } = {}) {
  if (pool && !useJSON) {
    const query = onlyActive
      ? `SELECT id as id_material, nombre, estado, created_at FROM materiales WHERE estado = 'Activo' ORDER BY created_at DESC`
      : `SELECT id as id_material, nombre, estado, created_at FROM materiales ORDER BY created_at DESC`;
    const result = await pool.query(query);
    return result.rows;
  }

  const store = await loadStore();
  const items = Array.isArray(store.materiales) ? store.materiales : [];
  return onlyActive ? items.filter((item) => item.estado === 'Activo') : [...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function deleteMaterial(id) {
  if (pool && !useJSON) {
    await pool.query(`UPDATE materiales SET estado = 'Eliminado' WHERE id = $1`, [id]);
    return;
  }

  const store = await loadStore();
  const index = store.materiales.findIndex((item) => item.id_material === Number(id));
  if (index !== -1) {
    store.materiales[index].estado = 'Eliminado';
    await writeJSONStore(store);
  }
}

async function getMaterialById(id) {
  if (pool && !useJSON) {
    const result = await pool.query(
      `SELECT id as id_material, nombre, estado, created_at FROM materiales WHERE id = $1 AND estado = 'Activo'`,
      [id]
    );
    return result.rows[0] || null;
  }

  const store = await loadStore();
  return store.materiales.find((item) => item.id_material === Number(id) && item.estado === 'Activo') || null;
}

module.exports = {
  initDB,
  verifyAdminCredentials,
  createRegistro,
  listRegistros,
  getRegistro,
  getStats,
  createAccessCode,
  listAccessCodes,
  validateAccessCode,
  createMaterial,
  listMaterials,
  deleteMaterial,
  getMaterialById
};

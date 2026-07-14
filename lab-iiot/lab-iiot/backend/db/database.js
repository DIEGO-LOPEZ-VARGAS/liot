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
        integrantes JSONB,
        materiales JSONB,
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
      nextId: 1
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  }
}

async function readJSONStore() {
  const content = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(content);
}

async function writeJSONStore(store) {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
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

async function createRegistro({ laboratorio, integrantes, materiales }) {
  const fecha = new Date().toISOString().split('T')[0];
  const hora = new Date().toTimeString().split(' ')[0];

  if (pool && !useJSON) {
    const folio = `REG-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO registros (folio, laboratorio, numero_integrantes, estado, fecha, hora, integrantes, materiales)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id as id_registro, folio, laboratorio, numero_integrantes, estado, fecha, hora, integrantes, materiales`,
      [folio, laboratorio, integrantes.length, 'Completado', fecha, hora, JSON.stringify(integrantes), JSON.stringify(materiales)]
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
      const integrantes = r.integrantes.some((i) =>
        `${i.nombre_completo} ${i.matricula}`.toLowerCase().includes(texto)
      );
      return integrantes;
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

module.exports = {
  initDB,
  verifyAdminCredentials,
  createRegistro,
  listRegistros,
  getRegistro,
  getStats
};

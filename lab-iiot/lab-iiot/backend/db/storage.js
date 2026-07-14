const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

function crearAdminPorDefecto() {
  return {
    id_administrador: 1,
    nombre: 'Administrador',
    usuario: 'admin',
    contrasena: bcrypt.hashSync('admin123', 10),
    rol: 'admin'
  };
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    const storeInicial = {
      administradores: [crearAdminPorDefecto()],
      registros: [],
      nextId: 1
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(storeInicial, null, 2));
    return storeInicial;
  }

  const contenido = await fs.readFile(DATA_FILE, 'utf8');
  const store = JSON.parse(contenido);

  if (!Array.isArray(store.administradores) || store.administradores.length === 0) {
    store.administradores = [crearAdminPorDefecto()];
  }

  if (!store.registros) {
    store.registros = [];
  }

  if (typeof store.nextId !== 'number') {
    store.nextId = Math.max(...store.registros.map((r) => r.id_registro || 0), 0) + 1;
  }

  if (!store.administradores.some((admin) => admin.usuario === 'admin')) {
    store.administradores.unshift(crearAdminPorDefecto());
  }

  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  return store;
}

async function loadStore() {
  return ensureStore();
}

async function saveStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

async function verifyAdminCredentials(usuario, contrasena) {
  const store = await loadStore();
  const admin = store.administradores.find((item) => item.usuario.toLowerCase() === usuario.toLowerCase());

  if (!admin) {
    return null;
  }

  const valido = await bcrypt.compare(contrasena, admin.contrasena);
  return valido ? admin : null;
}

async function createRegistro({ laboratorio, integrantes, materiales, fecha, hora }) {
  const store = await loadStore();

  const registro = {
    id_registro: store.nextId,
    folio: `REG-${String(store.nextId).padStart(6, '0')}`,
    laboratorio,
    numero_integrantes: integrantes.length,
    estado: 'Completado',
    fecha: fecha || new Date().toISOString().split('T')[0],
    hora: hora || new Date().toTimeString().split(' ')[0],
    creado_en: new Date().toISOString(),
    integrantes: integrantes.map((item) => ({ ...item })),
    materiales: materiales.map((item) => ({ ...item }))
  };

  store.registros.unshift(registro);
  store.nextId += 1;
  await saveStore(store);
  return registro;
}

async function listRegistros(filtros = {}) {
  const store = await loadStore();
  let registros = [...store.registros];

  if (filtros.fecha) {
    registros = registros.filter((registro) => registro.fecha === filtros.fecha);
  }

  if (filtros.laboratorio) {
    registros = registros.filter((registro) => registro.laboratorio === filtros.laboratorio);
  }

  if (filtros.busqueda) {
    const texto = filtros.busqueda.toLowerCase();
    registros = registros.filter((registro) => {
      const coincidenciaIntegrante = registro.integrantes.some((integrante) => {
        const textoIntegrante = `${integrante.nombre_completo} ${integrante.matricula}`.toLowerCase();
        return textoIntegrante.includes(texto);
      });

      const coincidenciaMaterial = registro.materiales.some((material) => {
        return material.nombre_material.toLowerCase().includes(texto);
      });

      return coincidenciaIntegrante || coincidenciaMaterial;
    });
  }

  return registros
    .sort((a, b) => b.id_registro - a.id_registro)
    .map((registro) => ({ ...registro, total_materiales: registro.materiales.length }));
}

async function getRegistro(id) {
  const store = await loadStore();
  return store.registros.find((registro) => registro.id_registro === Number(id)) || null;
}

async function getStats() {
  const store = await loadStore();
  const hoy = new Date().toISOString().split('T')[0];
  const registrosHoy = store.registros.filter((registro) => registro.fecha === hoy);

  return {
    registros_hoy: registrosHoy.length,
    labs_activos: new Set(registrosHoy.map((registro) => registro.laboratorio)).size,
    materiales_total: registrosHoy.reduce((total, registro) => total + registro.materiales.length, 0),
    equipos_atendidos: registrosHoy.length
  };
}

module.exports = {
  verifyAdminCredentials,
  createRegistro,
  listRegistros,
  getRegistro,
  getStats
};

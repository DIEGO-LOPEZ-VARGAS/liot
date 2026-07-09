const crypto = require('crypto');
const { verifyAdminCredentials } = require('../db/database');

// POST /api/auth/login
async function login(req, res) {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  try {
    const admin = await verifyAdminCredentials(usuario, contrasena);

    if (!admin) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    req.app.locals.adminToken = token;

    res.json({
      mensaje: 'Login exitoso',
      token,
      nombre: admin.nombre,
      rol: admin.rol
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  req.app.locals.adminToken = null;
  res.json({ mensaje: 'Sesión cerrada' });
}

module.exports = { login, logout };

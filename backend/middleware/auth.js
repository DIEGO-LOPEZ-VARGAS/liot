// Middleware simple de sesión para el panel admin
function requireAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || token !== req.app.locals.adminToken) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

module.exports = { requireAuth };

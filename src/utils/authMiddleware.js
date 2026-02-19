const { verifyToken } = require('../config/jwt');

const protect = async (req, res, next) => {
  try {
    let token;

    // Verificar si hay token en headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token inválido'
      });
    }

    // Buscar usuario
    const [users] = await req.app.locals.db.query(
      'SELECT ID, Usuario, RolID, Activo FROM usuarios WHERE ID = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario no encontrado'
      });
    }

    const user = users[0];

    if (!user.Activo) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario inactivo'
      });
    }

    // Obtener nombre del rol
    const [roles] = await req.app.locals.db.query(
      'SELECT Nombre FROM Roles WHERE ID = ?',
      [user.RolID]
    );

    // Agregar usuario a req
    req.user = {
      id: user.ID,
      usuario: user.Usuario,
      rol: roles[0]?.Nombre || 'employee',
      rolId: user.RolID
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(401).json({
      success: false,
      message: 'No autorizado - Error de autenticación'
    });
  }
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: `No autorizado - Se requiere rol: ${roles.join(' o ')}`
      });
    }

    next();
  };
};

module.exports = { protect, authorize };
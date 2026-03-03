const { verifyToken } = require('../config/jwt');
const User = require('../models/userModel');

const authenticate = async (req, res, next) => {
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
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario no encontrado'
      });
    }

    if (!user.Activo) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Usuario inactivo'
      });
    }

    // Agregar usuario a req
    req.user = {
      id: user.ID,
      usuario: user.Usuario,
      rol: user.Rol,
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

module.exports = { authenticate };
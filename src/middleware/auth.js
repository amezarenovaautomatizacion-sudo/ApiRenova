const { verifyToken } = require('../config/jwt');
const User = require('../models/userModel');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado. Token no proporcionado.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado.'
      });
    }

    // Obtener usuario de la base de datos para verificar rol
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado.'
      });
    }

    // Agregar información del usuario a la request
    req.user = {
      id: user.ID,
      usuario: user.Usuario,
      rol: user.Rol
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación.'
    });
  }
};

module.exports = { authenticate };
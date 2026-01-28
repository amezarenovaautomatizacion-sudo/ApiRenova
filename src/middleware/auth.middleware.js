const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Middleware para verificar JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Bearer token
  
  if (!token) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token no proporcionado' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token inválido o expirado' 
      });
    }
    
    req.userId = decoded.id_usuario;
    next();
  });
};

// Middleware para verificar permisos por módulo
const checkPermission = (modulo, permiso = 'leer') => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      // Consultar permisos del usuario para el módulo específico
      const sql = `
        SELECT ${permiso} 
        FROM vista_permisos_usuario 
        WHERE id_usuario = ? 
        AND nombre_modulo = ?
        AND ${permiso} = 1
        LIMIT 1
      `;
      
      const results = await query(sql, [userId, modulo]);
      
      if (results.length === 0) {
        return res.status(403).json({
          success: false,
          message: `No tiene permiso para ${permiso} en ${modulo}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error verificando permisos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

// Middleware para verificar rol
const checkRole = (rolesPermitidos) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      const sql = `
        SELECT r.nombre_rol
        FROM usuarios u
        JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
        JOIN roles r ON ur.id_rol = r.id_rol
        WHERE u.id_usuario = ?
      `;
      
      const userRoles = await query(sql, [userId]);
      
      const tieneRol = userRoles.some(rol => 
        rolesPermitidos.includes(rol.nombre_rol)
      );
      
      if (!tieneRol) {
        return res.status(403).json({
          success: false,
          message: 'No tiene los permisos necesarios'
        });
      }
      
      next();
    } catch (error) {
      console.error('Error verificando rol:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

module.exports = {
  verifyToken,
  checkPermission,
  checkRole
};
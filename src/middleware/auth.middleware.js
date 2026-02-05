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
      
      // Consultar roles del usuario
      const sql = `
        SELECT r.nombre_rol 
        FROM usuarios_roles ur
        JOIN roles r ON ur.id_rol = r.id_rol
        WHERE ur.id_usuario = ?
      `;
      
      const results = await query(sql, [userId]);
      
      if (results.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Usuario sin roles asignados'
        });
      }
      
      const userRoles = results.map(r => r.nombre_rol);
      const tienePermiso = rolesPermitidos.some(rol => userRoles.includes(rol));
      
      if (!tienePermiso) {
        return res.status(403).json({
          success: false,
          message: `No tiene permiso. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error verificando roles:', error);
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
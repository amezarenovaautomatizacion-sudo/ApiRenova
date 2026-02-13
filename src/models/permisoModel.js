const { pool } = require('../config/database');

const Permiso = {
  // Verificar si un usuario tiene permiso para un endpoint
  verificarPermiso: async (usuarioId, endpoint, metodo) => {
    try {
      const [rows] = await pool.query(
        `SELECT p.* 
         FROM Permisos p
         JOIN RolPermisos rp ON p.ID = rp.PermisoID
         JOIN Roles r ON rp.RolID = r.ID
         JOIN Usuarios u ON u.RolID = r.ID
         WHERE u.ID = ? 
           AND p.Endpoint LIKE ?
           AND p.Metodo = ?
           AND p.Activo = TRUE
           AND r.Activo = TRUE
           AND u.Activo = TRUE`,
        [usuarioId, endpoint.replace(/:id/g, '%'), metodo]
      );
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error verificando permiso:', error);
      return false;
    }
  },

  // Obtener todos los permisos de un usuario
  obtenerPermisosUsuario: async (usuarioId) => {
    try {
      const [rows] = await pool.query(
        `SELECT p.ID, p.Nombre, p.Endpoint, p.Metodo, p.Descripcion
         FROM Permisos p
         JOIN RolPermisos rp ON p.ID = rp.PermisoID
         JOIN Roles r ON rp.RolID = r.ID
         JOIN Usuarios u ON u.RolID = r.ID
         WHERE u.ID = ? 
           AND p.Activo = TRUE
           AND r.Activo = TRUE
           AND u.Activo = TRUE`,
        [usuarioId]
      );
      
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener rol del usuario
  obtenerRolUsuario: async (usuarioId) => {
    try {
      const [rows] = await pool.query(
        `SELECT r.* 
         FROM Roles r
         JOIN Usuarios u ON u.RolID = r.ID
         WHERE u.ID = ? AND u.Activo = TRUE AND r.Activo = TRUE`,
        [usuarioId]
      );
      
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Obtener todos los roles
  obtenerRoles: async () => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM Roles WHERE Activo = TRUE ORDER BY Nivel DESC'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener todos los permisos
  obtenerPermisos: async () => {
    try {
      const [rows] = await pool.query(
        `SELECT p.*, GROUP_CONCAT(r.Nombre SEPARATOR ', ') as Roles
         FROM Permisos p
         LEFT JOIN RolPermisos rp ON p.ID = rp.PermisoID
         LEFT JOIN Roles r ON rp.RolID = r.ID
         WHERE p.Activo = TRUE
         GROUP BY p.ID
         ORDER BY p.Endpoint, p.Metodo`
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Permiso;
const { pool } = require('../config/database');

const User = {
  findByEmail: async (email) => {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, r.Nombre as RolNombre, r.Nivel as RolNivel
         FROM usuarios u
         LEFT JOIN roles r ON u.RolID = r.ID
         WHERE u.Usuario = ? AND u.Activo = TRUE`,
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  findById: async (id) => {
    try {
      const [rows] = await pool.query(
        `SELECT u.ID, u.Usuario, u.Rol, u.RolID, u.Activo, u.createdAt,
                r.Nombre as RolNombre, r.Nivel as RolNivel, r.Descripcion as RolDescripcion
         FROM usuarios u
         LEFT JOIN roles r ON u.RolID = r.ID
         WHERE u.ID = ? AND u.Activo = TRUE`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  create: async (usuario, contrasenia, rolId) => {
    try {
      // Obtener nombre del rol
      const [rol] = await pool.query('SELECT Nombre FROM roles WHERE ID = ?', [rolId]);
      const rolNombre = rol[0]?.Nombre || 'employee';

      const [result] = await pool.query(
        'INSERT INTO usuarios (Usuario, Contrasenia, Rol, RolID) VALUES (?, ?, ?, ?)',
        [usuario, contrasenia, rolNombre, rolId]
      );
      return { 
        id: result.insertId, 
        usuario, 
        rol: rolNombre,
        rolId 
      };
    } catch (error) {
      throw error;
    }
  },

  updateRol: async (id, rolId) => {
    try {
      // Obtener nombre del rol
      const [rol] = await pool.query('SELECT Nombre FROM roles WHERE ID = ?', [rolId]);
      const rolNombre = rol[0]?.Nombre || 'employee';

      const [result] = await pool.query(
        'UPDATE usuarios SET Rol = ?, RolID = ? WHERE ID = ?',
        [rolNombre, rolId, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = User;
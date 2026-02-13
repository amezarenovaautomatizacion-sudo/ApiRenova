const { pool } = require('../config/database');

const TipoIncidencia = {
  // Obtener todos los tipos activos
  findAll: async () => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM TiposIncidencia WHERE Activo = TRUE ORDER BY Nombre'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener todos los tipos (incluyendo inactivos - solo admin)
  findAllWithInactive: async () => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM TiposIncidencia ORDER BY Activo DESC, Nombre'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Buscar por ID
  findById: async (id) => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM TiposIncidencia WHERE ID = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Crear nuevo tipo
  create: async (nombre, descripcion) => {
    try {
      const [result] = await pool.query(
        'INSERT INTO TiposIncidencia (Nombre, Descripcion) VALUES (?, ?)',
        [nombre, descripcion]
      );
      return { id: result.insertId, nombre, descripcion };
    } catch (error) {
      throw error;
    }
  },

  // Actualizar tipo
  update: async (id, nombre, descripcion) => {
    try {
      const [result] = await pool.query(
        'UPDATE TiposIncidencia SET Nombre = ?, Descripcion = ? WHERE ID = ?',
        [nombre, descripcion, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  },

  // Activar/desactivar tipo
  toggleActive: async (id, activo) => {
    try {
      const [result] = await pool.query(
        'UPDATE TiposIncidencia SET Activo = ? WHERE ID = ?',
        [activo, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = TipoIncidencia;
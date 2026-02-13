const { pool } = require('../config/database');

const Catalogo = {
  // Puestos
  getPuestos: async () => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM Puestos WHERE Activo = TRUE ORDER BY Nombre'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  createPuesto: async (nombre, descripcion) => {
    try {
      const [result] = await pool.query(
        'INSERT INTO Puestos (Nombre, Descripcion) VALUES (?, ?)',
        [nombre, descripcion]
      );
      return { id: result.insertId, nombre, descripcion };
    } catch (error) {
      throw error;
    }
  },

  // Departamentos
  getDepartamentos: async () => {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM Departamentos WHERE Activo = TRUE ORDER BY Nombre'
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  createDepartamento: async (nombre, descripcion) => {
    try {
      const [result] = await pool.query(
        'INSERT INTO Departamentos (Nombre, Descripcion) VALUES (?, ?)',
        [nombre, descripcion]
      );
      return { id: result.insertId, nombre, descripcion };
    } catch (error) {
      throw error;
    }
  },

  // Empleados para select (solo nombre y ID)
  getEmpleadosSelect: async () => {
    try {
      const [rows] = await pool.query(
        `SELECT e.ID, e.NombreCompleto, e.CorreoElectronico, e.RolApp 
         FROM Empleados e
         JOIN Usuarios u ON e.UsuarioID = u.ID
         WHERE u.Activo = TRUE
         ORDER BY e.NombreCompleto`
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Catalogo;
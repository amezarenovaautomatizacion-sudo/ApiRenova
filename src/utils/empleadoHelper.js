const { pool } = require('../config/database');

const empleadoHelper = {
  obtenerEmpleadoId: async (usuarioId) => {
    try {
      const [empleado] = await pool.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);
      
      return empleado[0]?.ID || null;
    } catch (error) {
      console.error('Error obteniendo ID de empleado:', error);
      throw error;
    }
  },

  obtenerEmpleadoPorUsuarioId: async (usuarioId) => {
    try {
      const [empleado] = await pool.query(`
        SELECT e.*, p.Nombre as PuestoNombre
        FROM empleados e
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        WHERE e.UsuarioID = ?
      `, [usuarioId]);
      
      return empleado[0] || null;
    } catch (error) {
      console.error('Error obteniendo empleado:', error);
      throw error;
    }
  },

  esJefeDeEmpleado: async (jefeId, empleadoId) => {
    try {
      const [relacion] = await pool.query(`
        SELECT 1 FROM empleadojefes 
        WHERE JefeID = ? AND EmpleadoID = ?
      `, [jefeId, empleadoId]);
      
      return relacion.length > 0;
    } catch (error) {
      console.error('Error verificando relación jefe-empleado:', error);
      throw error;
    }
  }
};

module.exports = empleadoHelper;
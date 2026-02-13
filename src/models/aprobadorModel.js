const { pool } = require('../config/database');

const Aprobador = {
  // Agregar un usuario como aprobador
  agregarAprobador: async (usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Verificar que el usuario existe y tiene rol admin o manager
      const [usuario] = await connection.query(
        `SELECT u.ID, r.Nombre as Rol 
         FROM Usuarios u
         JOIN Roles r ON u.RolID = r.ID
         WHERE u.ID = ? AND u.Activo = TRUE AND r.Nombre IN ('admin', 'manager')`,
        [usuarioId]
      );

      if (usuario.length === 0) {
        throw new Error('El usuario no existe o no tiene rol de admin/manager');
      }

      // 2. Verificar si ya es aprobador activo
      const [yaEsAprobador] = await connection.query(
        'SELECT ID FROM Aprobadores WHERE UsuarioID = ? AND Activo = TRUE',
        [usuarioId]
      );

      if (yaEsAprobador.length > 0) {
        throw new Error('El usuario ya es un aprobador activo');
      }

      // 3. Buscar registro inactivo para reutilizar
      const [registroInactivo] = await connection.query(
        'SELECT ID FROM Aprobadores WHERE UsuarioID IS NULL AND Activo = FALSE LIMIT 1'
      );

      let resultado;
      if (registroInactivo.length > 0) {
        // Reutilizar registro inactivo
        const [updateResult] = await connection.query(
          'UPDATE Aprobadores SET UsuarioID = ?, Activo = TRUE WHERE ID = ?',
          [usuarioId, registroInactivo[0].ID]
        );
        
        resultado = {
          id: registroInactivo[0].ID,
          usuarioId,
          mensaje: 'Aprobador agregado (registro reutilizado)'
        };
      } else {
        // Crear nuevo registro
        const [insertResult] = await connection.query(
          'INSERT INTO Aprobadores (UsuarioID, Activo) VALUES (?, TRUE)',
          [usuarioId]
        );
        
        resultado = {
          id: insertResult.insertId,
          usuarioId,
          mensaje: 'Aprobador agregado (nuevo registro)'
        };
      }

      await connection.commit();
      return resultado;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Quitar aprobador (soft delete)
  quitarAprobador: async (usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Verificar que existe como aprobador activo
      const [aprobador] = await connection.query(
        'SELECT ID FROM Aprobadores WHERE UsuarioID = ? AND Activo = TRUE',
        [usuarioId]
      );

      if (aprobador.length === 0) {
        throw new Error('El usuario no es un aprobador activo');
      }

      // 2. Marcar como inactivo y establecer UsuarioID a NULL
      const [updateResult] = await connection.query(
        'UPDATE Aprobadores SET UsuarioID = NULL, Activo = FALSE WHERE ID = ?',
        [aprobador[0].ID]
      );

      await connection.commit();
      return {
        id: aprobador[0].ID,
        usuarioId,
        mensaje: 'Aprobador quitado exitosamente',
        registrosAfectados: updateResult.affectedRows
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener todos los aprobadores activos
  obtenerAprobadoresActivos: async () => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          a.ID,
          a.UsuarioID,
          u.Usuario,
          e.NombreCompleto,
          r.Nombre as Rol,
          a.createdAt
         FROM Aprobadores a
         JOIN Usuarios u ON a.UsuarioID = u.ID
         LEFT JOIN Empleados e ON u.ID = e.UsuarioID
         LEFT JOIN Roles r ON u.RolID = r.ID
         WHERE a.Activo = TRUE
         ORDER BY a.createdAt`
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Verificar si un usuario es aprobador
  esAprobador: async (usuarioId) => {
    try {
      const [rows] = await pool.query(
        'SELECT ID FROM Aprobadores WHERE UsuarioID = ? AND Activo = TRUE',
        [usuarioId]
      );
      return rows.length > 0;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Aprobador;
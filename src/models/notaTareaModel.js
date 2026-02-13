const { pool } = require('../config/database');

const NotaTarea = {
  // Crear nueva nota
  crear: async (notaData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insertar nota
      const [result] = await connection.query(`
        INSERT INTO notas_tarea (
          TareaID, EmpleadoID, Contenido, EsPrivada, CreadoPor
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        notaData.tareaId,
        notaData.empleadoId,
        notaData.contenido,
        notaData.esPrivada || 0,
        notaData.creadoPor
      ]);

      const notaId = result.insertId;

      await connection.commit();

      // Obtener nota creada
      const [nota] = await connection.query(`
        SELECT nt.*,
               e.NombreCompleto,
               u.Usuario as CreadorUsuario
        FROM notas_tarea nt
        LEFT JOIN empleados e ON nt.EmpleadoID = e.ID
        LEFT JOIN usuarios u ON nt.CreadoPor = u.ID
        WHERE nt.ID = ?
      `, [notaId]);

      return nota[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Listar notas de una tarea
  listarPorTarea: async (tareaId, usuarioId, usuarioRol) => {
    try {
      // Verificar acceso a la tarea
      const Tarea = require('./tareaModel');
      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      
      if (!tarea) {
        throw new Error('No tienes acceso a esta tarea');
      }

      const [rows] = await pool.query(`
        SELECT 
          nt.*,
          e.NombreCompleto,
          e.CorreoElectronico,
          u.Usuario as CreadorUsuario
        FROM notas_tarea nt
        LEFT JOIN empleados e ON nt.EmpleadoID = e.ID
        LEFT JOIN usuarios u ON nt.CreadoPor = u.ID
        WHERE nt.TareaID = ? AND nt.Activo = 1
        ORDER BY nt.createdAt DESC
      `, [tareaId]);

      return rows;

    } catch (error) {
      throw error;
    }
  },

  // Actualizar nota
  actualizar: async (notaId, notaData, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Verificar que el usuario sea el creador de la nota
      const [nota] = await connection.query(`
        SELECT CreadoPor FROM notas_tarea WHERE ID = ? AND Activo = 1
      `, [notaId]);

      if (nota.length === 0) {
        throw new Error('Nota no encontrada');
      }

      if (nota[0].CreadoPor !== usuarioId) {
        throw new Error('Solo el creador puede actualizar la nota');
      }

      const [result] = await connection.query(`
        UPDATE notas_tarea 
        SET Contenido = ?, EsPrivada = ?, updatedAt = NOW()
        WHERE ID = ? AND Activo = 1
      `, [
        notaData.contenido,
        notaData.esPrivada || 0,
        notaId
      ]);

      if (result.affectedRows === 0) {
        throw new Error('Error al actualizar la nota');
      }

      await connection.commit();

      // Obtener nota actualizada
      const [notaActualizada] = await connection.query(`
        SELECT * FROM notas_tarea WHERE ID = ?
      `, [notaId]);

      return notaActualizada[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Eliminar nota
  eliminar: async (notaId, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Verificar que el usuario sea el creador de la nota
      const [nota] = await connection.query(`
        SELECT CreadoPor FROM notas_tarea WHERE ID = ? AND Activo = 1
      `, [notaId]);

      if (nota.length === 0) {
        throw new Error('Nota no encontrada');
      }

      if (nota[0].CreadoPor !== usuarioId) {
        throw new Error('Solo el creador puede eliminar la nota');
      }

      const [result] = await connection.query(`
        UPDATE notas_tarea 
        SET Activo = 0, updatedAt = NOW()
        WHERE ID = ? AND Activo = 1
      `, [notaId]);

      if (result.affectedRows === 0) {
        throw new Error('Error al eliminar la nota');
      }

      await connection.commit();

      return {
        id: notaId,
        eliminada: true
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = NotaTarea;
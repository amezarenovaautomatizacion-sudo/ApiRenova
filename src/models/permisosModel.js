const { pool } = require('../config/database');

const PermisosModel = {
  // Solicitar permiso
  solicitarPermiso: async (solicitudData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Validar que no sea más de 24 horas antes
      const fechaInicio = new Date(solicitudData.fechaInicio);
      const ahora = new Date();
      const diferenciaHoras = (fechaInicio - ahora) / (1000 * 60 * 60);

      if (diferenciaHoras > 24) {
        throw new Error('Los permisos solo se pueden solicitar con máximo 24 horas de anticipación');
      }

      // Validar que sea solo un día (para permisos de falta)
      if (solicitudData.diasSolicitados > 1) {
        throw new Error('Los permisos de falta son solo para un día');
      }

      // Crear solicitud
      const [solicitudResult] = await connection.query(
        `INSERT INTO solicitudes 
         (EmpleadoID, Tipo, Estado, Motivo, FechaSolicitud, 
          FechaInicio, FechaFin, DiasSolicitados, ConGoce, Observaciones) 
         VALUES (?, 'permiso', 'pendiente', ?, CURDATE(), ?, ?, ?, ?, ?)`,
        [
          solicitudData.empleadoId,
          solicitudData.motivo,
          solicitudData.fechaInicio,
          solicitudData.fechaFin || solicitudData.fechaInicio,
          solicitudData.diasSolicitados || 1,
          solicitudData.conGoce !== false, // Default true
          solicitudData.observaciones || null
        ]
      );

      const solicitudId = solicitudResult.insertId;

      // Crear aprobaciones para los 3 aprobadores
      const [aprobadores] = await connection.query(
        `SELECT u.ID as UsuarioID, a.ID as AprobadorID
         FROM aprobadores a
         JOIN usuarios u ON a.UsuarioID = u.ID
         WHERE a.Activo = TRUE
         ORDER BY a.createdAt
         LIMIT 3`
      );

      for (let i = 0; i < aprobadores.length; i++) {
        await connection.query(
          `INSERT INTO aprobacionessolicitud 
           (SolicitudID, AprobadorID, OrdenAprobacion, Estado) 
           VALUES (?, ?, ?, 'pendiente')`,
          [solicitudId, aprobadores[i].UsuarioID, i + 1]
        );
      }

      // Registrar en historial
      await connection.query(
        `INSERT INTO historialsolicitud 
         (SolicitudID, UsuarioID, Accion, EstadoNuevo, Comentarios) 
         VALUES (?, ?, 'solicitud_creada', 'pendiente', 'Solicitud de permiso creada')`,
        [solicitudId, solicitudData.creadoPor]
      );

      await connection.commit();

      return {
        solicitudId,
        aprobadores: aprobadores.length,
        fechaInicio: solicitudData.fechaInicio
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener permisos pendientes de aprobación
  obtenerPermisosPendientes: async (aprobadorId) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico,
          aps.ID as AprobacionID,
          aps.OrdenAprobacion,
          TIMESTAMPDIFF(HOUR, NOW(), s.FechaInicio) as HorasRestantes,
          CASE 
            WHEN TIMESTAMPDIFF(HOUR, NOW(), s.FechaInicio) <= 0 THEN 'urgente'
            WHEN TIMESTAMPDIFF(HOUR, NOW(), s.FechaInicio) <= 12 THEN 'proximo'
            ELSE 'normal'
          END as Prioridad
         FROM solicitudes s
         JOIN empleados e ON s.EmpleadoID = e.ID
         JOIN aprobacionessolicitud aps ON s.ID = aps.SolicitudID
         WHERE aps.AprobadorID = ? 
           AND aps.Estado = 'pendiente'
           AND s.Tipo = 'permiso'
           AND s.Estado = 'pendiente'
           AND s.Activo = TRUE
         ORDER BY 
           CASE Prioridad
             WHEN 'urgente' THEN 1
             WHEN 'proximo' THEN 2
             ELSE 3
           END,
           s.FechaSolicitud DESC`,
        [aprobadorId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = PermisosModel;
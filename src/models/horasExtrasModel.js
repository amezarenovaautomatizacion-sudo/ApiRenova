const { pool } = require('../config/database');

const HorasExtras = {
  // Solicitar horas extras (solo manager/admin)
  solicitarHorasExtras: async (solicitudData, solicitanteRol) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Validar que solo manager/admin puede crear
      if (!['admin', 'manager'].includes(solicitanteRol)) {
        throw new Error('Solo administradores y managers pueden solicitar horas extras');
      }

      // Validar horas solicitadas
      if (solicitudData.horasSolicitadas <= 0 || solicitudData.horasSolicitadas > 12) {
        throw new Error('Las horas extras deben ser entre 0.5 y 12 horas');
      }

      // Crear solicitud
      const [solicitudResult] = await connection.query(
        `INSERT INTO Solicitudes 
         (EmpleadoID, Tipo, Estado, Motivo, FechaSolicitud, 
          FechaInicio, HorasSolicitadas, Observaciones) 
         VALUES (?, 'horas_extras', 'pendiente', ?, CURDATE(), ?, ?, ?)`,
        [
          solicitudData.empleadoId,
          solicitudData.motivo,
          solicitudData.fechaInicio,
          solicitudData.horasSolicitadas,
          solicitudData.observaciones || null
        ]
      );

      const solicitudId = solicitudResult.insertId;

      // Crear aprobaciones para los 3 aprobadores
      const [aprobadores] = await connection.query(
        `SELECT u.ID as UsuarioID, a.ID as AprobadorID
         FROM Aprobadores a
         JOIN Usuarios u ON a.UsuarioID = u.ID
         WHERE a.Activo = TRUE
         ORDER BY a.createdAt
         LIMIT 3`
      );

      for (let i = 0; i < aprobadores.length; i++) {
        await connection.query(
          `INSERT INTO AprobacionesSolicitud 
           (SolicitudID, AprobadorID, OrdenAprobacion, Estado) 
           VALUES (?, ?, ?, 'pendiente')`,
          [solicitudId, aprobadores[i].UsuarioID, i + 1]
        );
      }

      // Registrar en historial
      await connection.query(
        `INSERT INTO HistorialSolicitud 
         (SolicitudID, UsuarioID, Accion, EstadoNuevo, Comentarios) 
         VALUES (?, ?, 'solicitud_creada', 'pendiente', 'Solicitud de horas extras creada')`,
        [solicitudId, solicitudData.creadoPor]
      );

      await connection.commit();

      return {
        solicitudId,
        aprobadores: aprobadores.length,
        horasSolicitadas: solicitudData.horasSolicitadas
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener reporte de horas extras
  obtenerReporteHorasExtras: async (filtros = {}) => {
    try {
      let query = `
        SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico,
          e.PuestoID,
          p.Nombre as PuestoNombre,
          SUM(CASE WHEN aps.Estado = 'aprobada' THEN 1 ELSE 0 END) as Aprobaciones,
          SUM(CASE WHEN aps.Estado = 'rechazado' THEN 1 ELSE 0 END) as Rechazos
        FROM Solicitudes s
        JOIN Empleados e ON s.EmpleadoID = e.ID
        LEFT JOIN Puestos p ON e.PuestoID = p.ID
        LEFT JOIN AprobacionesSolicitud aps ON s.ID = aps.SolicitudID
        WHERE s.Tipo = 'horas_extras' AND s.Activo = TRUE
      `;
      
      const params = [];
      
      if (filtros.empleadoId) {
        query += ' AND s.EmpleadoID = ?';
        params.push(filtros.empleadoId);
      }
      
      if (filtros.estado) {
        query += ' AND s.Estado = ?';
        params.push(filtros.estado);
      }
      
      if (filtros.fechaDesde) {
        query += ' AND s.FechaInicio >= ?';
        params.push(filtros.fechaDesde);
      }
      
      if (filtros.fechaHasta) {
        query += ' AND s.FechaInicio <= ?';
        params.push(filtros.fechaHasta);
      }
      
      query += ' GROUP BY s.ID ORDER BY s.FechaInicio DESC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = HorasExtras;
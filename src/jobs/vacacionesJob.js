const { pool } = require('../config/database');
const cron = require('node-cron');

const vacacionesJob = {
  // Programar vacaciones automáticas (ejecutar diario)
  programarVacacionesAutomaticas: async () => {
    try {
      console.log('🔍 Ejecutando job: programar vacaciones automáticas');
      
      const [empleadosConVigencia] = await pool.query(
        `SELECT 
          ve.ID,
          ve.EmpleadoID,
          ve.ProximoPeriodo,
          ve.VigenciaHasta,
          e.NombreCompleto,
          e.CorreoElectronico,
          DATEDIFF(ve.ProximoPeriodo, CURDATE()) as DiasParaProgramar
         FROM VacacionesEmpleado ve
         JOIN Empleados e ON ve.EmpleadoID = e.ID
         WHERE ve.Activo = TRUE
           AND ve.ProximoPeriodo <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           AND ve.VigenciaHasta > CURDATE()
           AND NOT EXISTS (
             SELECT 1 FROM PeriodosVacacionales pv 
             WHERE pv.VacacionesEmpleadoID = ve.ID 
               AND pv.Estado IN ('programado', 'en_proceso')
               AND pv.Activo = TRUE
           )`
      );
      
      console.log(`📊 Empleados a programar vacaciones: ${empleadosConVigencia.length}`);
      
      for (const empleado of empleadosConVigencia) {
        console.log(`👤 Programando vacaciones para: ${empleado.NombreCompleto}`);
        
        // Programar vacaciones 15 días antes de que venzan
        const fechaInicio = new Date(empleado.VigenciaHasta);
        fechaInicio.setDate(fechaInicio.getDate() - 15);
        
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + 6); // 7 días de vacaciones
        
        // Verificar días disponibles
        const [derechos] = await pool.query(
          'SELECT DiasDisponibles FROM VacacionesEmpleado WHERE EmpleadoID = ?',
          [empleado.EmpleadoID]
        );
        
        if (derechos.length > 0 && derechos[0].DiasDisponibles >= 7) {
          // Crear solicitud automática
          const [solicitudResult] = await pool.query(
            `INSERT INTO Solicitudes 
             (EmpleadoID, Tipo, Estado, Motivo, FechaSolicitud, 
              FechaInicio, FechaFin, DiasSolicitados, Observaciones) 
             VALUES (?, 'vacaciones', 'pendiente', ?, CURDATE(), ?, ?, ?, ?)`,
            [
              empleado.EmpleadoID,
              'Vacaciones programadas automáticamente por sistema',
              fechaInicio.toISOString().split('T')[0],
              fechaFin.toISOString().split('T')[0],
              7,
              'Sistema automático de programación de vacaciones'
            ]
          );

          const solicitudId = solicitudResult.insertId;

          // Crear periodo vacacional
          await pool.query(
            `INSERT INTO PeriodosVacacionales 
             (VacacionesEmpleadoID, SolicitudID, FechaInicio, FechaFin, DiasTomados, Estado, EsAutomatico) 
             VALUES (?, ?, ?, ?, 7, 'programado', TRUE)`,
            [
              empleado.ID,
              solicitudId,
              fechaInicio.toISOString().split('T')[0],
              fechaFin.toISOString().split('T')[0]
            ]
          );
          
          // Crear aprobaciones para los 3 aprobadores
          const [aprobadores] = await pool.query(
            `SELECT u.ID as UsuarioID, a.ID as AprobadorID
             FROM Aprobadores a
             JOIN Usuarios u ON a.UsuarioID = u.ID
             WHERE a.Activo = TRUE
             ORDER BY a.createdAt
             LIMIT 3`
          );

          for (let i = 0; i < aprobadores.length; i++) {
            await pool.query(
              `INSERT INTO AprobacionesSolicitud 
               (SolicitudID, AprobadorID, OrdenAprobacion, Estado) 
               VALUES (?, ?, ?, 'pendiente')`,
              [solicitudId, aprobadores[i].UsuarioID, i + 1]
            );
          }
          
          console.log(`✅ Vacaciones programadas automáticamente para ${empleado.NombreCompleto}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Error en job de vacaciones:', error);
    }
  },
  
  // Iniciar jobs programados
  iniciarJobs: () => {
    // Ejecutar diario a las 2:00 AM
    cron.schedule('0 2 * * *', () => {
      vacacionesJob.programarVacacionesAutomaticas();
    });
    
    console.log('Jobs de vacaciones programados');
  }
};

module.exports = vacacionesJob;
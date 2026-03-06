const Vacaciones = require('../models/vacacionesModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const vacacionesController = {
  obtenerMisDerechos: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      const derechos = await Vacaciones.obtenerDerechosEmpleado(empleado[0].ID);
      
      if (!derechos) {
        const calculo = await Vacaciones.calcularDerechos(empleado[0].ID);
        const calculoFormateado = formatDateFields(
          calculo,
          ['primerAniversario', 'vigenciaHasta', 'proximoPeriodo', 'hoy'],
          []
        );
        return res.status(200).json({
          success: true,
          data: calculoFormateado,
          mensaje: 'Derechos calculados'
        });
      }
      
      const derechosFormateados = formatDateFields(
        derechos,
        ['VigenciaHasta', 'ProximoPeriodo'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: derechosFormateados
      });
    } catch (error) {
      next(error);
    }
  },
  
  solicitarVacaciones: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { fechaInicio, fechaFin, motivo, observaciones } = req.body;
      
      if (!fechaInicio || !fechaFin || !motivo) {
        return res.status(400).json({
          success: false,
          message: 'Fecha inicio, fecha fin y motivo son requeridos'
        });
      }
      
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      const diasSolicitados = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
      
      const solicitudData = {
        empleadoId: empleado[0].ID,
        motivo,
        fechaInicio: inicio.toISOString().split('T')[0],
        fechaFin: fin.toISOString().split('T')[0],
        diasSolicitados,
        observaciones,
        creadoPor: usuarioId
      };
      
      const resultado = await Vacaciones.solicitarVacaciones(solicitudData);
      
      res.status(201).json({
        success: true,
        message: 'Solicitud de vacaciones creada exitosamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('No tiene días suficientes')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },
  
  obtenerMisSolicitudes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { tipo } = req.query;
      
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      const solicitudes = await Vacaciones.obtenerSolicitudesEmpleado(empleado[0].ID, tipo);
      
      const solicitudesFormateadas = formatArrayDates(
        solicitudes,
        ['FechaSolicitud', 'FechaInicio', 'FechaFin', 'UltimaAprobacion'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: solicitudesFormateadas
      });
    } catch (error) {
      next(error);
    }
  },
  
  obtenerSolicitudesPendientes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const solicitudes = await Vacaciones.obtenerSolicitudesPendientes(usuarioId);
      
      const solicitudesFormateadas = formatArrayDates(
        solicitudes,
        ['FechaSolicitud', 'FechaInicio', 'FechaFin', 'FechaAprobacion'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: solicitudesFormateadas
      });
    } catch (error) {
      next(error);
    }
  },
  
  procesarAprobacion: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { aprobacionId } = req.params;
      const { estado, comentarios } = req.body;
      
      if (!['aprobada', 'rechazado'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado debe ser "aprobada" o "rechazado"'
        });
      }
      
      if (!comentarios || comentarios.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un comentario explicativo de al menos 5 caracteres'
        });
      }
      
      const resultado = await Vacaciones.procesarAprobacion(aprobacionId, usuarioId, estado, comentarios);
      
      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('No se encontró')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },
  
  editarAprobacion: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { aprobacionId } = req.params;
      const { estado, comentarios } = req.body;

      if (!['aprobada', 'rechazado'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado debe ser "aprobada" o "rechazado"'
        });
      }

      if (!comentarios || comentarios.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un comentario explicativo de al menos 10 caracteres'
        });
      }

      const resultado = await Vacaciones.editarAprobacion(aprobacionId, usuarioId, estado, comentarios);

      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('no encontrada')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      if (error.message.includes('24 horas')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  obtenerMisSolicitudesAprobadas: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { tipo } = req.query;
      
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      const solicitudes = await Vacaciones.obtenerSolicitudesAprobadasEmpleado(empleado[0].ID, tipo);
      
      const solicitudesFormateadas = formatArrayDates(
        solicitudes,
        ['FechaSolicitud', 'FechaInicio', 'FechaFin', 'UltimaAprobacion'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: solicitudesFormateadas
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerTodasSolicitudesAprobadas: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      if (!['admin', 'manager'].includes(usuarioRol)) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden ver todas las solicitudes aprobadas'
        });
      }
      
      const { empleadoId, tipo, fechaDesde, fechaHasta, page = 1, limit = 10 } = req.query;
      
      const filtros = {};
      if (empleadoId) filtros.empleadoId = empleadoId;
      if (tipo) filtros.tipo = tipo;
      if (fechaDesde) filtros.fechaDesde = fechaDesde;
      if (fechaHasta) filtros.fechaHasta = fechaHasta;
      
      const offset = (page - 1) * limit;
      filtros.limit = parseInt(limit);
      filtros.offset = offset;
      
      const [solicitudes, total] = await Promise.all([
        Vacaciones.obtenerTodasSolicitudesAprobadas(filtros),
        Vacaciones.contarSolicitudesAprobadas(filtros)
      ]);
      
      const solicitudesFormateadas = formatArrayDates(
        solicitudes,
        ['FechaSolicitud', 'FechaInicio', 'FechaFin', 'FechaUltimaAprobacion'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: {
          solicitudes: solicitudesFormateadas,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerSolicitudesPorEstado: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { estado } = req.params;
      const { tipo } = req.query;
      
      const estadosValidos = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}`
        });
      }
      
      let solicitudes = [];
      
      if (usuarioRol === 'employee') {
        const [empleado] = await req.app.locals.db.query(
          'SELECT ID FROM empleados WHERE UsuarioID = ?',
          [usuarioId]
        );
        
        if (empleado.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Empleado no encontrado'
          });
        }
        
        solicitudes = await Vacaciones.obtenerSolicitudesPorEstado(empleado[0].ID, estado, tipo);
        
      } else if (['admin', 'manager'].includes(usuarioRol)) {
        const [rows] = await req.app.locals.db.query(
          `SELECT 
            s.*,
            e.NombreCompleto as EmpleadoNombre,
            e.CorreoElectronico
           FROM solicitudes s
           JOIN empleados e ON s.EmpleadoID = e.ID
           WHERE s.Estado = ? AND s.Activo = TRUE
           ${tipo ? 'AND s.Tipo = ?' : ''}
           ORDER BY s.FechaSolicitud DESC`,
          tipo ? [estado, tipo] : [estado]
        );
        
        solicitudes = rows;
      }
      
      const solicitudesFormateadas = formatArrayDates(
        solicitudes,
        ['FechaSolicitud', 'FechaInicio', 'FechaFin'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: solicitudesFormateadas
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerDetalleSolicitud: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { solicitudId } = req.params;
      
      const [solicitud] = await req.app.locals.db.query(
        `SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico,
          e.UsuarioID as EmpleadoUsuarioID
         FROM solicitudes s
         JOIN empleados e ON s.EmpleadoID = e.ID
         WHERE s.ID = ?`,
        [solicitudId]
      );
      
      if (solicitud.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Solicitud no encontrada'
        });
      }
      
      const esDueno = solicitud[0].EmpleadoUsuarioID === usuarioId;
      const esAdminManager = ['admin', 'manager'].includes(usuarioRol);
      
      if (!esDueno && !esAdminManager) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver esta solicitud'
        });
      }
      
      const [aprobaciones] = await req.app.locals.db.query(
        `SELECT 
          aps.*,
          u.Usuario as AprobadorNombre,
          r.Nombre as RolAprobador
         FROM aprobacionessolicitud aps
         JOIN usuarios u ON aps.AprobadorID = u.ID
         LEFT JOIN roles r ON u.RolID = r.ID
         WHERE aps.SolicitudID = ?
         ORDER BY aps.OrdenAprobacion`,
        [solicitudId]
      );
      
      const [historial] = await req.app.locals.db.query(
        `SELECT 
          hs.*,
          u.Usuario as UsuarioNombre
         FROM historialsolicitud hs
         JOIN usuarios u ON hs.UsuarioID = u.ID
         WHERE hs.SolicitudID = ?
         ORDER BY hs.createdAt DESC`,
        [solicitudId]
      );
      
      const [incidencia] = await req.app.locals.db.query(
        `SELECT 
          i.*,
          ti.Nombre as TipoIncidenciaNombre
         FROM incidencias i
         JOIN tiposincidencia ti ON i.TipoIncidenciaID = ti.ID
         WHERE i.SolicitudID = ?`,
        [solicitudId]
      );
      
      const solicitudFormateada = formatDateFields(
        solicitud[0],
        ['FechaSolicitud', 'FechaInicio', 'FechaFin'],
        ['createdAt', 'updatedAt']
      );
      
      const aprobacionesFormateadas = formatArrayDates(
        aprobaciones,
        ['FechaAprobacion'],
        ['createdAt', 'updatedAt']
      );
      
      const historialFormateado = formatArrayDates(
        historial,
        [],
        ['createdAt']
      );
      
      const incidenciaFormateada = incidencia.length > 0 
        ? formatDateFields(incidencia[0], ['FechaIncidencia'], ['createdAt', 'updatedAt'])
        : null;
      
      res.status(200).json({
        success: true,
        data: {
          solicitud: solicitudFormateada,
          aprobaciones: aprobacionesFormateadas,
          historial: historialFormateado,
          incidencia: incidenciaFormateada,
          estadisticas: {
            totalAprobaciones: aprobaciones.length,
            aprobadas: aprobaciones.filter(a => a.Estado === 'aprobada').length,
            rechazadas: aprobaciones.filter(a => a.Estado === 'rechazado').length,
            pendientes: aprobaciones.filter(a => a.Estado === 'pendiente').length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = vacacionesController;
const Vacaciones = require('../models/vacacionesModel');

const vacacionesController = {
  // Obtener mis derechos vacacionales
  obtenerMisDerechos: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      // Obtener EmpleadoID
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
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
        // Calcular derechos si no existen
        const calculo = await Vacaciones.calcularDerechos(empleado[0].ID);
        return res.status(200).json({
          success: true,
          data: calculo,
          mensaje: 'Derechos calculados'
        });
      }
      
      res.status(200).json({
        success: true,
        data: derechos
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Solicitar vacaciones
  solicitarVacaciones: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { fechaInicio, fechaFin, motivo, observaciones } = req.body;
      
      // Validaciones
      if (!fechaInicio || !fechaFin || !motivo) {
        return res.status(400).json({
          success: false,
          message: 'Fecha inicio, fecha fin y motivo son requeridos'
        });
      }
      
      // Obtener EmpleadoID
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      // Calcular días solicitados
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
  
  // Obtener mis solicitudes
  obtenerMisSolicitudes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { tipo } = req.query;
      
      // Obtener EmpleadoID
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }
      
      const solicitudes = await Vacaciones.obtenerSolicitudesEmpleado(empleado[0].ID, tipo);
      
      res.status(200).json({
        success: true,
        data: solicitudes
      });
    } catch (error) {
      next(error);
    }
  },
  
  // Obtener solicitudes pendientes para aprobar - CORREGIDO
  obtenerSolicitudesPendientes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      console.log(`🔍 [obtenerSolicitudesPendientes] UsuarioID: ${usuarioId}`);
      
      const solicitudes = await Vacaciones.obtenerSolicitudesPendientes(usuarioId);
      
      console.log(`📊 Solicitudes pendientes encontradas: ${solicitudes.length}`);
      
      res.status(200).json({
        success: true,
        data: solicitudes
      });
    } catch (error) {
      console.error('❌ Error en obtenerSolicitudesPendientes:', error);
      next(error);
    }
  },
  
  // Aprobar/rechazar solicitud - CORREGIDO
  procesarAprobacion: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { aprobacionId } = req.params;
      const { estado, comentarios } = req.body;
      
      console.log(`🔍 [procesarAprobacion] UsuarioID: ${usuarioId}, AprobacionID: ${aprobacionId}, Estado: ${estado}`);
      
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
      console.error('❌ Error en procesarAprobacion:', error);
      if (error.message.includes('No se encontró')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },
  
  // Editar aprobación (cambiar de opinión) - CORREGIDO
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

  // Obtener mis solicitudes aprobadas
obtenerMisSolicitudesAprobadas: async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { tipo } = req.query;
    
    console.log(`🔍 [obtenerMisSolicitudesAprobadas] UsuarioID: ${usuarioId}, Tipo: ${tipo}`);
    
    // Obtener EmpleadoID
    const [empleado] = await req.app.locals.db.query(
      'SELECT ID FROM Empleados WHERE UsuarioID = ?',
      [usuarioId]
    );
    
    if (empleado.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    const solicitudes = await Vacaciones.obtenerSolicitudesAprobadasEmpleado(empleado[0].ID, tipo);
    
    console.log(`📊 Solicitudes aprobadas encontradas: ${solicitudes.length}`);
    
    res.status(200).json({
      success: true,
      data: solicitudes
    });
  } catch (error) {
    console.error('❌ Error en obtenerMisSolicitudesAprobadas:', error);
    next(error);
  }
},

// Obtener todas las solicitudes aprobadas (para admin/manager)
obtenerTodasSolicitudesAprobadas: async (req, res, next) => {
  try {
    const usuarioRol = req.user.rol;
    
    // Solo admin y manager pueden ver todas las solicitudes aprobadas
    if (!['admin', 'manager'].includes(usuarioRol)) {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores y managers pueden ver todas las solicitudes aprobadas'
      });
    }
    
    const { 
      empleadoId, 
      tipo, 
      fechaDesde, 
      fechaHasta,
      page = 1, 
      limit = 10 
    } = req.query;
    
    const filtros = {};
    if (empleadoId) filtros.empleadoId = empleadoId;
    if (tipo) filtros.tipo = tipo;
    if (fechaDesde) filtros.fechaDesde = fechaDesde;
    if (fechaHasta) filtros.fechaHasta = fechaHasta;
    
    // Calcular offset para paginación
    const offset = (page - 1) * limit;
    filtros.limit = parseInt(limit);
    filtros.offset = offset;
    
    // Obtener solicitudes y total
    const [solicitudes, total] = await Promise.all([
      Vacaciones.obtenerTodasSolicitudesAprobadas(filtros),
      Vacaciones.contarSolicitudesAprobadas(filtros)
    ]);
    
    console.log(`📊 Total solicitudes aprobadas: ${total}`);
    
    res.status(200).json({
      success: true,
      data: {
        solicitudes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error en obtenerTodasSolicitudesAprobadas:', error);
    next(error);
  }
},

// Obtener solicitudes por estado
obtenerSolicitudesPorEstado: async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol;
    const { estado } = req.params;
    const { tipo } = req.query;
    
    console.log(`🔍 [obtenerSolicitudesPorEstado] Estado: ${estado}, Tipo: ${tipo}`);
    
    // Validar estado
    const estadosValidos = ['pendiente', 'aprobada', 'rechazada', 'cancelada'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Debe ser: ${estadosValidos.join(', ')}`
      });
    }
    
    let solicitudes = [];
    
    if (usuarioRol === 'employee') {
      // Employee solo puede ver sus propias solicitudes
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
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
      // Admin y manager pueden ver todas las solicitudes de ese estado
      // Para simplificar, usaremos obtenerTodasSolicitudesAprobadas con filtro de estado
      const filtros = { estado: estado };
      if (tipo) filtros.tipo = tipo;
      
      // Para admin/manager, usar función diferente que obtiene todas
      const [rows] = await req.app.locals.db.query(
        `SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico
         FROM Solicitudes s
         JOIN Empleados e ON s.EmpleadoID = e.ID
         WHERE s.Estado = ? AND s.Activo = TRUE
         ${tipo ? 'AND s.Tipo = ?' : ''}
         ORDER BY s.FechaSolicitud DESC`,
        tipo ? [estado, tipo] : [estado]
      );
      
      solicitudes = rows;
    }
    
    console.log(`📊 Solicitudes en estado "${estado}" encontradas: ${solicitudes.length}`);
    
    res.status(200).json({
      success: true,
      data: solicitudes
    });
  } catch (error) {
    console.error('❌ Error en obtenerSolicitudesPorEstado:', error);
    next(error);
  }
},

// Obtener detalle completo de una solicitud (incluye aprobaciones)
obtenerDetalleSolicitud: async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol;
    const { solicitudId } = req.params;
    
    console.log(`🔍 [obtenerDetalleSolicitud] SolicitudID: ${solicitudId}`);
    
    // 1. Obtener información básica de la solicitud
    const [solicitud] = await req.app.locals.db.query(
      `SELECT 
        s.*,
        e.NombreCompleto as EmpleadoNombre,
        e.CorreoElectronico,
        e.UsuarioID as EmpleadoUsuarioID
       FROM Solicitudes s
       JOIN Empleados e ON s.EmpleadoID = e.ID
       WHERE s.ID = ?`,
      [solicitudId]
    );
    
    if (solicitud.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }
    
    // 2. Verificar permisos de acceso
    const esDueno = solicitud[0].EmpleadoUsuarioID === usuarioId;
    const esAdminManager = ['admin', 'manager'].includes(usuarioRol);
    
    if (!esDueno && !esAdminManager) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta solicitud'
      });
    }
    
    // 3. Obtener aprobaciones de esta solicitud
    const [aprobaciones] = await req.app.locals.db.query(
      `SELECT 
        aps.*,
        u.Usuario as AprobadorNombre,
        r.Nombre as RolAprobador
       FROM AprobacionesSolicitud aps
       JOIN Usuarios u ON aps.AprobadorID = u.ID
       LEFT JOIN Roles r ON u.RolID = r.ID
       WHERE aps.SolicitudID = ?
       ORDER BY aps.OrdenAprobacion`,
      [solicitudId]
    );
    
    // 4. Obtener historial de esta solicitud
    const [historial] = await req.app.locals.db.query(
      `SELECT 
        hs.*,
        u.Usuario as UsuarioNombre
       FROM HistorialSolicitud hs
       JOIN Usuarios u ON hs.UsuarioID = u.ID
       WHERE hs.SolicitudID = ?
       ORDER BY hs.createdAt DESC`,
      [solicitudId]
    );
    
    // 5. Obtener incidencia relacionada si existe
    const [incidencia] = await req.app.locals.db.query(
      `SELECT 
        i.*,
        ti.Nombre as TipoIncidenciaNombre
       FROM Incidencias i
       JOIN TiposIncidencia ti ON i.TipoIncidenciaID = ti.ID
       WHERE i.SolicitudID = ?`,
      [solicitudId]
    );
    
    res.status(200).json({
      success: true,
      data: {
        solicitud: solicitud[0],
        aprobaciones,
        historial,
        incidencia: incidencia.length > 0 ? incidencia[0] : null,
        estadisticas: {
          totalAprobaciones: aprobaciones.length,
          aprobadas: aprobaciones.filter(a => a.Estado === 'aprobada').length,
          rechazadas: aprobaciones.filter(a => a.Estado === 'rechazado').length,
          pendientes: aprobaciones.filter(a => a.Estado === 'pendiente').length
        }
      }
    });
  } catch (error) {
    console.error('❌ Error en obtenerDetalleSolicitud:', error);
    next(error);
  }
}

};

module.exports = vacacionesController;
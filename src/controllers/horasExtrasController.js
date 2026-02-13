const HorasExtras = require('../models/horasExtrasModel');

const horasExtrasController = {
  // Solicitar horas extras (solo manager/admin)
  solicitarHorasExtras: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { empleadoId, fechaInicio, horasSolicitadas, motivo, observaciones } = req.body;
      
      if (!empleadoId || !fechaInicio || !horasSolicitadas || !motivo) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos: empleadoId, fechaInicio, horasSolicitadas, motivo'
        });
      }
      
      const solicitudData = {
        empleadoId,
        motivo,
        fechaInicio,
        horasSolicitadas: parseFloat(horasSolicitadas),
        observaciones,
        creadoPor: usuarioId
      };
      
      const resultado = await HorasExtras.solicitarHorasExtras(solicitudData, usuarioRol);
      
      res.status(201).json({
        success: true,
        message: 'Solicitud de horas extras creada exitosamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('Solo administradores')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      if (error.message.includes('horas extras deben ser')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },
  
  // Obtener reporte de horas extras
  obtenerReporteHorasExtras: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      // Solo admin y manager pueden ver reportes
      if (!['admin', 'manager'].includes(usuarioRol)) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden ver reportes de horas extras'
        });
      }
      
      const { empleadoId, estado, fechaDesde, fechaHasta } = req.query;
      
      const filtros = {};
      if (empleadoId) filtros.empleadoId = empleadoId;
      if (estado) filtros.estado = estado;
      if (fechaDesde) filtros.fechaDesde = fechaDesde;
      if (fechaHasta) filtros.fechaHasta = fechaHasta;
      
      const reporte = await HorasExtras.obtenerReporteHorasExtras(filtros);
      
      // Calcular totales
      const totalHoras = reporte.reduce((sum, item) => sum + (parseFloat(item.HorasSolicitadas) || 0), 0);
      const totalAprobadas = reporte.filter(item => item.Estado === 'aprobada').length;
      const totalPendientes = reporte.filter(item => item.Estado === 'pendiente').length;
      
      res.status(200).json({
        success: true,
        data: {
          reporte,
          estadisticas: {
            totalSolicitudes: reporte.length,
            totalHoras,
            aprobadas: totalAprobadas,
            pendientes: totalPendientes,
            rechazadas: reporte.length - totalAprobadas - totalPendientes
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = horasExtrasController;
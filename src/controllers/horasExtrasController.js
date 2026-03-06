const HorasExtras = require('../models/horasExtrasModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const horasExtrasController = {
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
        fechaInicio: new Date(fechaInicio).toISOString().split('T')[0],
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
  
  obtenerReporteHorasExtras: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
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
      
      const reporteFormateado = formatArrayDates(reporte, ['FechaInicio', 'FechaSolicitud'], ['createdAt', 'updatedAt']);
      
      const totalHoras = reporteFormateado.reduce((sum, item) => sum + (parseFloat(item.HorasSolicitadas) || 0), 0);
      const totalAprobadas = reporteFormateado.filter(item => item.Estado === 'aprobada').length;
      const totalPendientes = reporteFormateado.filter(item => item.Estado === 'pendiente').length;
      
      res.status(200).json({
        success: true,
        data: {
          reporte: reporteFormateado,
          estadisticas: {
            totalSolicitudes: reporteFormateado.length,
            totalHoras,
            aprobadas: totalAprobadas,
            pendientes: totalPendientes,
            rechazadas: reporteFormateado.length - totalAprobadas - totalPendientes
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = horasExtrasController;
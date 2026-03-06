const PermisosModel = require('../models/permisosModel');
const Vacaciones = require('../models/vacacionesModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const permisosController = {
  solicitarPermiso: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { fechaInicio, motivo, conGoce = true, observaciones } = req.body;
      
      if (!fechaInicio || !motivo) {
        return res.status(400).json({
          success: false,
          message: 'Fecha y motivo son requeridos'
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
      
      const solicitudData = {
        empleadoId: empleado[0].ID,
        motivo,
        fechaInicio: new Date(fechaInicio).toISOString().split('T')[0],
        conGoce,
        observaciones,
        creadoPor: usuarioId
      };
      
      const resultado = await PermisosModel.solicitarPermiso(solicitudData);
      
      res.status(201).json({
        success: true,
        message: 'Solicitud de permiso creada exitosamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('24 horas')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },
  
  obtenerPermisosPendientes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const permisos = await PermisosModel.obtenerPermisosPendientes(usuarioId);
      
      const permisosFormateados = formatArrayDates(
        permisos,
        ['FechaInicio', 'FechaSolicitud'],
        ['createdAt', 'updatedAt']
      );
      
      res.status(200).json({
        success: true,
        data: permisosFormateados
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = permisosController;
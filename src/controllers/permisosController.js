const PermisosModel = require('../models/permisosModel');
const Vacaciones = require('../models/vacacionesModel');

const permisosController = {
  // Solicitar permiso
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
      
      const solicitudData = {
        empleadoId: empleado[0].ID,
        motivo,
        fechaInicio,
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
  
  // Obtener permisos pendientes para aprobar
  obtenerPermisosPendientes: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const permisos = await PermisosModel.obtenerPermisosPendientes(usuarioId);
      
      res.status(200).json({
        success: true,
        data: permisos
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = permisosController;
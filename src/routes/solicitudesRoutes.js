const express = require('express');
const router = express.Router();
const vacacionesController = require('../controllers/vacacionesController');
const permisosController = require('../controllers/permisosController');
const horasExtrasController = require('../controllers/horasExtrasController');
const { authenticate } = require('../middleware/auth');
const { autorizarPorRol } = require('../middleware/autorizacion');

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/vacaciones/derechos', 
  vacacionesController.obtenerMisDerechos
);

router.post('/vacaciones/solicitar', 
  vacacionesController.solicitarVacaciones
);

router.post('/permisos/solicitar', 
  permisosController.solicitarPermiso
);

router.get('/permisos/pendientes', 
  autorizarPorRol('admin', 'manager'),
  permisosController.obtenerPermisosPendientes
);

router.post('/horas-extras/solicitar', 
  autorizarPorRol('admin', 'manager'),
  horasExtrasController.solicitarHorasExtras
);

router.get('/horas-extras/reporte', 
  autorizarPorRol('admin', 'manager'),
  horasExtrasController.obtenerReporteHorasExtras
);

router.get('/aprobaciones/pendientes', 
  autorizarPorRol('admin', 'manager'),
  vacacionesController.obtenerSolicitudesPendientes
);

router.patch('/aprobaciones/:aprobacionId/procesar', 
  autorizarPorRol('admin', 'manager'),
  vacacionesController.procesarAprobacion
);

router.patch('/aprobaciones/:aprobacionId/editar', 
  autorizarPorRol('admin', 'manager'),
  vacacionesController.editarAprobacion
);

router.get('/mis-solicitudes/aprobadas', 
  vacacionesController.obtenerMisSolicitudesAprobadas
);

router.get('/aprobadas', 
  autorizarPorRol('admin', 'manager'),
  vacacionesController.obtenerTodasSolicitudesAprobadas
);

router.get('/estado/:estado', 
  vacacionesController.obtenerSolicitudesPorEstado
);

router.get('/detalle/:solicitudId', 
  vacacionesController.obtenerDetalleSolicitud
);

router.get('/mis-solicitudes', 
  vacacionesController.obtenerMisSolicitudes
);

router.patch('/:solicitudId/cancelar', 
  async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { solicitudId } = req.params;
      const { motivo } = req.body;

      // Verificar que el usuario es el dueño de la solicitud o es admin/manager
      const [solicitud] = await req.app.locals.db.query(
        `SELECT s.EmpleadoID, e.UsuarioID, s.Estado
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

      const esDueno = solicitud[0].UsuarioID === usuarioId;
      const esAdminManager = ['admin', 'manager'].includes(req.user.rol);
      
      if (!esDueno && !esAdminManager) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para cancelar esta solicitud'
        });
      }

      if (solicitud[0].Estado !== 'pendiente') {
        return res.status(400).json({
          success: false,
          message: 'Solo se pueden cancelar solicitudes pendientes'
        });
      }

      const Vacaciones = require('../models/vacacionesModel');
      const resultado = await Vacaciones.cancelarSolicitud(solicitudId, usuarioId, motivo);

      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
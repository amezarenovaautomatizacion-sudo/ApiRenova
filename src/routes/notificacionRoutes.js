const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const { authenticate } = require('../middleware/auth');
const { autorizarPorRol } = require('../middleware/autorizacion');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener notificaciones personales
router.get('/personales', 
  notificacionController.obtenerMisNotificaciones
);

// Obtener resumen de notificaciones
router.get('/resumen', 
  notificacionController.obtenerResumenNotificaciones
);

// Marcar notificación como vista
router.patch('/personales/:notificacionId/vista', 
  notificacionController.marcarComoVista
);

// Marcar notificación como leída
router.patch('/personales/:notificacionId/leida', 
  notificacionController.marcarComoLeida
);

// Eliminar notificación
router.delete('/personales/:notificacionId', 
  notificacionController.eliminarNotificacion
);

// Marcar todas como vistas
router.patch('/personales/marcar-todas-vistas', 
  notificacionController.marcarTodasComoVistas
);

// Obtener notificaciones generales
router.get('/generales', 
  notificacionController.obtenerNotificacionesGenerales
);

// Marcar notificación general como vista
router.patch('/generales/:notificacionId/vista', 
  notificacionController.marcarGeneralComoVista
);

// Crear notificación general (solo admin)
router.post('/generales', 
  autorizarPorRol('admin'),
  notificacionController.crearNotificacionGeneral
);

// Obtener tipos de notificación
router.get('/tipos', 
  notificacionController.obtenerTiposNotificacion
);

// Obtener configuraciones (solo admin)
router.get('/configuraciones', 
  autorizarPorRol('admin'),
  notificacionController.obtenerConfiguraciones
);

// Actualizar configuración (solo admin)
router.put('/configuraciones/:id', 
  autorizarPorRol('admin'),
  notificacionController.actualizarConfiguracion
);

module.exports = router;
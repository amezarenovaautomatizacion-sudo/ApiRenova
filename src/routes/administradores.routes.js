const express = require('express');
const router = express.Router();
const administradoresController = require('../controllers/administradores.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Solo administradores pueden gestionar administradores
router.use(checkRole(['admin']));

// CRUD de administradores aprobadores
router.get('/', administradoresController.getAdministradores);
router.post('/asignar', administradoresController.asignarAdministrador);

// Notificaciones
router.get('/notificaciones/pendientes', administradoresController.getNotificacionesPendientes);
router.put('/notificaciones/vista/:id_notificacion', administradoresController.marcarNotificacionVista);

module.exports = router;
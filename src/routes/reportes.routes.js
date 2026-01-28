const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verifyToken, checkPermission } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Todos los reportes requieren permiso de lectura en reportes
router.use(checkPermission('reportes', 'leer'));

// Reportes disponibles
router.get('/empleados', reportesController.reporteEmpleados);
router.get('/asistencias', reportesController.reporteAsistencias);
router.get('/vacaciones', reportesController.reporteVacaciones);
router.get('/nomina', reportesController.reporteNomina);

module.exports = router;
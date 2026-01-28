const express = require('express');
const router = express.Router();
const asistenciasController = require('../controllers/asistencias.controller');
const { verifyToken, checkPermission } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para empleados
router.post('/registrar', asistenciasController.registrarAsistencia);
router.get('/mis-asistencias', asistenciasController.getAsistenciasEmpleado);

// Rutas para administradores/supervisores
router.get(
  '/',
  checkPermission('asistencias', 'leer'),
  asistenciasController.getAllAsistencias
);

router.post(
  '/manual',
  checkPermission('asistencias', 'crear'),
  asistenciasController.registrarAsistenciaManual
);

module.exports = router;
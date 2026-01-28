const express = require('express');
const router = express.Router();
const vacacionesController = require('../controllers/vacaciones.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas públicas para todos los usuarios
router.get(
  '/mis-vacaciones',
  vacacionesController.getVacacionesByEmpleado
);

router.post(
  '/',
  vacacionesController.createVacacion
);

router.put(
  '/cancelar/:id',
  vacacionesController.cancelarVacacion
);

// Rutas para administradores/supervisores
router.get(
  '/',
  checkPermission('vacaciones', 'leer'),
  vacacionesController.getAllVacaciones
);

router.get(
  '/estadisticas',
  checkPermission('vacaciones', 'leer'),
  vacacionesController.getEstadisticasVacaciones
);

router.get(
  '/empleado/:id_empleado',
  checkPermission('vacaciones', 'leer'),
  vacacionesController.getVacacionesByEmpleado
);

router.put(
  '/aprobar/:id',
  checkPermission('vacaciones', 'editar'),
  vacacionesController.aprobarVacacion
);

module.exports = router;
const express = require('express');
const router = express.Router();
const empleadosController = require('../controllers/empleados.controller');
const { verifyToken, checkPermission } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para empleados
router.get(
  '/',
  checkPermission('empleados', 'leer'),
  empleadosController.getAllEmpleados
);

router.get(
  '/estadisticas',
  checkPermission('empleados', 'leer'),
  empleadosController.getEstadisticas
);

router.get(
  '/:id',
  checkPermission('empleados', 'leer'),
  empleadosController.getEmpleadoById
);

router.post(
  '/',
  checkPermission('empleados', 'crear'),
  empleadosController.createEmpleado
);

router.put(
  '/:id',
  checkPermission('empleados', 'editar'),
  empleadosController.updateEmpleado
);

router.delete(
  '/:id',
  checkPermission('empleados', 'eliminar'),
  empleadosController.deleteEmpleado
);

module.exports = router;
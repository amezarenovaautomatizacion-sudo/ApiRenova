const express = require('express');
const router = express.Router();
const horasExtrasController = require('../controllers/horas_extras.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para empleados
router.get('/mis-horas-extras', horasExtrasController.getHorasExtrasEmpleado);

// Rutas para gerentes (solicitar)
router.post(
  '/solicitar',
  checkRole(['gerente', 'admin']),
  horasExtrasController.solicitarHorasExtras
);

// Rutas para administradores (aprobar)
router.put(
  '/aprobar/:id',
  checkRole(['admin']),
  horasExtrasController.aprobarHorasExtras
);

// Rutas para admin (ver todas)
router.get(
  '/',
  checkRole(['admin']),
  horasExtrasController.getAllHorasExtras
);

module.exports = router;
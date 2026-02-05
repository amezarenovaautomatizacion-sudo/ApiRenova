const express = require('express');
const router = express.Router();
const permisosController = require('../controllers/permisos.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para empleados
router.get('/mis-permisos', permisosController.getPermisosEmpleado);
router.post('/solicitar', permisosController.solicitarPermiso);

// Rutas para administradores (aprobar)
router.put(
  '/aprobar/:id',
  checkRole(['admin']),
  permisosController.aprobarPermiso
);

// Rutas para admin (ver todas)
router.get(
  '/',
  checkRole(['admin']),
  permisosController.getAllPermisos
);

module.exports = router;
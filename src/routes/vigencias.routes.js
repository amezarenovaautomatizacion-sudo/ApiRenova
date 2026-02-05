const express = require('express');
const router = express.Router();
const vigenciasController = require('../controllers/vigencias.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener información de vigencias del empleado
router.get('/mis-vigencias', vigenciasController.calcularVigenciasEmpleado);

module.exports = router;
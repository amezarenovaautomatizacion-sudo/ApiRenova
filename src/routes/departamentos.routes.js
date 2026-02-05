const express = require('express');
const router = express.Router();
const departamentosController = require('../controllers/departamentos.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Solo administradores pueden gestionar departamentos
router.use(checkRole(['admin']));

// CRUD de departamentos
router.get('/', departamentosController.getAllDepartamentos);
router.post('/', departamentosController.createDepartamento);
router.put('/:id', departamentosController.updateDepartamento);
router.delete('/:id', departamentosController.deleteDepartamento);
router.post('/asignar-jefe', departamentosController.asignarJefeDepartamento);

module.exports = router;
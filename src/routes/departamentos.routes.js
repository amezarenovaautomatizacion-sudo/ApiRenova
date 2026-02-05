const express = require('express');
const router = express.Router();
const departamentosController = require('../controllers/departamentos.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Obtener todos los departamentos
router.get('/', authMiddleware.verifyToken, departamentosController.getAllDepartamentos);

// Obtener departamento por ID
router.get('/:id', authMiddleware.verifyToken, departamentosController.getDepartamentoById);

// Crear departamento (solo admin)
router.post('/', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  departamentosController.createDepartamento
);

// Actualizar departamento (solo admin)
router.put('/:id', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  departamentosController.updateDepartamento
);

// Eliminar departamento (solo admin)
router.delete('/:id', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  departamentosController.deleteDepartamento
);

// Asignar jefe de departamento (solo admin)
router.post('/asignar-jefe', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  departamentosController.asignarJefeDepartamento
);

// Obtener empleados por departamento
router.get('/:id/empleados', 
  authMiddleware.verifyToken,
  departamentosController.getEmpleadosByDepartamento
);

module.exports = router;
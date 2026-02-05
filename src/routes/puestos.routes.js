const express = require('express');
const router = express.Router();
const puestosController = require('../controllers/puestos.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Obtener todos los puestos
router.get('/', authMiddleware.verifyToken, puestosController.getAllPuestos);

// Obtener puesto por ID
router.get('/:id', authMiddleware.verifyToken, puestosController.getPuestoById);

// Crear nuevo puesto (solo admin)
router.post('/', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  puestosController.createPuesto
);

// Actualizar puesto (solo admin)
router.put('/:id', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  puestosController.updatePuesto
);

// Eliminar puesto (solo admin)
router.delete('/:id', 
  authMiddleware.verifyToken,
  authMiddleware.checkRole(['admin']),
  puestosController.deletePuesto
);

// Obtener empleados por puesto
router.get('/:id/empleados', 
  authMiddleware.verifyToken,
  puestosController.getEmpleadosByPuesto
);

module.exports = router;
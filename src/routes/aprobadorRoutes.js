const express = require('express');
const router = express.Router();
const aprobadorController = require('../controllers/aprobadorController');
const { authenticate } = require('../middleware/auth');
const { autorizarPorRol } = require('../middleware/autorizacion');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Agregar aprobador (solo admin)
router.post('/agregar', 
  autorizarPorRol('admin'),
  aprobadorController.agregarAprobador
);

// Quitar aprobador (solo admin)
router.delete('/quitar/:usuarioId', 
  autorizarPorRol('admin'),
  aprobadorController.quitarAprobador
);

// Obtener aprobadores activos (todos los autenticados pueden ver)
router.get('/activos', 
  aprobadorController.obtenerAprobadoresActivos
);

// Verificar si un usuario es aprobador
router.get('/verificar/:usuarioId', 
  aprobadorController.verificarAprobador
);

module.exports = router;
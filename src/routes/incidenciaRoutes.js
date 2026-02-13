const express = require('express');
const router = express.Router();
const tipoIncidenciaController = require('../controllers/tipoIncidenciaController');
const incidenciaController = require('../controllers/incidenciaController');
const { authenticate } = require('../middleware/auth');
const { autorizarPorRol } = require('../middleware/autorizacion');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener tipos activos (todos pueden ver)
router.get('/tipos', 
  tipoIncidenciaController.obtenerTiposActivos
);

// Obtener todos los tipos (solo admin)
router.get('/tipos/todos', 
  autorizarPorRol('admin'),
  tipoIncidenciaController.obtenerTodosTipos
);

// Obtener tipo por ID
router.get('/tipos/:id', 
  tipoIncidenciaController.obtenerTipo
);

// Crear tipo (solo admin)
router.post('/tipos', 
  autorizarPorRol('admin'),
  tipoIncidenciaController.crearTipo
);

// Actualizar tipo (solo admin)
router.put('/tipos/:id', 
  autorizarPorRol('admin'),
  tipoIncidenciaController.actualizarTipo
);

// Activar/desactivar tipo (solo admin)
router.patch('/tipos/:id/estado', 
  autorizarPorRol('admin'),
  tipoIncidenciaController.toggleActivo
);

// Crear incidencia (admin y manager)
router.post('/', 
  autorizarPorRol('admin', 'manager'),
  incidenciaController.crearIncidencia
);

// RUTAS ESPECÍFICAS (deben ir ANTES de /:id)
router.get('/mis-incidencias', 
  incidenciaController.obtenerMisIncidencias
);

router.get('/empleados/supervisados', 
  autorizarPorRol('admin', 'manager'),
  incidenciaController.obtenerEmpleadosSupervisados
);

// Obtener incidencias (con filtros según rol)
router.get('/', 
  incidenciaController.obtenerIncidencias
);

// RUTAS CON PARÁMETROS (deben ir DESPUÉS de las rutas específicas)
router.get('/:id', 
  incidenciaController.obtenerIncidencia
);

router.put('/:id', 
  autorizarPorRol('admin'),
  incidenciaController.actualizarIncidencia
);

router.patch('/:id/estado', 
  autorizarPorRol('admin'),
  incidenciaController.toggleActivoIncidencia
);

module.exports = router;
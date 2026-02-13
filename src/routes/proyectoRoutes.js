// routes/proyectoRoutes.js
const express = require('express');
const router = express.Router();
const proyectoController = require('../controllers/proyectoController');
const tareaController = require('../controllers/tareaController');
const notaTareaController = require('../controllers/notaTareaController');
const { authenticate } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacion');

// ============================================
// MIDDLEWARE GLOBAL - Todas las rutas requieren autenticación
// ============================================
router.use(authenticate);

// ============================================
// PROYECTOS - CRUD y operaciones principales
// ============================================

/**
 * @route   POST /api/proyectos
 * @desc    Crear nuevo proyecto
 * @access  Admin, Manager
 */
router.post('/',
  autorizar('/api/proyectos', 'POST'),
  proyectoController.crearProyecto
);

/**
 * @route   GET /api/proyectos
 * @desc    Listar proyectos con filtros
 * @access  Admin, Manager, Employee
 */
router.get('/',
  autorizar('/api/proyectos', 'GET'),
  proyectoController.listarProyectos
);

/**
 * @route   GET /api/proyectos/mis-proyectos
 * @desc    Obtener proyectos donde soy jefe
 * @access  Admin, Manager
 */
router.get('/mis-proyectos',
  autorizar('/api/proyectos/mis-proyectos', 'GET'),
  proyectoController.obtenerMisProyectos
);

/**
 * @route   GET /api/proyectos/asignados
 * @desc    Obtener proyectos donde soy miembro
 * @access  Employee
 */
router.get('/asignados',
  autorizar('/api/proyectos/asignados', 'GET'),
  proyectoController.obtenerProyectosAsignados
);

/**
 * @route   GET /api/proyectos/:id
 * @desc    Obtener proyecto por ID
 * @access  Admin, Manager, Employee (con acceso)
 */
router.get('/:id',
  autorizar('/api/proyectos/:id', 'GET'),
  proyectoController.obtenerProyecto
);

/**
 * @route   PUT /api/proyectos/:id
 * @desc    Actualizar proyecto
 * @access  Admin, Jefe de Proyecto
 */
router.put('/:id',
  autorizar('/api/proyectos/:id', 'PUT'),
  proyectoController.actualizarProyecto
);

/**
 * @route   PATCH /api/proyectos/:id/estado
 * @desc    Cambiar estado del proyecto
 * @access  Admin, Jefe de Proyecto
 */
router.patch('/:id/estado',
  autorizar('/api/proyectos/:id/estado', 'PATCH'),
  proyectoController.cambiarEstadoProyecto
);

/**
 * @route   DELETE /api/proyectos/:id
 * @desc    Eliminar proyecto (lógica)
 * @access  Admin, Jefe de Proyecto
 */
router.delete('/:id',
  autorizar('/api/proyectos/:id', 'DELETE'),
  proyectoController.eliminarProyecto
);

// ============================================
// GESTIÓN DE EMPLEADOS EN PROYECTOS
// ============================================

/**
 * @route   GET /api/proyectos/:id/empleados
 * @desc    Listar empleados del proyecto
 * @access  Admin, Manager, Employee (con acceso)
 */
router.get('/:id/empleados',
  autorizar('/api/proyectos/:id/empleados', 'GET'),
  proyectoController.obtenerEmpleadosProyectoConEstado
);

/**
 * @route   GET /api/proyectos/:id/empleados/disponibles
 * @desc    Obtener empleados disponibles para asignar (modo: supervisados/todos)
 * @access  Admin, Jefe de Proyecto
 */
router.get('/:id/empleados/disponibles',
  autorizar('/api/proyectos/:id/empleados/disponibles', 'GET'),
  proyectoController.obtenerEmpleadosDisponibles
);

/**
 * @route   GET /api/proyectos/:id/empleados/buscar
 * @desc    Buscar empleados generales de la empresa
 * @access  Admin, Jefe de Proyecto
 */
router.get('/:id/empleados/buscar',
  autorizar('/api/proyectos/:id/empleados/buscar', 'GET'),
  proyectoController.buscarEmpleadosGenerales
);

/**
 * @route   POST /api/proyectos/:id/empleados
 * @desc    Asignar empleado a proyecto
 * @access  Admin, Jefe de Proyecto
 */
router.post('/:id/empleados',
  autorizar('/api/proyectos/:id/empleados', 'POST'),
  proyectoController.asignarEmpleado
);

/**
 * @route   DELETE /api/proyectos/:id/empleados/:empleadoId
 * @desc    Quitar empleado de proyecto
 * @access  Admin, Jefe de Proyecto
 */
router.delete('/:id/empleados/:empleadoId',
  autorizar('/api/proyectos/:id/empleados/:empleadoId', 'DELETE'),
  proyectoController.quitarEmpleado
);

// ============================================
// HISTORIAL DEL PROYECTO
// ============================================

/**
 * @route   GET /api/proyectos/:id/historial
 * @desc    Obtener historial del proyecto
 * @access  Admin, Jefe de Proyecto, Miembros
 */
router.get('/:id/historial',
  autorizar('/api/proyectos/:id/historial', 'GET'),
  proyectoController.obtenerHistorial
);

// ============================================
// TAREAS DEL PROYECTO
// ============================================

/**
 * @route   GET /api/proyectos/:id/tareas
 * @desc    Listar tareas del proyecto con filtros
 * @access  Admin, Manager, Employee (con acceso)
 */
router.get('/:id/tareas',
  autorizar('/api/proyectos/:id/tareas', 'GET'),
  tareaController.listarTareas
);

/**
 * @route   POST /api/proyectos/:id/tareas
 * @desc    Crear tarea en proyecto (asignación OBLIGATORIA)
 * @access  Admin, Jefe de Proyecto
 */
router.post('/:id/tareas',
  autorizar('/api/proyectos/:id/tareas', 'POST'),
  tareaController.crearTarea
);

/**
 * @route   GET /api/proyectos/:id/tareas/:tareaId
 * @desc    Obtener tarea específica
 * @access  Admin, Manager, Employee (con acceso)
 */
router.get('/:id/tareas/:tareaId',
  autorizar('/api/proyectos/:id/tareas/:tareaId', 'GET'),
  tareaController.obtenerTarea
);

/**
 * @route   PUT /api/proyectos/:id/tareas/:tareaId
 * @desc    Actualizar tarea (título, descripción, fechaVencimiento, prioridad)
 * @access  Admin, Jefe de Proyecto, Asignado, Tarea sin asignar
 */
router.put('/:id/tareas/:tareaId',
  autorizar('/api/proyectos/:id/tareas/:tareaId', 'PUT'),
  tareaController.actualizarTarea
);

/**
 * @route   PATCH /api/proyectos/:id/tareas/:tareaId/estado
 * @desc    Cambiar estado de tarea (pendiente, en_proceso, realizada)
 * @access  Admin, Jefe de Proyecto, Asignado, Tarea sin asignar
 */
router.patch('/:id/tareas/:tareaId/estado',
  autorizar('/api/proyectos/:id/tareas/:tareaId/estado', 'PATCH'),
  tareaController.cambiarEstadoTarea
);

/**
 * @route   DELETE /api/proyectos/:id/tareas/:tareaId
 * @desc    Eliminar tarea (lógica)
 * @access  Admin, Jefe de Proyecto
 */
router.delete('/:id/tareas/:tareaId',
  autorizar('/api/proyectos/:id/tareas/:tareaId', 'DELETE'),
  tareaController.eliminarTarea
);

// ============================================
// ASIGNACIÓN DE TAREAS
// ============================================

/**
 * @route   POST /api/proyectos/:id/tareas/:tareaId/asignar
 * @desc    Asignar empleado a tarea
 * @access  Admin, Jefe de Proyecto
 */
router.post('/:id/tareas/:tareaId/asignar',
  autorizar('/api/proyectos/:id/tareas/:tareaId/asignar', 'POST'),
  tareaController.asignarEmpleadoTarea
);

/**
 * @route   PATCH /api/proyectos/:id/tareas/:tareaId/reasignar
 * @desc    Reasignar tarea (cambiar o quitar asignación)
 * @access  Admin, Jefe de Proyecto
 */
router.patch('/:id/tareas/:tareaId/reasignar',
  autorizar('/api/proyectos/:id/tareas/:tareaId/reasignar', 'PATCH'),
  tareaController.reasignarTarea
);

/**
 * @route   DELETE /api/proyectos/:id/tareas/:tareaId/desasignar
 * @desc    Desasignar tarea (dejar sin asignar)
 * @access  Admin, Jefe de Proyecto
 */
router.delete('/:id/tareas/:tareaId/desasignar',
  autorizar('/api/proyectos/:id/tareas/:tareaId/desasignar', 'DELETE'),
  tareaController.desasignarTarea
);

/**
 * @route   DELETE /api/proyectos/:id/tareas/:tareaId/asignaciones/:asignacionId
 * @desc    Quitar asignación específica de tarea
 * @access  Admin, Jefe de Proyecto
 */
router.delete('/:id/tareas/:tareaId/asignaciones/:asignacionId',
  autorizar('/api/proyectos/:id/tareas/:tareaId/asignaciones/:asignacionId', 'DELETE'),
  tareaController.quitarAsignacionTarea
);

// ============================================
// NOTAS EN TAREAS
// ============================================

/**
 * @route   GET /api/proyectos/:id/tareas/:tareaId/notas
 * @desc    Listar notas de una tarea
 * @access  Admin, Manager, Employee (con acceso)
 */
router.get('/:id/tareas/:tareaId/notas',
  autorizar('/api/proyectos/:id/tareas/:tareaId/notas', 'GET'),
  notaTareaController.listarNotas
);

/**
 * @route   POST /api/proyectos/:id/tareas/:tareaId/notas
 * @desc    Crear nota en tarea
 * @access  Admin, Manager, Employee (con acceso)
 */
router.post('/:id/tareas/:tareaId/notas',
  autorizar('/api/proyectos/:id/tareas/:tareaId/notas', 'POST'),
  notaTareaController.crearNota
);

/**
 * @route   PUT /api/proyectos/:id/tareas/:tareaId/notas/:notaId
 * @desc    Actualizar nota
 * @access  Solo el creador de la nota
 */
router.put('/:id/tareas/:tareaId/notas/:notaId',
  autorizar('/api/proyectos/:id/tareas/:tareaId/notas/:notaId', 'PUT'),
  notaTareaController.actualizarNota
);

/**
 * @route   DELETE /api/proyectos/:id/tareas/:tareaId/notas/:notaId
 * @desc    Eliminar nota
 * @access  Solo el creador de la nota
 */
router.delete('/:id/tareas/:tareaId/notas/:notaId',
  autorizar('/api/proyectos/:id/tareas/:tareaId/notas/:notaId', 'DELETE'),
  notaTareaController.eliminarNota
);

module.exports = router;
const express = require('express');
const router = express.Router();
const proyectoController = require('../controllers/proyectoController');
const tareaController = require('../controllers/tareaController');
const notaTareaController = require('../controllers/notaTareaController');
const { authenticate } = require('../middleware/auth');
const { autorizar } = require('../middleware/autorizacion');

// Todas las rutas requieren autenticación
router.use(authenticate);

// ==================== RUTAS DE PROYECTOS ====================

// Crear nuevo proyecto
router.post('/', autorizar('/api/proyectos', 'POST'), proyectoController.crearProyecto);

// Listar proyectos con filtros
router.get('/', autorizar('/api/proyectos', 'GET'), proyectoController.listarProyectos);

// Obtener proyectos donde el usuario es jefe
router.get('/mis-proyectos', autorizar('/api/proyectos/mis-proyectos', 'GET'), proyectoController.obtenerMisProyectos);

// Obtener proyectos asignados al usuario (como miembro)
router.get('/asignados', autorizar('/api/proyectos/asignados', 'GET'), proyectoController.obtenerProyectosAsignados);

// Obtener proyecto por ID
router.get('/:id', autorizar('/api/proyectos/:id', 'GET'), proyectoController.obtenerProyecto);

// Actualizar proyecto
router.put('/:id', autorizar('/api/proyectos/:id', 'PUT'), proyectoController.actualizarProyecto);

// Cambiar estado del proyecto
router.patch('/:id/estado', autorizar('/api/proyectos/:id/estado', 'PATCH'), proyectoController.cambiarEstadoProyecto);

// Eliminar proyecto
router.delete('/:id', autorizar('/api/proyectos/:id', 'DELETE'), proyectoController.eliminarProyecto);

// ==================== RUTAS DE EMPLEADOS DEL PROYECTO ====================

// Obtener empleados asignados al proyecto
router.get('/:id/empleados', autorizar('/api/proyectos/:id/empleados', 'GET'), proyectoController.obtenerEmpleadosProyectoConEstado);

// Obtener empleados disponibles para asignar (con filtros)
router.get('/:id/empleados/disponibles', autorizar('/api/proyectos/:id/empleados/disponibles', 'GET'), proyectoController.obtenerEmpleadosDisponibles);

// Buscar empleados generales para asignar
router.get('/:id/empleados/buscar', autorizar('/api/proyectos/:id/empleados/buscar', 'GET'), proyectoController.buscarEmpleadosGenerales);

// Asignar empleado al proyecto
router.post('/:id/empleados', autorizar('/api/proyectos/:id/empleados', 'POST'), proyectoController.asignarEmpleado);

// Quitar empleado del proyecto
router.delete('/:id/empleados/:empleadoId', autorizar('/api/proyectos/:id/empleados/:empleadoId', 'DELETE'), proyectoController.quitarEmpleado);

// ==================== RUTAS DE HISTORIAL ====================

// Obtener historial del proyecto
router.get('/:id/historial', autorizar('/api/proyectos/:id/historial', 'GET'), proyectoController.obtenerHistorial);

// ==================== RUTAS DE TAREAS ====================

// Listar tareas del proyecto
router.get('/:id/tareas', autorizar('/api/proyectos/:id/tareas', 'GET'), tareaController.listarTareas);

// Crear nueva tarea en el proyecto
router.post('/:id/tareas', autorizar('/api/proyectos/:id/tareas', 'POST'), tareaController.crearTarea);

// Obtener tarea específica
router.get('/:id/tareas/:tareaId', autorizar('/api/proyectos/:id/tareas/:tareaId', 'GET'), tareaController.obtenerTarea);

// Actualizar tarea
router.put('/:id/tareas/:tareaId', autorizar('/api/proyectos/:id/tareas/:tareaId', 'PUT'), tareaController.actualizarTarea);

// Cambiar estado de la tarea
router.patch('/:id/tareas/:tareaId/estado', autorizar('/api/proyectos/:id/tareas/:tareaId/estado', 'PATCH'), tareaController.cambiarEstadoTarea);

// Eliminar tarea
router.delete('/:id/tareas/:tareaId', autorizar('/api/proyectos/:id/tareas/:tareaId', 'DELETE'), tareaController.eliminarTarea);

// ==================== RUTAS DE ASIGNACIÓN DE TAREAS ====================

// Asignar empleado a tarea
router.post('/:id/tareas/:tareaId/asignar', autorizar('/api/proyectos/:id/tareas/:tareaId/asignar', 'POST'), tareaController.asignarEmpleadoTarea);

// Reasignar tarea (cambiar o quitar asignación)
router.patch('/:id/tareas/:tareaId/reasignar', autorizar('/api/proyectos/:id/tareas/:tareaId/reasignar', 'PATCH'), tareaController.reasignarTarea);

// Desasignar tarea (dejar sin asignar)
router.delete('/:id/tareas/:tareaId/desasignar', autorizar('/api/proyectos/:id/tareas/:tareaId/desasignar', 'DELETE'), tareaController.desasignarTarea);

// Quitar asignación específica por ID
router.delete('/:id/tareas/:tareaId/asignaciones/:asignacionId', autorizar('/api/proyectos/:id/tareas/:tareaId/asignaciones/:asignacionId', 'DELETE'), tareaController.quitarAsignacionTarea);

// ==================== RUTAS DE NOTAS DE TAREAS ====================

// Listar notas de una tarea
router.get('/:id/tareas/:tareaId/notas', autorizar('/api/proyectos/:id/tareas/:tareaId/notas', 'GET'), notaTareaController.listarNotas);

// Crear nota en una tarea
router.post('/:id/tareas/:tareaId/notas', autorizar('/api/proyectos/:id/tareas/:tareaId/notas', 'POST'), notaTareaController.crearNota);

// Actualizar nota
router.put('/:id/tareas/:tareaId/notas/:notaId', autorizar('/api/proyectos/:id/tareas/:tareaId/notas/:notaId', 'PUT'), notaTareaController.actualizarNota);

// Eliminar nota
router.delete('/:id/tareas/:tareaId/notas/:notaId', autorizar('/api/proyectos/:id/tareas/:tareaId/notas/:notaId', 'DELETE'), notaTareaController.eliminarNota);

module.exports = router;
const Tarea = require('../models/tareaModel');
const Proyecto = require('../models/proyectoModel');
const empleadoHelper = require('../utils/empleadoHelper');
const { formatDateFields, formatArrayDates } = require('../utils/dateFormatter');

const tareaController = {
  // Crear nueva tarea
  crearTarea: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        titulo,
        descripcion,
        fechaVencimiento,
        prioridad,
        estado,
        empleadoId
      } = req.body;

      if (!titulo) {
        return res.status(400).json({
          success: false,
          message: 'El título es requerido'
        });
      }

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const esAdmin = usuarioRol === 'admin';
      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden crear tareas'
        });
      }

      const tareaData = {
        proyectoId,
        titulo,
        descripcion: descripcion || null,
        fechaVencimiento: fechaVencimiento || null,
        prioridad: prioridad || 'media',
        estado: estado || 'pendiente',
        empleadoId: empleadoId || null,
        creadoPor: usuarioId
      };

      const nuevaTarea = await Tarea.crear(tareaData);
      const tareaFormateada = formatDateFields(nuevaTarea, ['FechaVencimiento', 'FechaCreacion'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Tarea creada exitosamente',
        data: tareaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  // Listar tareas del proyecto (alias de obtenerTareas para mantener compatibilidad)
  listarTareas: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        estado,
        prioridad,
        asignadoA,
        page = 1,
        limit = 20,
        soloSinAsignar,
        search
      } = req.query;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const filtros = {
        estado,
        prioridad,
        asignadoA,
        page: parseInt(page),
        limit: parseInt(limit),
        soloSinAsignar: soloSinAsignar === 'true',
        search
      };

      const resultado = await Tarea.listarPorProyecto(proyectoId, filtros);
      
      const tareasFormateadas = formatArrayDates(
        resultado.tareas,
        ['FechaVencimiento', 'FechaCreacion'],
        ['createdAt', 'updatedAt']
      );

      res.status(200).json({
        success: true,
        data: {
          tareas: tareasFormateadas,
          pagination: resultado.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener tarea por ID
  obtenerTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);

      if (!tarea) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      const tareaFormateada = formatDateFields(tarea, ['FechaVencimiento', 'FechaCreacion'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: tareaFormateada
      });
    } catch (error) {
      if (error.message.includes('No tienes acceso')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  // Actualizar tarea
  actualizarTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { titulo, descripcion, fechaVencimiento, prioridad } = req.body;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      if (!tarea) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;
      const esAsignado = tarea.EmpleadoAsignadoID === miEmpleadoId;
      const tareaSinAsignar = !tarea.EmpleadoAsignadoID;

      if (!esAdmin && !esJefeProyecto && !esAsignado && !tareaSinAsignar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para editar esta tarea'
        });
      }

      const tareaData = {
        titulo,
        descripcion,
        fechaVencimiento,
        prioridad
      };

      const tareaActualizada = await Tarea.actualizar(tareaId, tareaData, usuarioId);
      const tareaFormateada = formatDateFields(tareaActualizada, ['FechaVencimiento', 'FechaCreacion'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Tarea actualizada exitosamente',
        data: tareaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  // Cambiar estado de la tarea
  cambiarEstadoTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { estado } = req.body;

      if (!estado || !['pendiente', 'en_proceso', 'realizada'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser: pendiente, en_proceso o realizada'
        });
      }

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      if (!tarea) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;
      const esAsignado = tarea.EmpleadoAsignadoID === miEmpleadoId;
      const tareaSinAsignar = !tarea.EmpleadoAsignadoID;

      if (!esAdmin && !esJefeProyecto && !esAsignado && !tareaSinAsignar) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para cambiar el estado de esta tarea'
        });
      }

      // Actualizar estado directamente en la base de datos
      await req.app.locals.db.query(
        'UPDATE tareas SET Estado = ?, updatedAt = NOW() WHERE ID = ?',
        [estado, tareaId]
      );

      const tareaActualizada = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      const tareaFormateada = formatDateFields(tareaActualizada, ['FechaVencimiento', 'FechaCreacion'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: `Estado de tarea cambiado a: ${estado}`,
        data: tareaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  // Asignar empleado a tarea
  asignarEmpleadoTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { empleadoId } = req.body;

      if (!empleadoId) {
        return res.status(400).json({
          success: false,
          message: 'empleadoId es requerido'
        });
      }

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden asignar empleados a tareas'
        });
      }

      // Verificar que el empleado pertenezca al proyecto
      const [empleado] = await req.app.locals.db.query(
        'SELECT 1 FROM proyecto_empleados WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1',
        [proyectoId, empleadoId]
      );

      if (empleado.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El empleado debe pertenecer al proyecto para ser asignado'
        });
      }

      const resultado = await Tarea.reasignarTarea(tareaId, empleadoId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Empleado asignado a la tarea exitosamente',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  // Reasignar tarea (cambiar o quitar asignación)
  reasignarTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { empleadoId } = req.body;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      if (!tarea) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden reasignar tareas'
        });
      }

      if (empleadoId) {
        const [empleado] = await req.app.locals.db.query(
          'SELECT 1 FROM proyecto_empleados WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1',
          [proyectoId, empleadoId]
        );

        if (empleado.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'El empleado debe pertenecer al proyecto para ser asignado'
          });
        }
      }

      const resultado = await Tarea.reasignarTarea(tareaId, empleadoId || null, usuarioId);

      res.status(200).json({
        success: true,
        message: resultado.empleadoId ? 'Tarea reasignada exitosamente' : 'Tarea desasignada (sin asignar)',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  // Desasignar tarea (dejar sin asignar)
  desasignarTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);
      if (!tarea) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden desasignar tareas'
        });
      }

      const resultado = await Tarea.reasignarTarea(tareaId, null, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Tarea desasignada exitosamente',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  // Quitar asignación específica por ID
  quitarAsignacionTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId, asignacionId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden quitar asignaciones'
        });
      }

      const resultado = await Tarea.quitarAsignacion(asignacionId, usuarioId, tareaId);

      res.status(200).json({
        success: true,
        message: 'Asignación removida exitosamente',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  // Eliminar tarea
  eliminarTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(proyectoId, usuarioId, usuarioRol);
      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esAdmin = usuarioRol === 'admin';
      const esJefeProyecto = proyecto.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden eliminar tareas'
        });
      }

      const resultado = await Tarea.eliminar(tareaId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Tarea eliminada exitosamente',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = tareaController;
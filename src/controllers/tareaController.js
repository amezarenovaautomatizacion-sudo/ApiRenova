// controllers/tareaController.js
const Tarea = require('../models/tareaModel');
const Proyecto = require('../models/proyectoModel');
const empleadoHelper = require('../utils/empleadoHelper');

const tareaController = {
  // Crear tarea en proyecto (con asignación OPCIONAL)
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
      empleadoId // OPCIONAL: puede venir o no
    } = req.body;

    if (!titulo) {
      return res.status(400).json({
        success: false,
        message: 'Título es requerido'
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

    // ✅ VALIDAR PRIORIDAD - SOLO VALORES PERMITIDOS
    let prioridadValida = 'media';
    if (prioridad && ['baja', 'media', 'alta', 'urgente'].includes(prioridad)) {
      prioridadValida = prioridad;
    }

    const tareaData = {
      proyectoId,
      titulo,
      descripcion: descripcion || null,
      fechaVencimiento: fechaVencimiento || null,
      prioridad: prioridadValida, // ✅ USAR VALOR VALIDADO
      creadoPor: usuarioId,
      empleadoId: empleadoId || null
    };

    const nuevaTarea = await Tarea.crear(tareaData);

    res.status(201).json({
      success: true,
      message: empleadoId 
        ? 'Tarea creada y asignada exitosamente' 
        : 'Tarea creada exitosamente (sin asignar)',
      data: nuevaTarea
    });

  } catch (error) {
    next(error);
  }
},

  // Reasignar tarea (cambiar asignado o dejar sin asignar)
  reasignarTarea: async (req, res, next) => {
  try {
    const { id: proyectoId, tareaId } = req.params;
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol;
    const { empleadoId } = req.body;

    const [verificacion] = await req.app.locals.db.query(`
      SELECT t.*, p.JefeProyectoID, p.ID as ProyectoID
      FROM tareas t
      JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
    `, [tareaId, proyectoId]);

    if (verificacion.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada en este proyecto'
      });
    }

    const tarea = verificacion[0];
    
    const [empleadoUsuario] = await req.app.locals.db.query(`
      SELECT ID FROM empleados WHERE UsuarioID = ?
    `, [usuarioId]);
    
    const miEmpleadoId = empleadoUsuario[0]?.ID;

    // ✅ USAR usuarioRol DEL TOKEN
    const esAdmin = usuarioRol === 'admin';
    const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;

    if (!esAdmin && !esJefeProyecto) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador o el jefe del proyecto pueden reasignar tareas'
      });
    }

    if (empleadoId) {
      const [esMiembro] = await req.app.locals.db.query(`
        SELECT 1 FROM proyecto_empleados 
        WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1
      `, [proyectoId, empleadoId]);

      if (esMiembro.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El empleado debe pertenecer al proyecto para ser asignado a la tarea'
        });
      }
    }

    const resultado = await Tarea.reasignarTarea(tareaId, empleadoId || null, usuarioId);

    res.status(200).json({
      success: true,
      message: empleadoId 
        ? `Tarea reasignada a empleado ID: ${empleadoId}` 
        : 'Tarea desasignada (sin asignar)',
      data: resultado
    });

  } catch (error) {
    next(error);
  }
},

  // Obtener tarea específica
  obtenerTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const [verificacion] = await req.app.locals.db.query(`
        SELECT 1 FROM tareas 
        WHERE ID = ? AND ProyectoID = ? AND Activo = 1
      `, [tareaId, proyectoId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada en este proyecto'
        });
      }

      const tarea = await Tarea.obtenerPorId(tareaId, usuarioId, usuarioRol);

      res.status(200).json({
        success: true,
        data: tarea
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

  // Listar tareas del proyecto
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
        soloSinAsignar = false,
        search = ''
      } = req.query;

      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto'
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

      res.status(200).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

// Actualizar tarea
actualizarTarea: async (req, res, next) => {
  try {
    const { id: proyectoId, tareaId } = req.params;
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol; // ✅ USAR DEL TOKEN

    const [verificacion] = await req.app.locals.db.query(`
      SELECT t.*, p.JefeProyectoID 
      FROM tareas t
      JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
    `, [tareaId, proyectoId]);

    if (verificacion.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada en este proyecto'
      });
    }

    const tarea = verificacion[0];
    const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);

    // ✅ USAR usuarioRol DEL TOKEN
    const esAdmin = usuarioRol === 'admin';
    const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;
    
    const [esAsignado] = await req.app.locals.db.query(`
      SELECT 1 FROM tarea_asignaciones 
      WHERE TareaID = ? AND EmpleadoID = ? AND Activo = 1
    `, [tareaId, miEmpleadoId]);
    
    // Verificar si la tarea tiene algún asignado
    const [tieneAsignado] = await req.app.locals.db.query(`
      SELECT 1 FROM tarea_asignaciones 
      WHERE TareaID = ? AND Activo = 1 LIMIT 1
    `, [tareaId]);
    
    const tareaSinAsignar = tieneAsignado.length === 0;

    // ✅ REGLAS DE NEGOCIO PARA EDITAR:
    const puedeEditar = esAdmin || esJefeProyecto || esAsignado.length > 0 || tareaSinAsignar;

    if (!puedeEditar) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar esta tarea'
      });
    }

    // ✅ VALIDAR PRIORIDAD
    const datosActualizar = { ...req.body };
    if (datosActualizar.prioridad) {
      if (!['baja', 'media', 'alta', 'urgente'].includes(datosActualizar.prioridad)) {
        return res.status(400).json({
          success: false,
          message: 'Prioridad inválida. Debe ser: baja, media, alta o urgente'
        });
      }
    }

    const tareaActualizada = await Tarea.actualizar(tareaId, datosActualizar, usuarioId);

    res.status(200).json({
      success: true,
      message: 'Tarea actualizada exitosamente',
      data: tareaActualizada
    });

  } catch (error) {
    next(error);
  }
},

  // Cambiar estado de tarea 
  cambiarEstadoTarea: async (req, res, next) => {
  try {
    const { id: proyectoId, tareaId } = req.params;
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol; // ✅ ESTO YA VIENE DEL TOKEN
    const { estado } = req.body;

    if (!estado || !['pendiente', 'en_proceso', 'realizada'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido. Debe ser: pendiente, en_proceso o realizada'
      });
    }

    // 1. VERIFICAR QUE LA TAREA EXISTE
    const [tarea] = await req.app.locals.db.query(`
      SELECT t.*, p.JefeProyectoID 
      FROM tareas t
      JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
    `, [tareaId, proyectoId]);

    if (tarea.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada en este proyecto'
      });
    }

    const tareaInfo = tarea[0];

    // 2. OBTENER EL EMPLEADO ID DEL USUARIO
    const [empleado] = await req.app.locals.db.query(`
      SELECT ID FROM empleados WHERE UsuarioID = ?
    `, [usuarioId]);

    if (empleado.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un empleado asociado a este usuario'
      });
    }

    const miEmpleadoId = empleado[0].ID;

    // 3. VERIFICAR SI ES EL ASIGNADO
    const [asignacion] = await req.app.locals.db.query(`
      SELECT 1 FROM tarea_asignaciones 
      WHERE TareaID = ? AND EmpleadoID = ? AND Activo = 1
    `, [tareaId, miEmpleadoId]);
    
    const esAsignado = asignacion.length > 0;

    // 4. VERIFICAR SI LA TAREA TIENE ALGÚN ASIGNADO
    const [tieneAsignado] = await req.app.locals.db.query(`
      SELECT 1 FROM tarea_asignaciones 
      WHERE TareaID = ? AND Activo = 1 LIMIT 1
    `, [tareaId]);
    
    const tareaSinAsignar = tieneAsignado.length === 0;

    // 5. VERIFICAR ROLES - ✅ USAR usuarioRol DEL TOKEN
    const esAdmin = usuarioRol === 'admin';
    const esJefeProyecto = tareaInfo.JefeProyectoID === miEmpleadoId;

    console.log('📋 DEBUG - Cambiar estado tarea:', {
      usuarioId,
      usuarioRol,
      miEmpleadoId,
      esAdmin,
      esJefeProyecto,
      esAsignado,
      tareaSinAsignar,
      tareaId,
      estado
    });

    // ✅ REGLAS DE NEGOCIO:
    const puedeCambiarEstado = esAdmin || esJefeProyecto || esAsignado || tareaSinAsignar;

    if (!puedeCambiarEstado) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cambiar el estado de esta tarea'
      });
    }

    // 6. ACTUALIZAR ESTADO
    await req.app.locals.db.query(`
      UPDATE tareas 
      SET Estado = ?, updatedAt = NOW()
      WHERE ID = ? AND Activo = 1
    `, [estado, tareaId]);

    // 7. SI SE MARCA COMO REALIZADA Y ES EL ASIGNADO
    if (estado === 'realizada' && esAsignado) {
      await req.app.locals.db.query(`
        UPDATE tarea_asignaciones 
        SET FechaFinalizacion = CURDATE()
        WHERE TareaID = ? AND EmpleadoID = ? AND Activo = 1
      `, [tareaId, miEmpleadoId]);
    }

    res.status(200).json({
      success: true,
      message: `Estado de la tarea cambiado a: ${estado}`,
      data: { id: tareaId, estado }
    });

  } catch (error) {
    console.error('❌ Error en cambiarEstadoTarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al cambiar el estado de la tarea'
    });
  }
},

// Asignar empleado a tarea (wrapper para reasignar)
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

    // Verificar permisos directamente aquí
    const [verificacion] = await req.app.locals.db.query(`
      SELECT t.*, p.JefeProyectoID, p.ID as ProyectoID
      FROM tareas t
      JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
    `, [tareaId, proyectoId]);

    if (verificacion.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada en este proyecto'
      });
    }

    const tarea = verificacion[0];
    
    const [empleadoUsuario] = await req.app.locals.db.query(`
      SELECT ID FROM empleados WHERE UsuarioID = ?
    `, [usuarioId]);
    
    const miEmpleadoId = empleadoUsuario[0]?.ID;

    const esAdmin = usuarioRol === 'admin';
    const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;

    if (!esAdmin && !esJefeProyecto) {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador o el jefe del proyecto pueden asignar tareas'
      });
    }

    // Verificar que el empleado pertenezca al proyecto
    const [esMiembro] = await req.app.locals.db.query(`
      SELECT 1 FROM proyecto_empleados 
      WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1
    `, [proyectoId, empleadoId]);

    if (esMiembro.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El empleado debe pertenecer al proyecto para ser asignado a la tarea'
      });
    }

    const resultado = await Tarea.reasignarTarea(tareaId, empleadoId, usuarioId);

    res.status(200).json({
      success: true,
      message: `Tarea asignada a empleado ID: ${empleadoId}`,
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

      // Verificar permisos
      const [verificacion] = await req.app.locals.db.query(`
        SELECT t.*, p.JefeProyectoID 
        FROM tareas t
        JOIN proyectos p ON t.ProyectoID = p.ID
        WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
      `, [tareaId, proyectoId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada en este proyecto'
        });
      }

      const tarea = verificacion[0];
      const esAdmin = usuarioRol === 'admin';
      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden desasignar tareas'
        });
      }

      const resultado = await Tarea.quitarAsignacion(null, usuarioId, tareaId);

      res.status(200).json({
        success: true,
        message: 'Tarea desasignada exitosamente',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Quitar asignación de tarea (por ID de asignación)
  quitarAsignacionTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId, asignacionId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const [verificacion] = await req.app.locals.db.query(`
        SELECT t.*, p.JefeProyectoID 
        FROM tareas t
        JOIN proyectos p ON t.ProyectoID = p.ID
        WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
      `, [tareaId, proyectoId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada en este proyecto'
        });
      }

      const tarea = verificacion[0];
      const esAdmin = usuarioRol === 'admin';
      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;

      if (!esAdmin && !esJefeProyecto) {
        return res.status(403).json({
          success: false,
          message: 'Solo el administrador o el jefe del proyecto pueden quitar asignaciones'
        });
      }

      const resultado = await Tarea.quitarAsignacion(asignacionId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Asignación removida exitosamente',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Eliminar tarea (lógica)
  eliminarTarea: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const [verificacion] = await req.app.locals.db.query(`
        SELECT t.*, p.JefeProyectoID 
        FROM tareas t
        JOIN proyectos p ON t.ProyectoID = p.ID
        WHERE t.ID = ? AND t.ProyectoID = ? AND t.Activo = 1
      `, [tareaId, proyectoId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Tarea no encontrada en este proyecto'
        });
      }

      const tarea = verificacion[0];
      const esAdmin = usuarioRol === 'admin';
      const miEmpleadoId = await empleadoHelper.obtenerEmpleadoId(usuarioId);
      const esJefeProyecto = tarea.JefeProyectoID === miEmpleadoId;

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
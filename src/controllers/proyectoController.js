const Proyecto = require('../models/proyectoModel');
const Tarea = require('../models/tareaModel');
const empleadoHelper = require('../utils/empleadoHelper');
const { formatDateFields, formatArrayDates } = require('../utils/dateFormatter');

const proyectoController = {
  // Crear nuevo proyecto
  crearProyecto: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      if (!['admin', 'manager'].includes(usuarioRol)) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden crear proyectos'
        });
      }

      const {
        nombre,
        descripcion,
        fechaInicio,
        fechaFin,
        estado,
        presupuesto,
        montoAsignado,
        moneda,
        jefeProyectoId
      } = req.body;

      if (!nombre || !fechaInicio || !presupuesto || !jefeProyectoId) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, fecha de inicio, presupuesto y jefe de proyecto son requeridos'
        });
      }

      const [jefe] = await req.app.locals.db.query(
        `SELECT e.RolApp FROM empleados e WHERE e.ID = ?`,
        [jefeProyectoId]
      );

      if (jefe.length === 0 || jefe[0].RolApp !== 'manager') {
        return res.status(400).json({
          success: false,
          message: 'El jefe de proyecto debe tener rol de manager'
        });
      }

      const proyectoData = {
        nombre,
        descripcion: descripcion || null,
        fechaInicio: new Date(fechaInicio).toISOString().split('T')[0],
        fechaFin: fechaFin ? new Date(fechaFin).toISOString().split('T')[0] : null,
        estado: estado || 'activo',
        presupuesto: parseFloat(presupuesto),
        montoAsignado: montoAsignado ? parseFloat(montoAsignado) : 0,
        moneda: moneda || 'MXN',
        jefeProyectoId,
        creadoPor: usuarioId
      };

      const nuevoProyecto = await Proyecto.crear(proyectoData);
      const proyectoFormateado = formatDateFields(nuevoProyecto, ['FechaInicio', 'FechaFin'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        data: proyectoFormateado
      });
    } catch (error) {
      next(error);
    }
  },

// Listar proyectos con filtros
listarProyectos: async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const usuarioRol = req.user.rol;
    const {
      estado,
      jefeProyectoId,
      page = 1,
      limit = 10,
      search = ''
    } = req.query;

    const filtros = {
      usuarioId,
      usuarioRol,
      estado,
      jefeProyectoId,
      page: parseInt(page),
      limit: parseInt(limit),
      search
    };

    const resultado = await Proyecto.listar(filtros);
    
    // Asegurarse de que los proyectos existan antes de formatear
    const proyectos = resultado.proyectos || [];
    const proyectosFormateados = formatArrayDates(
      proyectos,
      ['FechaInicio', 'FechaFin'],
      ['createdAt', 'updatedAt']
    );

    res.status(200).json({
      success: true,
      data: {
        proyectos: proyectosFormateados,
        pagination: resultado.pagination || {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalPages: 0
        }
      }
    });
  } catch (error) {
    console.error('Error en listarProyectos:', error);
    next(error);
  }
},

  // Obtener proyectos donde el usuario es jefe
  obtenerMisProyectos: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        estado,
        page = 1,
        limit = 10,
        search = ''
      } = req.query;

      // Obtener el ID del empleado del usuario
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );

      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const empleadoId = empleado[0].ID;

      const filtros = {
        usuarioId,
        usuarioRol,
        estado,
        jefeProyectoId: empleadoId,
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        soloMisProyectos: true
      };

      const resultado = await Proyecto.listar(filtros);
      const proyectosFormateados = formatArrayDates(
        resultado.proyectos,
        ['FechaInicio', 'FechaFin'],
        ['createdAt', 'updatedAt']
      );

      res.status(200).json({
        success: true,
        data: {
          proyectos: proyectosFormateados,
          pagination: resultado.pagination
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener proyectos asignados al usuario (como miembro)
  obtenerProyectosAsignados: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        estado,
        page = 1,
        limit = 10,
        search = ''
      } = req.query;

      // Obtener el ID del empleado del usuario
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );

      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const empleadoId = empleado[0].ID;

      // Consulta para obtener proyectos donde el empleado es miembro pero no jefe
      const [rows] = await req.app.locals.db.query(
        `SELECT DISTINCT p.*, 
          e.NombreCompleto as JefeProyectoNombre,
          e.CorreoElectronico as JefeProyectoEmail
         FROM proyectos p
         JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID
         LEFT JOIN empleados e ON p.JefeProyectoID = e.ID
         WHERE pe.EmpleadoID = ? 
           AND p.JefeProyectoID != ?
           AND p.Activo = 1
           ${estado ? 'AND p.Estado = ?' : ''}
           ${search ? 'AND (p.Nombre LIKE ? OR p.Descripcion LIKE ?)' : ''}
         ORDER BY p.createdAt DESC
         LIMIT ? OFFSET ?`,
        search 
          ? [empleadoId, empleadoId, estado, `%${search}%`, `%${search}%`, limit, (page - 1) * limit]
          : estado 
            ? [empleadoId, empleadoId, estado, limit, (page - 1) * limit]
            : [empleadoId, empleadoId, limit, (page - 1) * limit]
      );

      const [countResult] = await req.app.locals.db.query(
        `SELECT COUNT(DISTINCT p.ID) as total
         FROM proyectos p
         JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID
         WHERE pe.EmpleadoID = ? 
           AND p.JefeProyectoID != ?
           AND p.Activo = 1
           ${estado ? 'AND p.Estado = ?' : ''}
           ${search ? 'AND (p.Nombre LIKE ? OR p.Descripcion LIKE ?)' : ''}`,
        search 
          ? [empleadoId, empleadoId, estado, `%${search}%`, `%${search}%`]
          : estado 
            ? [empleadoId, empleadoId, estado]
            : [empleadoId, empleadoId]
      );

      const proyectosFormateados = formatArrayDates(rows, ['FechaInicio', 'FechaFin'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          proyectos: proyectosFormateados,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener proyecto por ID
  obtenerProyecto: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(id, usuarioId, usuarioRol);

      if (!proyecto) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado o no tienes acceso'
        });
      }

      const [estadisticas] = await req.app.locals.db.query(
        `SELECT 
          COUNT(DISTINCT t.ID) as total_tareas,
          COUNT(DISTINCT CASE WHEN t.Estado = 'realizada' THEN t.ID END) as tareas_completadas,
          COUNT(DISTINCT pe.EmpleadoID) as total_empleados,
          COUNT(DISTINCT CASE WHEN t.Estado = 'pendiente' THEN t.ID END) as tareas_pendientes,
          COUNT(DISTINCT CASE WHEN t.Estado = 'en_proceso' THEN t.ID END) as tareas_en_proceso
         FROM proyectos p
         LEFT JOIN tareas t ON p.ID = t.ProyectoID AND t.Activo = 1
         LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID AND pe.Activo = 1
         WHERE p.ID = ?`,
        [id]
      );

      const proyectoFormateado = formatDateFields(proyecto, ['FechaInicio', 'FechaFin'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          ...proyectoFormateado,
          estadisticas: estadisticas[0]
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Actualizar proyecto
  actualizarProyecto: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(id, usuarioId, usuarioRol);
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
          message: 'Solo el administrador o el jefe del proyecto pueden actualizarlo'
        });
      }

      if (req.body.presupuesto && !esAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden modificar el presupuesto'
        });
      }

      if (req.body.fechaInicio) {
        req.body.fechaInicio = new Date(req.body.fechaInicio).toISOString().split('T')[0];
      }
      if (req.body.fechaFin) {
        req.body.fechaFin = new Date(req.body.fechaFin).toISOString().split('T')[0];
      }

      const proyectoActualizado = await Proyecto.actualizar(id, req.body, usuarioId);
      const proyectoFormateado = formatDateFields(proyectoActualizado, ['FechaInicio', 'FechaFin'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        data: proyectoFormateado
      });
    } catch (error) {
      next(error);
    }
  },

  // Cambiar estado del proyecto
  cambiarEstadoProyecto: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { estado } = req.body;

      if (!estado || !['activo', 'pausado', 'finalizado'].includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido. Debe ser: activo, pausado o finalizado'
        });
      }

      const proyecto = await Proyecto.obtenerPorId(id, usuarioId, usuarioRol);
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
          message: 'Solo el administrador o el jefe del proyecto pueden cambiar el estado'
        });
      }

      const proyectoActualizado = await Proyecto.actualizar(id, { estado }, usuarioId);
      const proyectoFormateado = formatDateFields(proyectoActualizado, ['FechaInicio', 'FechaFin'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: `Estado del proyecto cambiado a: ${estado}`,
        data: proyectoFormateado
      });
    } catch (error) {
      next(error);
    }
  },

  // Eliminar proyecto
  eliminarProyecto: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const proyecto = await Proyecto.obtenerPorId(id, usuarioId, usuarioRol);
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
          message: 'Solo el administrador o el jefe del proyecto pueden eliminarlo'
        });
      }

      const resultado = await Proyecto.eliminar(id, usuarioId);

      res.status(200).json({
        success: true,
        message: resultado.message,
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener empleados del proyecto con estado
  obtenerEmpleadosProyectoConEstado: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const empleados = await Proyecto.obtenerEmpleados(proyectoId, usuarioId, usuarioRol);
      
      const empleadosConEstado = empleados.map(emp => ({
        ...emp,
        estadoAsignacion: 'asignado'
      }));
      
      const empleadosFormateados = formatArrayDates(
        empleadosConEstado,
        ['FechaIngreso', 'FechaAsignacion'],
        ['createdAt']
      );

      res.status(200).json({
        success: true,
        data: empleadosFormateados,
        meta: {
          total: empleadosFormateados.length,
          proyectoId
        }
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

  // Obtener empleados disponibles para asignar
  obtenerEmpleadosDisponibles: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { 
        departamentoId, 
        search = '', 
        modo = 'todos',
        incluirAsignados = false 
      } = req.query;

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
          message: 'Solo el jefe del proyecto o administrador pueden ver empleados disponibles'
        });
      }

      const filtros = {
        departamentoId,
        search,
        modo,
        incluirAsignados: incluirAsignados === 'true'
      };

      const resultado = await Proyecto.obtenerEmpleadosDisponibles(
        proyectoId,
        proyecto.JefeProyectoID,
        usuarioRol,
        filtros
      );
      
      const empleadosFormateados = formatArrayDates(
        resultado.empleados,
        ['FechaIngreso'],
        []
      );

      res.status(200).json({
        success: true,
        message: `Empleados ${modo === 'supervisados' ? 'bajo supervisión' : 'de la empresa'} recuperados`,
        data: {
          ...resultado,
          empleados: empleadosFormateados
        },
        meta: {
          proyecto: {
            id: proyecto.ID,
            nombre: proyecto.Nombre,
            jefeProyectoId: proyecto.JefeProyectoID,
            jefeProyectoNombre: proyecto.JefeProyectoNombre
          },
          usuario: {
            id: usuarioId,
            empleadoId: miEmpleadoId,
            rol: usuarioRol,
            esJefeProyecto
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Buscar empleados generales
  buscarEmpleadosGenerales: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        departamentoId,
        search = '',
        soloNoAsignados = 'true',
        incluirJefe = 'false',
        page = 1,
        limit = 20
      } = req.query;

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
          message: 'Solo el jefe del proyecto o administrador pueden buscar empleados'
        });
      }

      const filtros = {
        departamentoId,
        search,
        soloNoAsignados: soloNoAsignados === 'true',
        incluirJefe: incluirJefe === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const resultado = await Proyecto.buscarEmpleadosGenerales(
        proyectoId,
        usuarioId,
        usuarioRol,
        filtros
      );
      
      const empleadosFormateados = formatArrayDates(
        resultado.empleados,
        ['FechaIngreso'],
        []
      );

      res.status(200).json({
        success: true,
        message: 'Búsqueda de empleados completada',
        data: {
          ...resultado,
          empleados: empleadosFormateados
        },
        meta: {
          proyecto: {
            id: proyecto.ID,
            nombre: proyecto.Nombre
          },
          permisos: {
            esAdmin,
            esJefeProyecto
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Asignar empleado al proyecto
  asignarEmpleado: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
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
          message: 'Solo el administrador o el jefe del proyecto pueden asignar empleados'
        });
      }

      if (!esAdmin) {
        const [empleado] = await req.app.locals.db.query(
          `SELECT e.ID, e.NombreCompleto 
           FROM empleados e
           INNER JOIN usuarios u ON e.UsuarioID = u.ID
           WHERE e.ID = ? AND u.Activo = 1`,
          [empleadoId]
        );
        
        if (empleado.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'El empleado no existe o no está activo'
          });
        }

        if (parseInt(empleadoId) === proyecto.JefeProyectoID) {
          return res.status(400).json({
            success: false,
            message: 'El jefe del proyecto ya está asignado automáticamente'
          });
        }

        const [yaAsignado] = await req.app.locals.db.query(
          'SELECT ID FROM proyecto_empleados WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1',
          [proyectoId, empleadoId]
        );

        if (yaAsignado.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'El empleado ya está asignado a este proyecto'
          });
        }
      }

      const resultado = await Proyecto.asignarEmpleado(proyectoId, empleadoId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Empleado asignado al proyecto exitosamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('ya está asignado')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  // Quitar empleado del proyecto
  quitarEmpleado: async (req, res, next) => {
    try {
      const { id: proyectoId, empleadoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

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
          message: 'Solo el administrador o el jefe del proyecto pueden quitar empleados'
        });
      }

      const resultado = await Proyecto.quitarEmpleado(proyectoId, empleadoId, usuarioId);

      res.status(200).json({
        success: true,
        message: resultado.message || 'Empleado removido del proyecto exitosamente',
        data: resultado
      });
    } catch (error) {
      if (error.message.includes('jefe del proyecto')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  // Obtener historial del proyecto
  obtenerHistorial: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const historial = await Proyecto.obtenerHistorial(proyectoId, usuarioId, usuarioRol);
      const historialFormateado = formatArrayDates(historial, [], ['createdAt']);

      res.status(200).json({
        success: true,
        data: historialFormateado
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
  }
};

module.exports = proyectoController;
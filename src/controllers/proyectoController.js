// controllers/proyectoController.js
const Proyecto = require('../models/proyectoModel');
const empleadoHelper = require('../utils/empleadoHelper');

const proyectoController = {
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

      const [jefe] = await req.app.locals.db.query(`
        SELECT e.RolApp FROM empleados e WHERE e.ID = ?
      `, [jefeProyectoId]);

      if (jefe.length === 0 || jefe[0].RolApp !== 'manager') {
        return res.status(400).json({
          success: false,
          message: 'El jefe de proyecto debe tener rol de manager'
        });
      }

      const proyectoData = {
        nombre,
        descripcion: descripcion || null,
        fechaInicio,
        fechaFin: fechaFin || null,
        estado: estado || 'activo',
        presupuesto: parseFloat(presupuesto),
        montoAsignado: montoAsignado ? parseFloat(montoAsignado) : 0,
        moneda: moneda || 'MXN',
        jefeProyectoId,
        creadoPor: usuarioId
      };

      const nuevoProyecto = await Proyecto.crear(proyectoData);

      res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        data: nuevoProyecto
      });

    } catch (error) {
      next(error);
    }
  },

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

      const [estadisticas] = await req.app.locals.db.query(`
        SELECT 
          COUNT(DISTINCT t.ID) as total_tareas,
          COUNT(DISTINCT CASE WHEN t.Estado = 'realizada' THEN t.ID END) as tareas_completadas,
          COUNT(DISTINCT pe.EmpleadoID) as total_empleados,
          COUNT(DISTINCT CASE WHEN t.Estado = 'pendiente' THEN t.ID END) as tareas_pendientes,
          COUNT(DISTINCT CASE WHEN t.Estado = 'en_proceso' THEN t.ID END) as tareas_en_proceso
        FROM proyectos p
        LEFT JOIN tareas t ON p.ID = t.ProyectoID AND t.Activo = 1
        LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID AND pe.Activo = 1
        WHERE p.ID = ?
      `, [id]);

      res.status(200).json({
        success: true,
        data: {
          ...proyecto,
          estadisticas: estadisticas[0]
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

  listarProyectos: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const {
        estado,
        jefeProyectoId,
        page = 1,
        limit = 10,
        soloMisProyectos = false,
        search = ''
      } = req.query;

      const filtros = {
        usuarioId,
        usuarioRol,
        estado,
        jefeProyectoId,
        page: parseInt(page),
        limit: parseInt(limit),
        soloMisProyectos: soloMisProyectos === 'true',
        search
      };

      const resultado = await Proyecto.listar(filtros);

      res.status(200).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

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

      const proyectoActualizado = await Proyecto.actualizar(id, req.body, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        data: proyectoActualizado
      });

    } catch (error) {
      next(error);
    }
  },

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

      res.status(200).json({
        success: true,
        message: `Estado del proyecto cambiado a: ${estado}`,
        data: proyectoActualizado
      });

    } catch (error) {
      next(error);
    }
  },

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

  listarEmpleadosProyecto: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const empleados = await Proyecto.obtenerEmpleados(proyectoId, usuarioId, usuarioRol);

      res.status(200).json({
        success: true,
        data: empleados
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

      res.status(200).json({
        success: true,
        message: `Empleados ${modo === 'supervisados' ? 'bajo supervisión' : 'de la empresa'} recuperados`,
        data: resultado,
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

      res.status(200).json({
        success: true,
        message: 'Búsqueda de empleados completada',
        data: resultado,
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

  obtenerEmpleadosProyectoConEstado: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const empleados = await Proyecto.obtenerEmpleados(proyectoId, usuarioId, usuarioRol);

      const empleadosConEstado = empleados.map(emp => ({
        ...emp,
        estadoAsignacion: 'asignado',
        fechaAsignacionFormateada: emp.FechaAsignacion ? 
          new Date(emp.FechaAsignacion).toLocaleDateString('es-MX') : null
      }));

      res.status(200).json({
        success: true,
        data: empleadosConEstado,
        meta: {
          total: empleadosConEstado.length,
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

  obtenerHistorial: async (req, res, next) => {
    try {
      const { id: proyectoId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const historial = await Proyecto.obtenerHistorial(proyectoId, usuarioId, usuarioRol);

      res.status(200).json({
        success: true,
        data: historial
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

      const filtros = {
        usuarioId,
        usuarioRol,
        estado,
        page: parseInt(page),
        limit: parseInt(limit),
        soloMisProyectos: true,
        search
      };

      const resultado = await Proyecto.listar(filtros);

      res.status(200).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

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

      const filtros = {
        usuarioId,
        usuarioRol,
        estado,
        page: parseInt(page),
        limit: parseInt(limit),
        soloMisProyectos: false,
        search
      };

      const resultado = await Proyecto.listar(filtros);

      res.status(200).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = proyectoController;
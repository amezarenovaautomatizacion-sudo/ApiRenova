const Notificacion = require('../models/notificacionModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const notificacionController = {
  obtenerMisNotificaciones: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { 
        tipo, 
        estado, 
        importante, 
        page = 1, 
        limit = 20 
      } = req.query;
      
      const filtros = {
        usuarioId,
        tipo,
        estado: estado || '',
        importante: importante === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const resultado = await Notificacion.obtenerNotificacionesPersonales(filtros);
      
      const notificacionesFormateadas = formatArrayDates(
        resultado.notificaciones,
        ['FechaVista', 'FechaEliminada', 'FechaExpiracion'],
        ['createdAt', 'updatedAt']
      );

      res.status(200).json({
        success: true,
        data: {
          notificaciones: notificacionesFormateadas,
          pagination: resultado.pagination
        }
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerResumenNotificaciones: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const resumen = await Notificacion.obtenerResumenNotificaciones(usuarioId);
      
      const resumenFormateado = formatDateFields(resumen, ['ultima_notificacion'], []);

      res.status(200).json({
        success: true,
        data: resumenFormateado
      });

    } catch (error) {
      next(error);
    }
  },

  marcarComoVista: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { notificacionId } = req.params;

      if (!notificacionId) {
        return res.status(400).json({
          success: false,
          message: 'notificacionId es requerido'
        });
      }

      const resultado = await Notificacion.marcarComoVista(notificacionId, usuarioId);

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada o no pertenece al usuario'
        });
      }
      
      const resultadoFormateado = formatDateFields(resultado, ['FechaVista', 'FechaExpiracion'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como vista',
        data: resultadoFormateado
      });

    } catch (error) {
      next(error);
    }
  },

  marcarComoLeida: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { notificacionId } = req.params;

      if (!notificacionId) {
        return res.status(400).json({
          success: false,
          message: 'notificacionId es requerido'
        });
      }

      const resultado = await Notificacion.marcarComoLeida(notificacionId, usuarioId);

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada o no pertenece al usuario'
        });
      }
      
      const resultadoFormateado = formatDateFields(resultado, ['FechaVista', 'FechaExpiracion'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data: resultadoFormateado
      });

    } catch (error) {
      next(error);
    }
  },

  eliminarNotificacion: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { notificacionId } = req.params;

      if (!notificacionId) {
        return res.status(400).json({
          success: false,
          message: 'notificacionId es requerido'
        });
      }

      const resultado = await Notificacion.eliminarNotificacion(notificacionId, usuarioId);

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada o no pertenece al usuario'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notificación eliminada',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  marcarTodasComoVistas: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;

      const resultado = await Notificacion.marcarTodasComoVistas(usuarioId);

      res.status(200).json({
        success: true,
        message: `Se marcaron ${resultado.afectadas} notificaciones como vistas`,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerNotificacionesGenerales: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { 
        importante, 
        vista, 
        page = 1, 
        limit = 20 
      } = req.query;
      
      const filtros = {
        usuarioId,
        importante: importante === 'true',
        vista: vista === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const resultado = await Notificacion.obtenerNotificacionesGenerales(filtros);
      
      const notificacionesFormateadas = formatArrayDates(
        resultado.notificaciones,
        ['FechaExpiracion', 'FechaVista'],
        ['createdAt', 'updatedAt']
      );

      res.status(200).json({
        success: true,
        data: {
          notificaciones: notificacionesFormateadas,
          pagination: resultado.pagination
        }
      });

    } catch (error) {
      next(error);
    }
  },

  marcarGeneralComoVista: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const { notificacionId } = req.params;

      if (!notificacionId) {
        return res.status(400).json({
          success: false,
          message: 'notificacionId es requerido'
        });
      }

      const resultado = await Notificacion.marcarGeneralComoVista(notificacionId, usuarioId);

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: 'Notificación general no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notificación general marcada como vista',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  crearNotificacionGeneral: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden crear notificaciones generales'
        });
      }

      const { 
        titulo, 
        mensaje, 
        tipoNotificacionId, 
        importante = false, 
        vigenciaDias = 30,
        datosExtra 
      } = req.body;

      if (!titulo || !mensaje) {
        return res.status(400).json({
          success: false,
          message: 'Título y mensaje son requeridos'
        });
      }

      const notificacionData = {
        titulo,
        mensaje,
        tipoNotificacionId: tipoNotificacionId || 15,
        importante,
        vigenciaDias,
        datosExtra,
        creadoPor: req.user.id
      };

      const resultado = await Notificacion.crearNotificacionGeneral(notificacionData);
      
      const resultadoFormateado = formatDateFields(resultado, ['FechaExpiracion'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Notificación general creada exitosamente',
        data: resultadoFormateado
      });

    } catch (error) {
      next(error);
    }
  },

  crearNotificacionPersonal: async (req, res, next) => {
    try {
      const { usuarioId, titulo, mensaje, tipoNotificacionId = 1, vigenciaDias = 30 } = req.body;
      
      if (!usuarioId || !titulo || !mensaje) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId, título y mensaje son requeridos'
        });
      }

      const resultado = await Notificacion.crearNotificacionPersonal({
        usuarioId,
        tipoNotificacionId,
        titulo,
        mensaje,
        vigenciaDias
      });
      
      const resultadoFormateado = formatDateFields(resultado, ['FechaExpiracion'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Notificación personal creada',
        data: resultadoFormateado
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerUltimaNotificacion: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const [notificaciones] = await req.app.locals.db.query(`
        SELECT 
          np.ID,
          np.Titulo,
          np.Mensaje,
          np.createdAt,
          tn.Nombre as Tipo,
          tn.Prioridad
        FROM notificaciones_personales np
        JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
        WHERE np.UsuarioID = ? 
          AND np.Estado = 'no_vista'
          AND np.Activo = 1
          AND np.FechaExpiracion > NOW()
        ORDER BY np.createdAt DESC
        LIMIT 1
      `, [usuarioId]);
      
      const notificacionFormateada = notificaciones[0] 
        ? formatDateFields(notificaciones[0], [], ['createdAt'])
        : null;

      res.status(200).json({
        success: true,
        data: notificacionFormateada
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerTiposNotificacion: async (req, res, next) => {
    try {
      const tipos = await Notificacion.obtenerTiposNotificacion();
      
      const tiposFormateados = formatArrayDates(tipos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: tiposFormateados
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerConfiguraciones: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver las configuraciones'
        });
      }

      const configuraciones = await Notificacion.obtenerConfiguraciones();
      
      const configuracionesFormateadas = formatArrayDates(configuraciones, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: configuracionesFormateadas
      });

    } catch (error) {
      next(error);
    }
  },

  actualizarConfiguracion: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden actualizar configuraciones'
        });
      }

      const { id } = req.params;
      const { valor } = req.body;

      if (valor === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Valor es requerido'
        });
      }

      const resultado = await Notificacion.actualizarConfiguracion(id, valor);

      if (!resultado) {
        return res.status(404).json({
          success: false,
          message: 'Configuración no encontrada'
        });
      }
      
      const resultadoFormateado = formatDateFields(resultado, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Configuración actualizada',
        data: resultadoFormateado
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificacionController;
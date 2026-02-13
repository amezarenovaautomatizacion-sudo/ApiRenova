const Notificacion = require('../models/notificacionModel');

const notificacionController = {
  // Obtener notificaciones personales del usuario
obtenerMisNotificaciones: async (req, res, next) => {
  try {
    const usuarioId = req.user.id;
    const { 
      tipo, 
      estado,  // ← CAMBIO: eliminar el valor por defecto 'no_vista'
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

    res.status(200).json({
      success: true,
      data: resultado
    });

  } catch (error) {
    next(error);
  }
},

  // Obtener resumen de notificaciones (contadores)
  obtenerResumenNotificaciones: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      
      const resumen = await Notificacion.obtenerResumenNotificaciones(usuarioId);

      res.status(200).json({
        success: true,
        data: resumen
      });

    } catch (error) {
      next(error);
    }
  },

  // Marcar notificación como vista
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

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como vista',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Marcar notificación como leída
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

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Eliminar notificación
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

  // Marcar todas como vistas
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

  // Obtener notificaciones generales
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

      res.status(200).json({
        success: true,
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Marcar notificación general como vista
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

  // Crear notificación general (solo admin)
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
        tipoNotificacionId: tipoNotificacionId || 15, // notificacion_general por defecto
        importante,
        vigenciaDias,
        datosExtra,
        creadoPor: req.user.id
      };

      const resultado = await Notificacion.crearNotificacionGeneral(notificacionData);

      res.status(201).json({
        success: true,
        message: 'Notificación general creada exitosamente',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  },

  // Obtener tipos de notificación
  obtenerTiposNotificacion: async (req, res, next) => {
    try {
      const tipos = await Notificacion.obtenerTiposNotificacion();

      res.status(200).json({
        success: true,
        data: tipos
      });

    } catch (error) {
      next(error);
    }
  },

  // Obtener configuraciones de notificaciones
  obtenerConfiguraciones: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver las configuraciones'
        });
      }

      const configuraciones = await Notificacion.obtenerConfiguraciones();

      res.status(200).json({
        success: true,
        data: configuraciones
      });

    } catch (error) {
      next(error);
    }
  },

  // Actualizar configuración
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

      res.status(200).json({
        success: true,
        message: 'Configuración actualizada',
        data: resultado
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = notificacionController;
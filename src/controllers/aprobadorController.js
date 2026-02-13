const Aprobador = require('../models/aprobadorModel');

const aprobadorController = {
  // Agregar usuario como aprobador
  agregarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.body;

      // Validar campo requerido
      if (!usuarioId) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId es requerido'
        });
      }

      // Agregar como aprobador
      const resultado = await Aprobador.agregarAprobador(usuarioId);

      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado
      });

    } catch (error) {
      if (error.message.includes('no tiene rol de admin/manager')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      if (error.message.includes('ya es un aprobador activo')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  // Quitar usuario como aprobador
  quitarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.params;

      // Validar que el usuarioId sea numérico
      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId inválido'
        });
      }

      // Quitar como aprobador
      const resultado = await Aprobador.quitarAprobador(parseInt(usuarioId));

      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado
      });

    } catch (error) {
      if (error.message.includes('no es un aprobador activo')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  // Obtener todos los aprobadores activos
  obtenerAprobadoresActivos: async (req, res, next) => {
    try {
      const aprobadores = await Aprobador.obtenerAprobadoresActivos();

      res.status(200).json({
        success: true,
        data: aprobadores
      });

    } catch (error) {
      next(error);
    }
  },

  // Verificar si un usuario es aprobador
  verificarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.params;

      // Validar que el usuarioId sea numérico
      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId inválido'
        });
      }

      const esAprobador = await Aprobador.esAprobador(parseInt(usuarioId));

      res.status(200).json({
        success: true,
        data: {
          usuarioId,
          esAprobador
        }
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = aprobadorController;
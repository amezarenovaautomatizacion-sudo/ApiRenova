const Aprobador = require('../models/aprobadorModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const aprobadorController = {
  agregarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.body;

      if (!usuarioId) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId es requerido'
        });
      }

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

  quitarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.params;

      if (isNaN(usuarioId)) {
        return res.status(400).json({
          success: false,
          message: 'usuarioId inválido'
        });
      }

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

  obtenerAprobadoresActivos: async (req, res, next) => {
    try {
      const aprobadores = await Aprobador.obtenerAprobadoresActivos();
      
      const aprobadoresFormateados = formatArrayDates(aprobadores, [], ['createdAt']);

      res.status(200).json({
        success: true,
        data: aprobadoresFormateados
      });

    } catch (error) {
      next(error);
    }
  },

  verificarAprobador: async (req, res, next) => {
    try {
      const { usuarioId } = req.params;

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
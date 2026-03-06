const TipoIncidencia = require('../models/tipoIncidenciaModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const tipoIncidenciaController = {
  obtenerTiposActivos: async (req, res, next) => {
    try {
      const tipos = await TipoIncidencia.findAll();
      
      const tiposFormateados = formatArrayDates(tipos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: tiposFormateados
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerTodosTipos: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver todos los tipos'
        });
      }

      const tipos = await TipoIncidencia.findAllWithInactive();
      
      const tiposFormateados = formatArrayDates(tipos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: tiposFormateados
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerTipo: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const tipo = await TipoIncidencia.findById(id);
      
      if (!tipo) {
        return res.status(404).json({
          success: false,
          message: 'Tipo de incidencia no encontrado'
        });
      }
      
      const tipoFormateado = formatDateFields(tipo, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: tipoFormateado
      });
    } catch (error) {
      next(error);
    }
  },

  crearTipo: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden crear tipos de incidencia'
        });
      }

      const { nombre, descripcion } = req.body;
      
      if (!nombre) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es requerido'
        });
      }
      
      const nuevoTipo = await TipoIncidencia.create(nombre, descripcion);
      
      const tipoFormateado = formatDateFields(nuevoTipo, [], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Tipo de incidencia creado exitosamente',
        data: tipoFormateado
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un tipo de incidencia con ese nombre'
        });
      }
      next(error);
    }
  },

  actualizarTipo: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden actualizar tipos de incidencia'
        });
      }

      const { id } = req.params;
      const { nombre, descripcion } = req.body;
      
      if (!nombre) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es requerido'
        });
      }
      
      const tipoExistente = await TipoIncidencia.findById(id);
      if (!tipoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Tipo de incidencia no encontrado'
        });
      }
      
      const actualizado = await TipoIncidencia.update(id, nombre, descripcion);
      
      if (!actualizado) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo actualizar el tipo de incidencia'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Tipo de incidencia actualizado exitosamente'
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un tipo de incidencia con ese nombre'
        });
      }
      next(error);
    }
  },

  toggleActivo: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden cambiar el estado de tipos'
        });
      }

      const { id } = req.params;
      const { activo } = req.body;
      
      if (typeof activo !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'El campo activo debe ser booleano'
        });
      }
      
      const tipoExistente = await TipoIncidencia.findById(id);
      if (!tipoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Tipo de incidencia no encontrado'
        });
      }
      
      const actualizado = await TipoIncidencia.toggleActive(id, activo);
      
      if (!actualizado) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo cambiar el estado del tipo de incidencia'
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Tipo de incidencia ${activo ? 'activado' : 'desactivado'} exitosamente`
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = tipoIncidenciaController;
const TipoIncidencia = require('../models/tipoIncidenciaModel');

const tipoIncidenciaController = {
  // Obtener todos los tipos activos
  obtenerTiposActivos: async (req, res, next) => {
    try {
      const tipos = await TipoIncidencia.findAll();
      
      res.status(200).json({
        success: true,
        data: tipos
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener todos los tipos (incluyendo inactivos - solo admin)
  obtenerTodosTipos: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver todos los tipos'
        });
      }

      const tipos = await TipoIncidencia.findAllWithInactive();
      
      res.status(200).json({
        success: true,
        data: tipos
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener tipo por ID
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
      
      res.status(200).json({
        success: true,
        data: tipo
      });
    } catch (error) {
      next(error);
    }
  },

  // Crear nuevo tipo (solo admin)
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
      
      res.status(201).json({
        success: true,
        message: 'Tipo de incidencia creado exitosamente',
        data: nuevoTipo
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

  // Actualizar tipo (solo admin)
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
      
      // Verificar que existe
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

  // Activar/desactivar tipo (solo admin)
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
      
      // Verificar que existe
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
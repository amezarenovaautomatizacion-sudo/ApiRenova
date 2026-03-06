const NotaTarea = require('../models/notaTareaModel');
const Proyecto = require('../models/proyectoModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const notaTareaController = {
  crearNota: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { contenido, esPrivada } = req.body;

      if (!contenido) {
        return res.status(400).json({
          success: false,
          message: 'El contenido de la nota es requerido'
        });
      }

      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto'
        });
      }

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

      const [empleado] = await req.app.locals.db.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);

      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const notaData = {
        tareaId,
        empleadoId: empleado[0].ID,
        contenido,
        esPrivada: esPrivada ? 1 : 0,
        creadoPor: usuarioId
      };

      const nuevaNota = await NotaTarea.crear(notaData);
      
      const notaFormateada = formatDateFields(nuevaNota, [], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Nota creada exitosamente',
        data: notaFormateada
      });

    } catch (error) {
      next(error);
    }
  },

  listarNotas: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto'
        });
      }

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

      const notas = await NotaTarea.listarPorTarea(tareaId, usuarioId, usuarioRol);
      
      const notasFormateadas = formatArrayDates(notas, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: notasFormateadas
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

  actualizarNota: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId, notaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      const { contenido, esPrivada } = req.body;

      if (!contenido) {
        return res.status(400).json({
          success: false,
          message: 'El contenido de la nota es requerido'
        });
      }

      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto'
        });
      }

      const [verificacion] = await req.app.locals.db.query(`
        SELECT 1 FROM notas_tarea 
        WHERE ID = ? AND TareaID = ? AND Activo = 1
      `, [notaId, tareaId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Nota no encontrada en esta tarea'
        });
      }

      const notaData = {
        contenido,
        esPrivada: esPrivada ? 1 : 0
      };

      const notaActualizada = await NotaTarea.actualizar(notaId, notaData, usuarioId);
      
      const notaFormateada = formatDateFields(notaActualizada, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Nota actualizada exitosamente',
        data: notaFormateada
      });

    } catch (error) {
      if (error.message.includes('Solo el creador')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  },

  eliminarNota: async (req, res, next) => {
    try {
      const { id: proyectoId, tareaId, notaId } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;

      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto'
        });
      }

      const [verificacion] = await req.app.locals.db.query(`
        SELECT 1 FROM notas_tarea 
        WHERE ID = ? AND TareaID = ? AND Activo = 1
      `, [notaId, tareaId]);

      if (verificacion.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Nota no encontrada en esta tarea'
        });
      }

      const resultado = await NotaTarea.eliminar(notaId, usuarioId);

      res.status(200).json({
        success: true,
        message: 'Nota eliminada exitosamente',
        data: resultado
      });

    } catch (error) {
      if (error.message.includes('Solo el creador')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }
};

module.exports = notaTareaController;
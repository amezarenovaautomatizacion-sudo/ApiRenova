const Incidencia = require('../models/incidenciaModel');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const incidenciaController = {
  crearIncidencia: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      if (!['admin', 'manager'].includes(usuarioRol)) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden crear incidencias'
        });
      }

      const {
        empleadoId,
        tipoIncidenciaId,
        descripcion,
        fechaIncidencia,
        horaIncidencia,
        observaciones
      } = req.body;
      
      const camposRequeridos = ['empleadoId', 'tipoIncidenciaId', 'descripcion', 'fechaIncidencia'];
      const faltantes = camposRequeridos.filter(campo => !req.body[campo]);
      
      if (faltantes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Campos requeridos faltantes: ${faltantes.join(', ')}`
        });
      }
      
      const fechaIncidenciaDate = new Date(fechaIncidencia);
      if (isNaN(fechaIncidenciaDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido'
        });
      }
      
      if (horaIncidencia) {
        const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horaRegex.test(horaIncidencia)) {
          return res.status(400).json({
            success: false,
            message: 'Formato de hora inválido. Use HH:MM'
          });
        }
      }
      
      if (usuarioRol === 'manager') {
        const esJefe = await Incidencia.esJefeDeEmpleado(usuarioId, empleadoId);
        
        if (!esJefe) {
          return res.status(403).json({
            success: false,
            message: 'Solo puedes crear incidencias para tus subordinados directos o indirectos'
          });
        }
      }
      
      const incidenciaData = {
        empleadoId,
        tipoIncidenciaId,
        descripcion,
        fechaIncidencia: fechaIncidenciaDate.toISOString().split('T')[0],
        horaIncidencia: horaIncidencia || null,
        observaciones: observaciones || null,
        creadoPor: usuarioId
      };
      
      const nuevaIncidencia = await Incidencia.create(incidenciaData);
      
      const incidenciaFormateada = formatDateFields(nuevaIncidencia, ['FechaIncidencia'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Incidencia creada exitosamente',
        data: incidenciaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerIncidencias: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      const {
        empleadoId,
        tipoIncidenciaId,
        fechaDesde,
        fechaHasta,
        page = 1,
        limit = 10
      } = req.query;
      
      const filtros = {};
      
      if (empleadoId) filtros.empleadoId = empleadoId;
      if (tipoIncidenciaId) filtros.tipoIncidenciaId = tipoIncidenciaId;
      if (fechaDesde) filtros.fechaDesde = fechaDesde;
      if (fechaHasta) filtros.fechaHasta = fechaHasta;
      
      if (usuarioRol === 'employee') {
        const [empleado] = await req.app.locals.db.query(
          'SELECT ID FROM empleados WHERE UsuarioID = ?',
          [usuarioId]
        );
        
        if (empleado.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No se encontró información del empleado'
          });
        }
        
        filtros.empleadoId = empleado[0].ID;
      }
      
      const offset = (page - 1) * limit;
      filtros.limit = parseInt(limit);
      filtros.offset = offset;
      
      const [incidencias, total] = await Promise.all([
        Incidencia.findAll(filtros),
        Incidencia.count(filtros)
      ]);
      
      let incidenciasFiltradas = incidencias;
      if (usuarioRol === 'manager') {
        const empleadosSupervisados = await incidenciaController._obtenerEmpleadosSupervisadosIds(usuarioId);
        incidenciasFiltradas = incidencias.filter(inc => 
          empleadosSupervisados.includes(inc.EmpleadoID) || inc.CreadoPor === usuarioId
        );
      }
      
      const incidenciasFormateadas = formatArrayDates(incidenciasFiltradas, ['FechaIncidencia'], ['createdAt', 'updatedAt']);
      
      res.status(200).json({
        success: true,
        data: {
          incidencias: incidenciasFormateadas,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: incidenciasFormateadas.length,
            totalPages: Math.ceil(incidenciasFormateadas.length / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerIncidencia: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      const incidencia = await Incidencia.findById(id);
      
      if (!incidencia) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      let tieneAcceso = false;
      
      if (usuarioRol === 'admin') {
        tieneAcceso = true;
      } else if (usuarioRol === 'manager') {
        const esJefe = await Incidencia.esJefeDeEmpleado(usuarioId, incidencia.EmpleadoID);
        const laCreo = incidencia.CreadoPor === usuarioId;
        tieneAcceso = esJefe || laCreo;
      } else if (usuarioRol === 'employee') {
        const [empleado] = await req.app.locals.db.query(
          'SELECT ID FROM empleados WHERE UsuarioID = ?',
          [usuarioId]
        );
        
        if (empleado.length > 0) {
          tieneAcceso = incidencia.EmpleadoID === empleado[0].ID;
        }
      }
      
      if (!tieneAcceso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver esta incidencia'
        });
      }
      
      const incidenciaFormateada = formatDateFields(incidencia, ['FechaIncidencia'], ['createdAt', 'updatedAt']);
      
      res.status(200).json({
        success: true,
        data: incidenciaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  actualizarIncidencia: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      if (usuarioRol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden actualizar incidencias'
        });
      }

      const { id } = req.params;
      const {
        tipoIncidenciaId,
        descripcion,
        fechaIncidencia,
        horaIncidencia,
        observaciones
      } = req.body;
      
      const incidenciaExistente = await Incidencia.findById(id);
      
      if (!incidenciaExistente) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      let fechaIncidenciaDate = null;
      if (fechaIncidencia) {
        fechaIncidenciaDate = new Date(fechaIncidencia);
        if (isNaN(fechaIncidenciaDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Formato de fecha inválido'
          });
        }
      }
      
      if (horaIncidencia && horaIncidencia !== '') {
        const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horaRegex.test(horaIncidencia)) {
          return res.status(400).json({
            success: false,
            message: 'Formato de hora inválido. Use HH:MM'
          });
        }
      }
      
      const incidenciaData = {
        tipoIncidenciaId: tipoIncidenciaId || incidenciaExistente.TipoIncidenciaID,
        descripcion: descripcion || incidenciaExistente.Descripcion,
        fechaIncidencia: fechaIncidenciaDate 
          ? fechaIncidenciaDate.toISOString().split('T')[0]
          : incidenciaExistente.FechaIncidencia,
        horaIncidencia: horaIncidencia !== undefined ? horaIncidencia : incidenciaExistente.HoraIncidencia,
        observaciones: observaciones !== undefined ? observaciones : incidenciaExistente.Observaciones
      };
      
      const actualizado = await Incidencia.update(id, incidenciaData);
      
      if (!actualizado) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo actualizar la incidencia'
        });
      }
      
      const incidenciaActualizada = await Incidencia.findById(id);
      const incidenciaFormateada = formatDateFields(incidenciaActualizada, ['FechaIncidencia'], ['createdAt', 'updatedAt']);
      
      res.status(200).json({
        success: true,
        message: 'Incidencia actualizada exitosamente',
        data: incidenciaFormateada
      });
    } catch (error) {
      next(error);
    }
  },

  toggleActivoIncidencia: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      if (usuarioRol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden cambiar el estado de incidencias'
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
      
      const incidenciaExistente = await Incidencia.findById(id);
      
      if (!incidenciaExistente) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      const actualizado = await Incidencia.toggleActive(id, activo);
      
      if (!actualizado) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo cambiar el estado de la incidencia'
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Incidencia ${activo ? 'activada' : 'desactivada'} exitosamente`
      });
    } catch (error) {
      next(error);
    }
  },

  obtenerEmpleadosSupervisados: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      if (!['admin', 'manager'].includes(usuarioRol)) {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden ver empleados supervisados'
        });
      }
      
      let empleados = [];
      
      if (usuarioRol === 'admin') {
        const [rows] = await req.app.locals.db.query(
          `SELECT e.ID, e.NombreCompleto, e.CorreoElectronico, e.RolApp, p.Nombre as PuestoNombre
           FROM empleados e
           JOIN usuarios u ON e.UsuarioID = u.ID
           LEFT JOIN puestos p ON e.PuestoID = p.ID
           WHERE u.Activo = TRUE
           ORDER BY e.NombreCompleto`
        );
        empleados = rows;
      } else {
        const [managerEmpleado] = await req.app.locals.db.query(
          'SELECT ID, NombreCompleto FROM empleados WHERE UsuarioID = ?',
          [usuarioId]
        );
        
        if (managerEmpleado.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No se encontró información del manager'
          });
        }
        
        const managerEmpleadoId = managerEmpleado[0].ID;
        
        const obtenerSubordinadosRecursivo = async (jefeId, nivel = 0) => {
          const [subordinados] = await req.app.locals.db.query(
            `SELECT 
              e.ID, 
              e.NombreCompleto, 
              e.CorreoElectronico, 
              e.RolApp,
              p.Nombre as PuestoNombre,
              ej.createdAt as FechaAsignacion
             FROM empleados e
             JOIN EmpleadoJefes ej ON e.ID = ej.EmpleadoID
             LEFT JOIN Puestos p ON e.PuestoID = p.ID
             WHERE ej.JefeID = ?
             ORDER BY e.NombreCompleto`,
            [jefeId]
          );
          
          let todosSubordinados = [...subordinados];
          
          for (const sub of subordinados) {
            const subSubordinados = await obtenerSubordinadosRecursivo(sub.ID, nivel + 1);
            todosSubordinados = [...todosSubordinados, ...subSubordinados];
          }
          
          return todosSubordinados;
        };
        
        const todosSubordinados = await obtenerSubordinadosRecursivo(managerEmpleadoId);
        
        const empleadosUnicos = [];
        const idsVistos = new Set();
        
        for (const emp of todosSubordinados) {
          if (!idsVistos.has(emp.ID)) {
            idsVistos.add(emp.ID);
            emp.Nivel = 'Subordinado';
            empleadosUnicos.push(emp);
          }
        }
        
        empleados = empleadosUnicos;
      }
      
      const empleadosFormateados = formatArrayDates(empleados, ['FechaAsignacion'], ['createdAt']);
      
      res.status(200).json({
        success: true,
        data: empleadosFormateados
      });
      
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener empleados supervisados'
      });
    }
  },

  obtenerMisIncidencias: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró información del empleado'
        });
      }
      
      const empleadoId = empleado[0].ID;
      
      const incidencias = await Incidencia.findByEmpleadoId(empleadoId);
      
      const incidenciasFormateadas = formatArrayDates(incidencias, ['FechaIncidencia'], ['createdAt', 'updatedAt']);
      
      if (incidenciasFormateadas.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No tienes incidencias registradas',
          data: []
        });
      }
      
      res.status(200).json({
        success: true,
        data: incidenciasFormateadas
      });
    } catch (error) {
      next(error);
    }
  },

  _obtenerEmpleadosSupervisadosIds: async (usuarioId) => {
    try {
      const empleados = await incidenciaController._obtenerEmpleadosSupervisados(usuarioId);
      return empleados.map(emp => emp.ID);
    } catch (error) {
      return [];
    }
  },
  
  _obtenerEmpleadosSupervisados: async (usuarioId) => {
    try {
      const [managerEmpleado] = await pool.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (managerEmpleado.length === 0) {
        return [];
      }
      
      const managerEmpleadoId = managerEmpleado[0].ID;
      
      const todosSubordinados = [];
      const procesados = new Set();
      
      const obtenerSubordinadosRecursivo = async (jefeId) => {
        if (procesados.has(jefeId)) return;
        procesados.add(jefeId);
        
        const [subordinados] = await pool.query(
          `SELECT e.ID, e.NombreCompleto, e.CorreoElectronico, e.RolApp
           FROM empleados e
           JOIN EmpleadoJefes ej ON e.ID = ej.EmpleadoID
           WHERE ej.JefeID = ?`,
          [jefeId]
        );
        
        for (const sub of subordinados) {
          if (!todosSubordinados.some(s => s.ID === sub.ID)) {
            todosSubordinados.push(sub);
            await obtenerSubordinadosRecursivo(sub.ID);
          }
        }
      };
      
      await obtenerSubordinadosRecursivo(managerEmpleadoId);
      
      return todosSubordinados;
    } catch (error) {
      return [];
    }
  }
};

module.exports = incidenciaController;
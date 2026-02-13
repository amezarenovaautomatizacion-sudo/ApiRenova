const Incidencia = require('../models/incidenciaModel');

const incidenciaController = {
  // Crear nueva incidencia (admin y manager)
  crearIncidencia: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      // Solo admin y manager pueden crear incidencias
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
      
      // Validar campos requeridos
      const camposRequeridos = ['empleadoId', 'tipoIncidenciaId', 'descripcion', 'fechaIncidencia'];
      const faltantes = camposRequeridos.filter(campo => !req.body[campo]);
      
      if (faltantes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Campos requeridos faltantes: ${faltantes.join(', ')}`
        });
      }
      
      // Validar formato de fecha
      const fechaIncidenciaDate = new Date(fechaIncidencia);
      if (isNaN(fechaIncidenciaDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido'
        });
      }
      
      // Validar formato de hora si se proporciona
      if (horaIncidencia) {
        const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horaRegex.test(horaIncidencia)) {
          return res.status(400).json({
            success: false,
            message: 'Formato de hora inválido. Use HH:MM'
          });
        }
      }
      
      // Si es manager, verificar que el empleado sea su subordinado (directo o indirecto)
      if (usuarioRol === 'manager') {
        const esJefe = await Incidencia.esJefeDeEmpleado(usuarioId, empleadoId);
        
        if (!esJefe) {
          return res.status(403).json({
            success: false,
            message: 'Solo puedes crear incidencias para tus subordinados directos o indirectos'
          });
        }
      }
      
      // Crear la incidencia
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
      
      res.status(201).json({
        success: true,
        message: 'Incidencia creada exitosamente',
        data: nuevaIncidencia
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener incidencias (con filtros según rol)
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
      
      // Construir filtros
      const filtros = {};
      
      if (empleadoId) filtros.empleadoId = empleadoId;
      if (tipoIncidenciaId) filtros.tipoIncidenciaId = tipoIncidenciaId;
      if (fechaDesde) filtros.fechaDesde = fechaDesde;
      if (fechaHasta) filtros.fechaHasta = fechaHasta;
      
      // Si es employee, solo puede ver sus propias incidencias
      if (usuarioRol === 'employee') {
        // Obtener el EmpleadoID del usuario
        const [empleado] = await req.app.locals.db.query(
          'SELECT ID FROM Empleados WHERE UsuarioID = ?',
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
      
      // Si es manager, puede filtrar por sus subordinados
      if (usuarioRol === 'manager' && !empleadoId) {
        // Si no especifica empleado, manager ve todos sus subordinados
        const empleadosSupervisados = await incidenciaController._obtenerEmpleadosSupervisadosIds(usuarioId);
        if (empleadosSupervisados.length > 0) {
          // MySQL no soporta arrays directamente, necesitamos construir la query
          // En lugar de filtro, manejaremos en la lógica del modelo o cliente
        }
      }
      
      // Calcular offset para paginación
      const offset = (page - 1) * limit;
      filtros.limit = parseInt(limit);
      filtros.offset = offset;
      
      // Obtener incidencias y total
      const [incidencias, total] = await Promise.all([
        Incidencia.findAll(filtros),
        Incidencia.count(filtros)
      ]);
      
      // Filtrar por subordinados si es manager
      let incidenciasFiltradas = incidencias;
      if (usuarioRol === 'manager') {
        const empleadosSupervisados = await incidenciaController._obtenerEmpleadosSupervisadosIds(usuarioId);
        incidenciasFiltradas = incidencias.filter(inc => 
          empleadosSupervisados.includes(inc.EmpleadoID) || inc.CreadoPor === usuarioId
        );
      }
      
      res.status(200).json({
        success: true,
        data: {
          incidencias: incidenciasFiltradas,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: incidenciasFiltradas.length,
            totalPages: Math.ceil(incidenciasFiltradas.length / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Obtener incidencia por ID (con validación de acceso)
  obtenerIncidencia: async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      // Obtener la incidencia
      const incidencia = await Incidencia.findById(id);
      
      if (!incidencia) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      // Verificar permisos de acceso
      let tieneAcceso = false;
      
      if (usuarioRol === 'admin') {
        tieneAcceso = true;
      } else if (usuarioRol === 'manager') {
        // Manager puede ver si es su subordinado o si la creó
        const esJefe = await Incidencia.esJefeDeEmpleado(usuarioId, incidencia.EmpleadoID);
        const laCreo = incidencia.CreadoPor === usuarioId;
        tieneAcceso = esJefe || laCreo;
      } else if (usuarioRol === 'employee') {
        // Employee solo puede ver las suyas propias
        const [empleado] = await req.app.locals.db.query(
          'SELECT ID FROM Empleados WHERE UsuarioID = ?',
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
      
      res.status(200).json({
        success: true,
        data: incidencia
      });
    } catch (error) {
      next(error);
    }
  },

  // Actualizar incidencia (solo admin)
  actualizarIncidencia: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      // Solo admin puede actualizar incidencias
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
      
      // Verificar que la incidencia existe
      const incidenciaExistente = await Incidencia.findById(id);
      
      if (!incidenciaExistente) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      // Validar formato de fecha si se proporciona
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
      
      // Validar formato de hora si se proporciona
      if (horaIncidencia && horaIncidencia !== '') {
        const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!horaRegex.test(horaIncidencia)) {
          return res.status(400).json({
            success: false,
            message: 'Formato de hora inválido. Use HH:MM'
          });
        }
      }
      
      // Preparar datos para actualizar
      const incidenciaData = {
        tipoIncidenciaId: tipoIncidenciaId || incidenciaExistente.TipoIncidenciaID,
        descripcion: descripcion || incidenciaExistente.Descripcion,
        fechaIncidencia: fechaIncidenciaDate 
          ? fechaIncidenciaDate.toISOString().split('T')[0]
          : incidenciaExistente.FechaIncidencia,
        horaIncidencia: horaIncidencia !== undefined ? horaIncidencia : incidenciaExistente.HoraIncidencia,
        observaciones: observaciones !== undefined ? observaciones : incidenciaExistente.Observaciones
      };
      
      // Actualizar la incidencia
      const actualizado = await Incidencia.update(id, incidenciaData);
      
      if (!actualizado) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo actualizar la incidencia'
        });
      }
      
      // Obtener la incidencia actualizada
      const incidenciaActualizada = await Incidencia.findById(id);
      
      res.status(200).json({
        success: true,
        message: 'Incidencia actualizada exitosamente',
        data: incidenciaActualizada
      });
    } catch (error) {
      next(error);
    }
  },

  // Activar/desactivar incidencia (solo admin)
  toggleActivoIncidencia: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      // Solo admin puede cambiar estado
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
      
      // Verificar que la incidencia existe
      const incidenciaExistente = await Incidencia.findById(id);
      
      if (!incidenciaExistente) {
        return res.status(404).json({
          success: false,
          message: 'Incidencia no encontrada'
        });
      }
      
      // Cambiar estado
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

  // Obtener empleados que puede supervisar (para manager)
  obtenerEmpleadosSupervisados: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      console.log(`\n🎯 [obtenerEmpleadosSupervisados] INICIANDO...`);
      console.log(`   UsuarioID: ${usuarioId}`);
      console.log(`   Rol: ${usuarioRol}`);
      
      // Solo manager y admin pueden usar este endpoint
      if (!['admin', 'manager'].includes(usuarioRol)) {
        console.log('❌ Usuario no autorizado');
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y managers pueden ver empleados supervisados'
        });
      }
      
      let empleados = [];
      
      if (usuarioRol === 'admin') {
        // Admin puede ver todos los empleados
        console.log('👑 Admin: obteniendo todos los empleados');
        const [rows] = await req.app.locals.db.query(
          `SELECT e.ID, e.NombreCompleto, e.CorreoElectronico, e.RolApp, p.Nombre as PuestoNombre
           FROM Empleados e
           JOIN Usuarios u ON e.UsuarioID = u.ID
           LEFT JOIN Puestos p ON e.PuestoID = p.ID
           WHERE u.Activo = TRUE
           ORDER BY e.NombreCompleto`
        );
        empleados = rows;
        console.log(`📊 Admin - Empleados encontrados: ${empleados.length}`);
      } else {
        // Manager: obtener su EmpleadoID primero
        console.log('👨‍💼 Manager: obteniendo subordinados');
        
        const [managerEmpleado] = await req.app.locals.db.query(
          'SELECT ID, NombreCompleto FROM Empleados WHERE UsuarioID = ?',
          [usuarioId]
        );
        
        console.log(`🔍 Manager empleado:`, managerEmpleado);
        
        if (managerEmpleado.length === 0) {
          console.log('❌ No se encontró información del manager');
          return res.status(404).json({
            success: false,
            message: 'No se encontró información del manager'
          });
        }
        
        const managerEmpleadoId = managerEmpleado[0].ID;
        const managerNombre = managerEmpleado[0].NombreCompleto;
        
        console.log(`🔍 Manager EmpleadoID: ${managerEmpleadoId} (${managerNombre})`);
        
        // Función recursiva para obtener subordinados
        const obtenerSubordinadosRecursivo = async (jefeId, nivel = 0) => {
          const indent = '  '.repeat(nivel);
          console.log(`${indent}🔍 Nivel ${nivel}: buscando subordinados de jefe ID ${jefeId}`);
          
          const [subordinados] = await req.app.locals.db.query(
            `SELECT 
              e.ID, 
              e.NombreCompleto, 
              e.CorreoElectronico, 
              e.RolApp,
              p.Nombre as PuestoNombre,
              ej.createdAt as FechaAsignacion
             FROM Empleados e
             JOIN EmpleadoJefes ej ON e.ID = ej.EmpleadoID
             LEFT JOIN Puestos p ON e.PuestoID = p.ID
             WHERE ej.JefeID = ?
             ORDER BY e.NombreCompleto`,
            [jefeId]
          );
          
          console.log(`${indent}📊 Subordinados encontrados: ${subordinados.length}`);
          
          let todosSubordinados = [...subordinados];
          
          // Recursivamente obtener subordinados de estos subordinados
          for (const sub of subordinados) {
            console.log(`${indent}  👤 ${sub.NombreCompleto} (ID: ${sub.ID})`);
            const subSubordinados = await obtenerSubordinadosRecursivo(sub.ID, nivel + 1);
            todosSubordinados = [...todosSubordinados, ...subSubordinados];
          }
          
          return todosSubordinados;
        };
        
        // Obtener todos los subordinados (directos e indirectos)
        const todosSubordinados = await obtenerSubordinadosRecursivo(managerEmpleadoId);
        
        console.log(`📊 Total subordinados (todos niveles): ${todosSubordinados.length}`);
        
        // Eliminar duplicados
        const empleadosUnicos = [];
        const idsVistos = new Set();
        
        for (const emp of todosSubordinados) {
          if (!idsVistos.has(emp.ID)) {
            idsVistos.add(emp.ID);
            // Agregar información de nivel (opcional)
            emp.Nivel = 'Subordinado';
            empleadosUnicos.push(emp);
          }
        }
        
        empleados = empleadosUnicos;
        console.log(`📊 Empleados únicos después de eliminar duplicados: ${empleados.length}`);
      }
      
      console.log(`🎯 [obtenerEmpleadosSupervisados] FINALIZADO - Total: ${empleados.length} empleados\n`);
      
      res.status(200).json({
        success: true,
        data: empleados
      });
      
    } catch (error) {
      console.error('❌ ERROR en obtenerEmpleadosSupervisados:', error);
      console.error('Stack:', error.stack);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor al obtener empleados supervisados'
      });
    }
  },

  // Obtener mis incidencias (para employee) - CORREGIDO
  obtenerMisIncidencias: async (req, res, next) => {
    try {
      const usuarioId = req.user.id;
      const usuarioRol = req.user.rol;
      
      console.log(`🔍 [obtenerMisIncidencias] UsuarioID: ${usuarioId}, Rol: ${usuarioRol}`);
      
      // Obtener el EmpleadoID del usuario
      const [empleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      console.log(`🔍 [obtenerMisIncidencias] Empleado encontrado:`, empleado);
      
      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No se encontró información del empleado'
        });
      }
      
      const empleadoId = empleado[0].ID;
      console.log(`🔍 [obtenerMisIncidencias] EmpleadoID: ${empleadoId}`);
      
      // Obtener incidencias del empleado
      const incidencias = await Incidencia.findByEmpleadoId(empleadoId);
      console.log(`🔍 [obtenerMisIncidencias] Incidencias encontradas: ${incidencias.length}`);
      
      if (incidencias.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No tienes incidencias registradas',
          data: []
        });
      }
      
      res.status(200).json({
        success: true,
        data: incidencias
      });
    } catch (error) {
      console.error('❌ Error en obtenerMisIncidencias:', error);
      next(error);
    }
  },

  // ===== FUNCIONES PRIVADAS DE AYUDA =====
  
  // Obtener IDs de empleados supervisados
  _obtenerEmpleadosSupervisadosIds: async (usuarioId) => {
    try {
      const empleados = await incidenciaController._obtenerEmpleadosSupervisados(usuarioId);
      return empleados.map(emp => emp.ID);
    } catch (error) {
      console.error('Error en _obtenerEmpleadosSupervisadosIds:', error);
      return [];
    }
  },
  
  // Obtener empleados supervisados con información completa
  _obtenerEmpleadosSupervisados: async (usuarioId) => {
    try {
      // Buscar el EmpleadoID del manager
      const [managerEmpleado] = await req.app.locals.db.query(
        'SELECT ID FROM Empleados WHERE UsuarioID = ?',
        [usuarioId]
      );
      
      if (managerEmpleado.length === 0) {
        return [];
      }
      
      const managerEmpleadoId = managerEmpleado[0].ID;
      
      // Obtener todos los subordinados (recursivo)
      const todosSubordinados = [];
      const procesados = new Set();
      
      const obtenerSubordinadosRecursivo = async (jefeId) => {
        if (procesados.has(jefeId)) return;
        procesados.add(jefeId);
        
        const [subordinados] = await req.app.locals.db.query(
          `SELECT e.ID, e.NombreCompleto, e.CorreoElectronico, e.RolApp
           FROM Empleados e
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
      console.error('Error en _obtenerEmpleadosSupervisados:', error);
      return [];
    }
  }
};

module.exports = incidenciaController;
// middleware/autorizacion.js
const Permiso = require('../models/permisoModel');

/**
 * Middleware para verificar permisos por endpoint y método
 * @param {string} endpoint - Ruta del endpoint (ej: '/api/proyectos/:id/tareas/:tareaId/reasignar')
 * @param {string} metodo - Método HTTP (GET, POST, PUT, PATCH, DELETE)
 * @returns {Function} Middleware de autorización
 */
const autorizar = (endpoint, metodo) => {
  return async (req, res, next) => {
    try {
      // Validar autenticación
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Verificar permiso en base de datos
      const tienePermiso = await Permiso.verificarPermiso(
        req.user.id, 
        endpoint, 
        metodo
      );

      if (!tienePermiso) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acción'
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error en middleware de autorización:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware para verificar permisos por rol específico
 * @param {...string} rolesPermitidos - Roles permitidos (admin, manager, employee)
 * @returns {Function} Middleware de autorización por rol
 */
const autorizarPorRol = (...rolesPermitidos) => {
  return async (req, res, next) => {
    try {
      // Validar autenticación
      if (!req.user || !req.user.rol) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Si se pasa un array como primer parámetro, aplanarlo
      let rolesArray = rolesPermitidos;
      if (rolesPermitidos.length === 1 && Array.isArray(rolesPermitidos[0])) {
        rolesArray = rolesPermitidos[0];
      }

      // Verificar rol
      if (!rolesArray.includes(req.user.rol)) {
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. Requiere uno de estos roles: ${rolesArray.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error en middleware de autorización por rol:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * MÓDULO DE PERMISOS PREDEFINIDOS
 * Estas constantes deben ser insertadas en la base de datos
 * en la tabla 'permisos' para que funcionen con el middleware autorizar()
 */

// ============================================
// PERMISOS PARA PROYECTOS
// ============================================

const PERMISOS_PROYECTOS = [
  // CRUD Proyectos
  { endpoint: '/api/proyectos', metodo: 'POST', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id', metodo: 'PUT', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id', metodo: 'DELETE', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id/estado', metodo: 'PATCH', roles: ['admin', 'manager'] },
  
  // Consultas especiales
  { endpoint: '/api/proyectos/mis-proyectos', metodo: 'GET', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/asignados', metodo: 'GET', roles: ['employee'] },
];

// ============================================
// PERMISOS PARA GESTIÓN DE EMPLEADOS EN PROYECTOS
// ============================================

const PERMISOS_EMPLEADOS_PROYECTO = [
  // Asignar/Quitar empleados
  { endpoint: '/api/proyectos/:id/empleados', metodo: 'POST', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id/empleados/:empleadoId', metodo: 'DELETE', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id/empleados', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  
  // Empleados disponibles (DOS MODOS)
  { endpoint: '/api/proyectos/:id/empleados/disponibles', metodo: 'GET', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id/empleados/buscar', metodo: 'GET', roles: ['admin', 'manager'] },
];

// ============================================
// PERMISOS PARA TAREAS
// ============================================

const PERMISOS_TAREAS = [
  // CRUD Tareas
  { endpoint: '/api/proyectos/:id/tareas', metodo: 'POST', roles: ['admin', 'manager'] },
  { endpoint: '/api/proyectos/:id/tareas', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id/tareas/:tareaId', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  
  // ✅ ACTUALIZAR TAREA - Admin, Jefe, Asignado, Tarea sin asignar
  { endpoint: '/api/proyectos/:id/tareas/:tareaId', metodo: 'PUT', roles: ['admin', 'manager', 'employee'] },
  
  // ✅ CAMBIAR ESTADO - Admin, Jefe, Asignado, Tarea sin asignar
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/estado', metodo: 'PATCH', roles: ['admin', 'manager', 'employee'] },
  
  // ✅ ELIMINAR TAREA - Solo Admin y Jefe
  { endpoint: '/api/proyectos/:id/tareas/:tareaId', metodo: 'DELETE', roles: ['admin', 'manager'] },
];

// ============================================
// PERMISOS PARA ASIGNACIÓN DE TAREAS
// ============================================

const PERMISOS_ASIGNACION_TAREAS = [
  // ✅ REASIGNAR TAREA - Solo Admin y Jefe
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/reasignar', metodo: 'PATCH', roles: ['admin', 'manager'] },
  
  // ✅ ASIGNAR TAREA - Solo Admin y Jefe
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/asignar', metodo: 'POST', roles: ['admin', 'manager'] },
  
  // ✅ DESASIGNAR TAREA - Solo Admin y Jefe
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/desasignar', metodo: 'DELETE', roles: ['admin', 'manager'] },
  
  // ✅ QUITAR ASIGNACIÓN ESPECÍFICA - Solo Admin y Jefe
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/asignaciones/:asignacionId', metodo: 'DELETE', roles: ['admin', 'manager'] },
];

// ============================================
// PERMISOS PARA NOTAS EN TAREAS
// ============================================

const PERMISOS_NOTAS = [
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/notas', metodo: 'POST', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/notas', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/notas/:notaId', metodo: 'PUT', roles: ['admin', 'manager', 'employee'] },
  { endpoint: '/api/proyectos/:id/tareas/:tareaId/notas/:notaId', metodo: 'DELETE', roles: ['admin', 'manager', 'employee'] },
];

// ============================================
// PERMISOS PARA HISTORIAL
// ============================================

const PERMISOS_HISTORIAL = [
  { endpoint: '/api/proyectos/:id/historial', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
];

// ============================================
// AGRUPAR TODOS LOS PERMISOS
// ============================================

const TODOS_LOS_PERMISOS = [
  ...PERMISOS_PROYECTOS,
  ...PERMISOS_EMPLEADOS_PROYECTO,
  ...PERMISOS_TAREAS,
  ...PERMISOS_ASIGNACION_TAREAS,
  ...PERMISOS_NOTAS,
  ...PERMISOS_HISTORIAL
];

// ============================================
// FUNCIÓN PARA INSERTAR PERMISOS EN BASE DE DATOS
// ============================================

/**
 * Función para insertar todos los permisos en la base de datos
 * Ejecutar una sola vez al iniciar la aplicación o mediante un script
 */
const insertarPermisosPorDefecto = async (pool) => {
  try {
    console.log('🔄 Insertando permisos por defecto...');
    
    for (const permiso of TODOS_LOS_PERMISOS) {
      // Verificar si ya existe
      const [existente] = await pool.query(
        'SELECT ID FROM permisos WHERE Endpoint = ? AND Metodo = ?',
        [permiso.endpoint, permiso.metodo]
      );
      
      if (existente.length === 0) {
        // Insertar permiso
        const [result] = await pool.query(
          'INSERT INTO permisos (Endpoint, Metodo, Descripcion) VALUES (?, ?, ?)',
          [permiso.endpoint, permiso.metodo, `Permiso para ${permiso.metodo} ${permiso.endpoint}`]
        );
        
        const permisoId = result.insertId;
        
        // Asignar roles al permiso
        for (const rol of permiso.roles) {
          // Obtener ID del rol
          const [rolData] = await pool.query(
            'SELECT ID FROM roles WHERE Nombre = ?',
            [rol]
          );
          
          if (rolData.length > 0) {
            await pool.query(
              'INSERT INTO permiso_roles (PermisoID, RolID) VALUES (?, ?)',
              [permisoId, rolData[0].ID]
            );
          }
        }
        
        console.log(`✅ Permiso insertado: ${permiso.metodo} ${permiso.endpoint} - Roles: ${permiso.roles.join(', ')}`);
      }
    }
    
    console.log('✅ Todos los permisos insertados correctamente');
  } catch (error) {
    console.error('❌ Error insertando permisos:', error);
  }
};

module.exports = { 
  autorizar, 
  autorizarPorRol,
  PERMISOS_PROYECTOS,
  PERMISOS_EMPLEADOS_PROYECTO,
  PERMISOS_TAREAS,
  PERMISOS_ASIGNACION_TAREAS,
  PERMISOS_NOTAS,
  PERMISOS_HISTORIAL,
  TODOS_LOS_PERMISOS,
  insertarPermisosPorDefecto 
};
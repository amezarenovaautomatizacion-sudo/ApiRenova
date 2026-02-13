const express = require('express');
const cors = require('cors');
const { pool } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const empleadoRoutes = require('./routes/empleadoRoutes');
const aprobadorRoutes = require('./routes/aprobadorRoutes');
const incidenciaRoutes = require('./routes/incidenciaRoutes');
const solicitudesRoutes = require('./routes/solicitudesRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Agregar pool de base de datos a app.locals
app.locals.db = pool;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenido a RENOVA API',
    version: '2.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login (pública)',
        register: 'POST /api/auth/register (pública)',
        profile: 'GET /api/auth/profile (autenticado)',
        verify: 'GET /api/auth/verify (autenticado)'
      },
      empleados: {
        catalogos: 'GET /api/empleados/catalogos (autenticado con permisos)',
        listar: 'GET /api/empleados/empleados (autenticado con permisos)',
        crear: 'POST /api/empleados/empleados (admin/manager con permisos)',
        obtener: 'GET /api/empleados/empleados/:id (autenticado con permisos)',
        actualizar: 'PUT /api/empleados/empleados/:id (autenticado con permisos)',
        datosSensibles: 'GET /api/empleados/empleados/:id/sensible (solo admin)',
        todosSensibles: 'GET /api/empleados/sensibles (solo admin)',
        misPermisos: 'GET /api/empleados/mis-permisos (autenticado)',
        roles: 'GET /api/empleados/roles (autenticado con permisos)'
      },
      aprobadores: {
        agregar: 'POST /api/aprobadores/agregar (solo admin)',
        quitar: 'DELETE /api/aprobadores/quitar/:usuarioId (solo admin)',
        activos: 'GET /api/aprobadores/activos (autenticado)',
        verificar: 'GET /api/aprobadores/verificar/:usuarioId (autenticado)'
      },
      incidencias: {
        tipos: {
          listar: 'GET /api/incidencias/tipos (autenticado)',
          listarTodos: 'GET /api/incidencias/tipos/todos (solo admin)',
          obtener: 'GET /api/incidencias/tipos/:id (autenticado)',
          crear: 'POST /api/incidencias/tipos (solo admin)',
          actualizar: 'PUT /api/incidencias/tipos/:id (solo admin)',
          cambiarEstado: 'PATCH /api/incidencias/tipos/:id/estado (solo admin)'
        },
        incidencias: {
          crear: 'POST /api/incidencias (admin/manager)',
          listar: 'GET /api/incidencias (autenticado, con filtros según rol)',
          obtener: 'GET /api/incidencias/:id (autenticado)',
          actualizar: 'PUT /api/incidencias/:id (solo admin)',
          cambiarEstado: 'PATCH /api/incidencias/:id/estado (solo admin)',
          empleadosSupervisados: 'GET /api/incidencias/empleados/supervisados (admin/manager)',
          misIncidencias: 'GET /api/incidencias/mis-incidencias (autenticado)'
        }
      },
      solicitudes: {
        vacaciones: {
            derechos: 'GET /api/solicitudes/vacaciones/derechos (autenticado)',
            solicitar: 'POST /api/solicitudes/vacaciones/solicitar (autenticado)'
        },
        permisos: {
            solicitar: 'POST /api/solicitudes/permisos/solicitar (autenticado)',
            pendientes: 'GET /api/solicitudes/permisos/pendientes (admin/manager)'
        },
        horasExtras: {
            solicitar: 'POST /api/solicitudes/horas-extras/solicitar (admin/manager)',
            reporte: 'GET /api/solicitudes/horas-extras/reporte (admin/manager)'
        },
        aprobaciones: {
            pendientes: 'GET /api/solicitudes/aprobaciones/pendientes (admin/manager)',
            procesar: 'PATCH /api/solicitudes/aprobaciones/:aprobacionId/procesar (admin/manager)',
            editar: 'PATCH /api/solicitudes/aprobaciones/:aprobacionId/editar (admin/manager)'
        },
        misSolicitudes: {
            todas: 'GET /api/solicitudes/mis-solicitudes (autenticado)',
            aprobadas: 'GET /api/solicitudes/mis-solicitudes/aprobadas (autenticado)',
            porEstado: 'GET /api/solicitudes/estado/:estado (autenticado)'
        },
        adminManager: {
            todasAprobadas: 'GET /api/solicitudes/aprobadas (admin/manager)',
            detalle: 'GET /api/solicitudes/detalle/:solicitudId (autenticado)'
        },
        cancelar: 'PATCH /api/solicitudes/:solicitudId/cancelar (dueño de solicitud o admin/manager)'
      },
      notificaciones: {
        personales: {
          obtener: 'GET /api/notificaciones/personales (autenticado)',
          resumen: 'GET /api/notificaciones/resumen (autenticado)',
          marcarVista: 'PATCH /api/notificaciones/personales/:notificacionId/vista (autenticado)',
          marcarLeida: 'PATCH /api/notificaciones/personales/:notificacionId/leida (autenticado)',
          eliminar: 'DELETE /api/notificaciones/personales/:notificacionId (autenticado)',
          marcarTodasVistas: 'PATCH /api/notificaciones/personales/marcar-todas-vistas (autenticado)'
        },
        generales: {
          obtener: 'GET /api/notificaciones/generales (autenticado)',
          marcarVista: 'PATCH /api/notificaciones/generales/:notificacionId/vista (autenticado)',
          crear: 'POST /api/notificaciones/generales (solo admin)'
        },
        configuracion: {
          tipos: 'GET /api/notificaciones/tipos (autenticado)',
          obtenerConfigs: 'GET /api/notificaciones/configuraciones (solo admin)',
          actualizarConfig: 'PUT /api/notificaciones/configuraciones/:id (solo admin)'
        }
      },
      proyectos: {
        // PROYECTOS - CRUD
        crear: 'POST /api/proyectos (admin/manager)',
        listar: 'GET /api/proyectos (autenticado con permisos)',
        obtener: 'GET /api/proyectos/:id (autenticado con permisos)',
        actualizar: 'PUT /api/proyectos/:id (admin/jefe proyecto)',
        cambiarEstado: 'PATCH /api/proyectos/:id/estado (admin/jefe proyecto)',
        eliminar: 'DELETE /api/proyectos/:id (admin/jefe proyecto) - ELIMINACIÓN LÓGICA',
        
        // GESTIÓN DE EMPLEADOS EN PROYECTOS
        empleados: {
          asignar: 'POST /api/proyectos/:id/empleados (admin/jefe proyecto)',
          quitar: 'DELETE /api/proyectos/:id/empleados/:empleadoId (admin/jefe proyecto)',
          listar: 'GET /api/proyectos/:id/empleados (autenticado con permisos) - CON ESTADO "asignado"',
          
          // BÚSQUEDA DE EMPLEADOS DISPONIBLES - DOS MODOS
          disponibles: {
            supervisados: 'GET /api/proyectos/:id/empleados/disponibles?modo=supervisados (jefe proyecto) - SOLO empleados a cargo',
            todos: 'GET /api/proyectos/:id/empleados/disponibles?modo=todos (admin/jefe proyecto) - TODOS los empleados',
            filtros: 'GET /api/proyectos/:id/empleados/disponibles?modo=todos&departamentoId=1&search=juan&incluirAsignados=true'
          },
          
          // BÚSQUEDA AVANZADA DE EMPLEADOS
          buscar: 'GET /api/proyectos/:id/empleados/buscar?page=1&limit=10&search=maria&departamentoId=2&soloNoAsignados=true'
        },
        
        // GESTIÓN DE TAREAS
        tareas: {
          crear: 'POST /api/proyectos/:id/tareas (admin/jefe proyecto) - empleadoId OPCIONAL',
          listar: 'GET /api/proyectos/:id/tareas (autenticado con permisos)',
          listarSinAsignar: 'GET /api/proyectos/:id/tareas?soloSinAsignar=true (autenticado)',
          obtener: 'GET /api/proyectos/:id/tareas/:tareaId (autenticado con permisos)',
          actualizar: 'PUT /api/proyectos/:id/tareas/:tareaId (admin/jefe proyecto/asignado)',
          cambiarEstado: 'PATCH /api/proyectos/:id/tareas/:tareaId/estado (SOLO asignado)',
          eliminar: 'DELETE /api/proyectos/:id/tareas/:tareaId (admin/jefe proyecto) - ELIMINACIÓN LÓGICA',
          
          // ASIGNACIÓN DE TAREAS
          asignar: 'POST /api/proyectos/:id/tareas/:tareaId/asignar (admin/jefe proyecto)',
          reasignar: 'PATCH /api/proyectos/:id/tareas/:tareaId/reasignar (admin/jefe proyecto) - empleadoId null para desasignar',
          desasignar: 'DELETE /api/proyectos/:id/tareas/:tareaId/desasignar (admin/jefe proyecto)',
          quitarAsignacion: 'DELETE /api/proyectos/:id/tareas/:tareaId/asignaciones/:asignacionId (admin/jefe proyecto)'
        },
        
        // NOTAS EN TAREAS
        notas: {
          crear: 'POST /api/proyectos/:id/tareas/:tareaId/notas (autenticado con permisos)',
          listar: 'GET /api/proyectos/:id/tareas/:tareaId/notas (autenticado con permisos)',
          actualizar: 'PUT /api/proyectos/:id/tareas/:tareaId/notas/:notaId (solo creador)',
          eliminar: 'DELETE /api/proyectos/:id/tareas/:tareaId/notas/:notaId (solo creador)'
        },
        
        // CONSULTAS ESPECIALES
        especiales: {
          misProyectos: 'GET /api/proyectos/mis-proyectos (jefe proyecto) - Proyectos que dirijo',
          proyectosAsignados: 'GET /api/proyectos/asignados (empleado) - Proyectos donde soy miembro',
          historial: 'GET /api/proyectos/:id/historial (admin/jefe proyecto)'
        }
      }
    }
  });
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/empleados', empleadoRoutes);
app.use('/api/aprobadores', aprobadorRoutes);
app.use('/api/incidencias', incidenciaRoutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/proyectos', proyectoRoutes);

// Ruta para manejar 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Manejo de errores
app.use(errorHandler);

module.exports = app;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

require('dotenv').config();
const app = express();

// Configuración de seguridad
app.use(helmet());

// Configuración CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
};

app.use(cors(corsOptions));


// Middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    message: 'API de Gestión de Empleados y Vacaciones',
    version: '1.0.0',
    status: 'online',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      empleados: '/api/empleados',
      vacaciones: '/api/vacaciones',
      asistencias: '/api/asistencias',
      proyectos: '/api/proyectos',
      reportes: '/api/reportes',
      dashboard: '/api/dashboard'
    }
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'MySQL',
    environment: process.env.NODE_ENV
  });
});

// Rutas de la API
app.use('/api', require('./routes/index'));

// Documentación básica
app.get('/api-docs', (req, res) => {
  res.json({
    endpoints: {
      'POST /api/auth/login': 'Autenticar usuario',
      'POST /api/auth/register': 'Registrar nuevo usuario',
      'GET /api/auth/profile': 'Obtener perfil del usuario',
      'GET /api/empleados': 'Listar empleados (con paginación)',
      'GET /api/empleados/:id': 'Obtener empleado específico',
      'POST /api/empleados': 'Crear nuevo empleado',
      'PUT /api/empleados/:id': 'Actualizar empleado',
      'DELETE /api/empleados/:id': 'Eliminar empleado (soft delete)',
      'GET /api/vacaciones': 'Listar todas las solicitudes',
      'POST /api/vacaciones': 'Crear solicitud de vacaciones',
      'GET /api/asistencias': 'Registrar/consultar asistencias',
      'GET /api/dashboard': 'Datos para dashboard'
    }
  });
});

// Manejo de 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.url}`,
    suggestion: 'Visita /api-docs para ver los endpoints disponibles'
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  const statusCode = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

if (process.env.NODE_ENV === 'production') {
  require('./utils/cronJobs');
  console.log('Tareas programadas iniciadas');
}

module.exports = app;
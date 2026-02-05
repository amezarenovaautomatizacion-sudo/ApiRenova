// src/routes/index.js
const express = require('express');
const router = express.Router();

// Importar todas las rutas
const authRoutes = require('./auth.routes');
const empleadosRoutes = require('./empleados.routes');
const vacacionesRoutes = require('./vacaciones.routes');
const asistenciasRoutes = require('./asistencias.routes');
const proyectosRoutes = require('./proyectos.routes');
const reportesRoutes = require('./reportes.routes');
const dashboardRoutes = require('./dashboard.routes');

// Nuevas rutas
const administradoresRoutes = require('./administradores.routes');
const horasExtrasRoutes = require('./horas_extras.routes');
const permisosRoutes = require('./permisos.routes');
const vigenciasRoutes = require('./vigencias.routes');
const jefesRoutes = require('./jefes.routes');
const departamentosRoutes = require('./departamentos.routes');

// Montar rutas
router.use('/auth', authRoutes);
router.use('/empleados', empleadosRoutes);
router.use('/vacaciones', vacacionesRoutes);
router.use('/asistencias', asistenciasRoutes);
router.use('/proyectos', proyectosRoutes);
router.use('/reportes', reportesRoutes);
router.use('/dashboard', dashboardRoutes);

// Montar nuevas rutas
router.use('/administradores', administradoresRoutes);
router.use('/horas-extras', horasExtrasRoutes);
router.use('/permisos', permisosRoutes);
router.use('/vigencias', vigenciasRoutes);
router.use('/jefes', jefesRoutes);
router.use('/departamentos', departamentosRoutes);

module.exports = router;
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
const dashboardRoutes = require('./dashboard.routes'); // ← Asegúrate que esta línea existe

// Montar rutas
router.use('/auth', authRoutes);
router.use('/empleados', empleadosRoutes);
router.use('/vacaciones', vacacionesRoutes);
router.use('/asistencias', asistenciasRoutes);
router.use('/proyectos', proyectosRoutes);
router.use('/reportes', reportesRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
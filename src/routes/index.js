const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth.routes');
const empleadosRoutes = require('./empleados.routes');
const vacacionesRoutes = require('./vacaciones.routes');
const asistenciasRoutes = require('./asistencias.routes');
const proyectosRoutes = require('./proyectos.routes');
const departamentosRoutes = require('./departamentos.routes');
const reportesRoutes = require('./reportes.routes');
const dashboardRoutes = require('./dashboard.routes');
const administradoresRoutes = require('./administradores.routes');
const jefesRoutes = require('./jefes.routes');
const permisosRoutes = require('./permisos.routes');
const horasExtrasRoutes = require('./horas_extras.routes');
const vigenciasRoutes = require('./vigencias.routes');
const puestosRoutes = require('./puestos.routes');

// Usar rutas con sus prefijos
router.use('/auth', authRoutes);
router.use('/empleados', empleadosRoutes);
router.use('/vacaciones', vacacionesRoutes);
router.use('/asistencias', asistenciasRoutes);
router.use('/proyectos', proyectosRoutes);
router.use('/departamentos', departamentosRoutes);
router.use('/reportes', reportesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/administradores', administradoresRoutes);
router.use('/jefes', jefesRoutes);
router.use('/permisos', permisosRoutes);
router.use('/horas-extras', horasExtrasRoutes);
router.use('/vigencias', vigenciasRoutes);
router.use('/puestos', puestosRoutes);

module.exports = router;
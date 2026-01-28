const express = require('express');
const router = express.Router();
const proyectosController = require('../controllers/proyectos.controller');
const { verifyToken, checkPermission } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para todos los usuarios
router.get('/mis-proyectos', proyectosController.getProyectosByEmpleado);

// Rutas para administradores/gerentes
router.get(
  '/',
  checkPermission('proyectos', 'leer'),
  proyectosController.getAllProyectos
);

router.get(
  '/:id',
  checkPermission('proyectos', 'leer'),
  proyectosController.getProyectoById
);

router.post(
  '/',
  checkPermission('proyectos', 'crear'),
  proyectosController.createProyecto
);

router.put(
  '/:id',
  checkPermission('proyectos', 'editar'),
  proyectosController.updateProyecto
);

router.post(
  '/:id_proyecto/asignar',
  checkPermission('proyectos', 'editar'),
  proyectosController.asignarEmpleado
);

router.delete(
  '/:id_proyecto/remover/:id_empleado',
  checkPermission('proyectos', 'editar'),
  proyectosController.removerEmpleado
);

module.exports = router;
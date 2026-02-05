const express = require('express');
const router = express.Router();
const jefesController = require('../controllers/jefes.controller');
const { verifyToken, checkPermission, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para empleados (ver sus subordinados)
router.get('/mis-empleados', jefesController.getEmpleadosPorJefe);

// Rutas para administradores (gestión completa)
router.use(checkRole(['admin']));

router.post('/asignar', jefesController.asignarJefe);
router.get('/jerarquia', jefesController.getJerarquia);
router.put('/cambiar/:id_empleado', jefesController.cambiarJefe);

module.exports = router;
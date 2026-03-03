const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { autorizarPorRol } = require('../middleware/autorizacion');

// Ruta pública: Login
router.post('/login', authController.login);

// Ruta pública: Registro (opcional para futuras expansiones)
router.post('/register', authController.register);

// Ruta protegida: Perfil de usuario
router.get('/profile', authenticate, authController.profile);

// Ruta protegida: Verificar token
router.get('/verify', authenticate, authController.verifyToken);

// Ruta protegida: Cambiar contraseña propia
router.post('/change-password', authenticate, authController.changeOwnPassword);

// Ruta protegida: Cambiar contraseña de otro usuario (solo admin)
router.put('/users/:id/change-password', 
  authenticate, 
  autorizarPorRol('admin'),
  authController.changeUserPassword
);

module.exports = router;
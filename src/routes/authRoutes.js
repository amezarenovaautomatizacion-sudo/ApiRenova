const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Ruta pública: Login
router.post('/login', authController.login);

// Ruta pública: Registro (opcional para futuras expansiones)
router.post('/register', authController.register);

// Ruta protegida: Perfil de usuario
router.get('/profile', authenticate, authController.profile);

// Ruta protegida: Verificar token
router.get('/verify', authenticate, authController.verifyToken);

module.exports = router;
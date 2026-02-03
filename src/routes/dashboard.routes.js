// src/routes/dashboard.routes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

// Ruta para obtener datos del dashboard
router.get('/', verifyToken, dashboardController.getDashboard);

module.exports = router;
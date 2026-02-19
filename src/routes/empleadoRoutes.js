const express = require('express');
const router = express.Router();

const empleadoController = require('../controllers/empleadoController');
const catalogoController = require('../controllers/catalogoController');

const { authenticate } = require('../middleware/auth');
const { autorizar, autorizarPorRol } = require('../middleware/autorizacion');


// CATÁLOGOS


// Ruta para catálogos (usuarios autenticados con permiso)
router.get(
  '/catalogos',
  authenticate,
  autorizar('/api/empleados/catalogos', 'GET'),
  catalogoController.obtenerCatalogos
);

// Ruta para roles (solo admin por permisos)
router.get(
  '/roles',
  authenticate,
  autorizar('/api/empleados/roles', 'GET'),
  catalogoController.obtenerRoles
);


// EMPLEADOS


// Crear empleado (admin / manager según permisos)
router.post(
  '/empleados',
  authenticate,
  autorizar('/api/empleados/empleados', 'POST'),
  empleadoController.crearEmpleado
);

// Listar empleados
router.get(
  '/empleados',
  authenticate,
  autorizar('/api/empleados/empleados', 'GET'),
  empleadoController.obtenerEmpleados
);

// Ver empleado por ID
router.get(
  '/empleados/:id',
  authenticate,
  autorizar('/api/empleados/empleados/:id', 'GET'),
  empleadoController.obtenerEmpleado
);

// Actualizar empleado
router.put(
  '/empleados/:id',
  authenticate,
  autorizar('/api/empleados/empleados/:id', 'PUT'),
  empleadoController.actualizarEmpleado
);


// DATOS SENSIBLES (SOLO ADMIN)


// Datos sensibles de un empleado
router.get(
  '/empleados/:id/sensible',
  authenticate,
  autorizar('/api/empleados/empleados/:id/sensible', 'GET'),
  async (req, res) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver datos sensibles'
        });
      }

      const { id } = req.params;

      const [rows] = await req.app.locals.db.query(
        `
        SELECT NSS, RFC, CURP, Direccion, FechaNacimiento
        FROM empleados
        WHERE ID = ?
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: rows[0]
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Listar todos los datos sensibles
router.get(
  '/empleados/sensibles',
  authenticate,
  autorizar('/api/empleados/sensibles', 'GET'),
  async (req, res) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver datos sensibles'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const [rows] = await req.app.locals.db.query(
        `
        SELECT e.ID, e.NombreCompleto, e.NSS, e.RFC, e.CURP, e.CorreoElectronico
        FROM empleados e
        JOIN usuarios u ON e.UsuarioID = u.ID
        WHERE u.Activo = TRUE
        ORDER BY e.NombreCompleto
        LIMIT ? OFFSET ?
        `,
        [limit, offset]
      );

      const [countResult] = await req.app.locals.db.query(
        `
        SELECT COUNT(*) AS total
        FROM empleados e
        JOIN usuarios u ON e.UsuarioID = u.ID
        WHERE u.Activo = TRUE
        `
      );

      res.status(200).json({
        success: true,
        data: {
          empleados: rows,
          pagination: {
            page,
            limit,
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);


// PERMISOS DEL USUARIO ACTUAL


router.get(
  '/mis-permisos',
  authenticate,
  async (req, res) => {
    try {
      const Permiso = require('../models/permisoModel');
      const permisos = await Permiso.obtenerPermisosUsuario(req.user.id);

      res.status(200).json({
        success: true,
        data: permisos
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// Cambiar estado del empleado (activar/desactivar)
router.patch(
  '/empleados/:id/estado',
  authenticate,
  autorizar('/api/empleados/empleados/:id/estado', 'PATCH'),
  empleadoController.cambiarEstadoEmpleado
);

module.exports = router;

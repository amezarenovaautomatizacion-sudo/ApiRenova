const User = require('../models/userModel');
const Empleado = require('../models/empleadoModel');
const { generateToken } = require('../config/jwt');
const { comparePassword } = require('../utils/bcrypt');

const authController = {
  login: async (req, res, next) => {
    try {
      const { usuario, contrasenia } = req.body;

      // Validar campos requeridos
      if (!usuario || !contrasenia) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      // Buscar usuario
      const user = await User.findByEmail(usuario);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar contraseña
      const isPasswordValid = await comparePassword(contrasenia, user.Contrasenia);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Buscar datos del empleado
      const empleado = await Empleado.findByUsuarioId(user.ID);
      
      if (!empleado) {
        return res.status(401).json({
          success: false,
          message: 'No se encontró información del empleado'
        });
      }

      // Obtener departamentos y jefes del empleado
      const departamentos = await Empleado.getDepartamentos(empleado.ID);
      const jefes = await Empleado.getJefes(empleado.ID);

      // Generar token JWT
      const token = generateToken(user.ID, user.Usuario, user.Rol);

      // Eliminar contraseña de la respuesta
      const { Contrasenia, ...userWithoutPassword } = user;

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: userWithoutPassword,
          empleado: {
            ...empleado,
            departamentos,
            jefes
          },
          token,
          expiresIn: '12 horas'
        }
      });

    } catch (error) {
      next(error);
    }
  },

  register: async (req, res, next) => {
    try {
      const { usuario, contrasenia } = req.body;

      if (!usuario || !contrasenia) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      // Verificar si el usuario ya existe
      const existingUser = await User.findByEmail(usuario);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya existe'
        });
      }

      // Crear nuevo usuario (la contraseña se hashea en el modelo)
      const newUser = await User.create(usuario, contrasenia);

      // Generar token para el nuevo usuario
      const token = generateToken(newUser.id, newUser.usuario);

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: newUser,
          token,
          expiresIn: '12 horas'
        }
      });

    } catch (error) {
      next(error);
    }
  },

  profile: async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Obtener datos del empleado
      const empleado = await Empleado.findByUsuarioId(user.ID);
      if (empleado) {
        const departamentos = await Empleado.getDepartamentos(empleado.ID);
        const jefes = await Empleado.getJefes(empleado.ID);
        
        empleado.departamentos = departamentos;
        empleado.jefes = jefes;
      }

      res.status(200).json({
        success: true,
        data: {
          user,
          empleado
        }
      });

    } catch (error) {
      next(error);
    }
  },

  verifyToken: async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Token válido',
        data: user
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
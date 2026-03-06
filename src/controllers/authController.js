const User = require('../models/userModel');
const Empleado = require('../models/empleadoModel');
const { generateToken } = require('../config/jwt');
const { comparePassword } = require('../utils/bcrypt');
const { formatDateFields } = require('../utils/dateFormatter');

const authController = {
  login: async (req, res, next) => {
    try {
      const { usuario, contrasenia } = req.body;

      if (!usuario || !contrasenia) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      const user = await User.findByEmail(usuario);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      const isPasswordValid = await comparePassword(contrasenia, user.Contrasenia);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      let empleado = await Empleado.findByUsuarioId(user.ID);
      
      if (!empleado) {
        return res.status(401).json({
          success: false,
          message: 'No se encontró información del empleado'
        });
      }

      empleado = formatDateFields(empleado, ['FechaIngreso', 'FechaNacimiento'], ['createdAt', 'updatedAt']);

      const departamentos = await Empleado.getDepartamentos(empleado.ID);
      const jefes = await Empleado.getJefes(empleado.ID);

      const token = generateToken(user.ID, user.Usuario, user.Rol);

      const { Contrasenia, ...userWithoutPassword } = user;
      
      const userFormatted = formatDateFields(userWithoutPassword, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: userFormatted,
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

      const existingUser = await User.findByEmail(usuario);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya existe'
        });
      }

      const newUser = await User.create(usuario, contrasenia);

      const token = generateToken(newUser.id, newUser.usuario);

      const userFormatted = formatDateFields(newUser, [], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: userFormatted,
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

      let empleado = await Empleado.findByUsuarioId(user.ID);
      if (empleado) {
        empleado = formatDateFields(empleado, ['FechaIngreso', 'FechaNacimiento'], ['createdAt', 'updatedAt']);
        const departamentos = await Empleado.getDepartamentos(empleado.ID);
        const jefes = await Empleado.getJefes(empleado.ID);
        
        empleado.departamentos = departamentos;
        empleado.jefes = jefes;
      }

      const userFormatted = formatDateFields(user, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          user: userFormatted,
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

      const userFormatted = formatDateFields(user, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        message: 'Token válido',
        data: userFormatted
      });

    } catch (error) {
      next(error);
    }
  },

  changeOwnPassword: async (req, res, next) => {
    try {
      const { contraseniaActual, nuevaContrasenia } = req.body;
      const userId = req.user.id;

      if (!contraseniaActual || !nuevaContrasenia) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva contraseña son requeridas'
        });
      }

      if (nuevaContrasenia.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      const user = await User.findByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const isPasswordValid = await comparePassword(contraseniaActual, user.Contrasenia);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'La contraseña actual es incorrecta'
        });
      }

      const updated = await User.updatePassword(userId, nuevaContrasenia);
      
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar la contraseña'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });

    } catch (error) {
      next(error);
    }
  },

  changeUserPassword: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nuevaContrasenia } = req.body;
      const adminId = req.user.id;

      if (!nuevaContrasenia) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña es requerida'
        });
      }

      if (nuevaContrasenia.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (parseInt(id) === parseInt(adminId)) {
        return res.status(400).json({
          success: false,
          message: 'Para cambiar tu propia contraseña usa el endpoint /change-password'
        });
      }

      const updated = await User.updatePassword(id, nuevaContrasenia);
      
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar la contraseña'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Contraseña del usuario actualizada exitosamente'
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
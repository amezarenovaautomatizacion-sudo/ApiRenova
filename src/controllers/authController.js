const User = require('../models/userModel');
const Empleado = require('../models/empleadoModel');
const { generateToken } = require('../config/jwt');
const { comparePassword } = require('../utils/bcrypt');

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

      const empleado = await Empleado.findByUsuarioId(user.ID);
      
      if (!empleado) {
        return res.status(401).json({
          success: false,
          message: 'No se encontró información del empleado'
        });
      }

      const departamentos = await Empleado.getDepartamentos(empleado.ID);
      const jefes = await Empleado.getJefes(empleado.ID);

      const token = generateToken(user.ID, user.Usuario, user.Rol);

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

      const existingUser = await User.findByEmail(usuario);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El usuario ya existe'
        });
      }

      const newUser = await User.create(usuario, contrasenia);

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
  },

  // Cambiar contraseña propia (requiere token)
  changeOwnPassword: async (req, res, next) => {
    try {
      const { contraseniaActual, nuevaContrasenia } = req.body;
      const userId = req.user.id; // Obtenido del token

      // Validar campos requeridos
      if (!contraseniaActual || !nuevaContrasenia) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva contraseña son requeridas'
        });
      }

      // Validar longitud mínima de la nueva contraseña
      if (nuevaContrasenia.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      // Obtener usuario con su contraseña actual
      const user = await User.findByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar que la contraseña actual sea correcta
      const isPasswordValid = await comparePassword(contraseniaActual, user.Contrasenia);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'La contraseña actual es incorrecta'
        });
      }

      // Actualizar la contraseña
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

  // Cambiar contraseña de otro usuario (requiere permisos de admin)
  changeUserPassword: async (req, res, next) => {
    try {
      const { id } = req.params; // ID del usuario a modificar
      const { nuevaContrasenia } = req.body;
      const adminId = req.user.id; // ID del admin que realiza la acción

      // Validar campos requeridos
      if (!nuevaContrasenia) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña es requerida'
        });
      }

      // Validar longitud mínima
      if (nuevaContrasenia.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      // Verificar que el usuario existe
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar que el admin no se intente cambiar a sí mismo por esta ruta
      if (parseInt(id) === parseInt(adminId)) {
        return res.status(400).json({
          success: false,
          message: 'Para cambiar tu propia contraseña usa el endpoint /change-password'
        });
      }

      // Actualizar la contraseña
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
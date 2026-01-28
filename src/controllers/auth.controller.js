const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIN mejorado
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Buscar usuario activo
    const usuarios = await query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    const usuario = usuarios[0];
    
    // Verificar contraseña
    const match = await bcrypt.compare(password, usuario.password_hash);
    if (!match) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciales inválidas' 
      });
    }

    // Obtener permisos del usuario
    const permisos = await query(
      `SELECT 
        id_rol,
        nombre_rol,
        id_modulo,
        nombre_modulo,
        ruta,
        leer,
        crear,
        editar,
        eliminar
      FROM vista_permisos_usuario 
      WHERE id_usuario = ?`,
      [usuario.id_usuario]
    );

    // Obtener información del empleado si existe
    let empleado = null;
    try {
      const empleados = await query(
        `SELECT e.*, d.nombre_departamento, p.nombre_puesto
         FROM empleados e
         LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
         LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
         WHERE e.id_usuario = ? AND e.activo = 1`,
        [usuario.id_usuario]
      );
      
      if (empleados.length > 0) {
        empleado = empleados[0];
      }
    } catch (error) {
      console.log('Usuario no tiene empleado asociado aún');
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        id_usuario: usuario.id_usuario,
        email: usuario.email,
        roles: permisos.map(p => p.nombre_rol)
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    // Actualizar último login
    await query(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id_usuario = ?',
      [usuario.id_usuario]
    );

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          email: usuario.email,
          fecha_creacion: usuario.fecha_creacion,
          ultimo_login: usuario.ultimo_login
        },
        empleado,
        permisos,
        roles: [...new Set(permisos.map(p => p.nombre_rol))]
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// REGISTER mejorado con validaciones
exports.register = async (req, res) => {
  try {
    const { email, password, rol_id = 4 } = req.body; // Por defecto rol empleado

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Formato de email inválido' 
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar si el usuario ya existe
    const usuarios = await query(
      'SELECT id_usuario FROM usuarios WHERE email = ?',
      [email]
    );

    if (usuarios.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: 'El usuario ya existe' 
      });
    }

    // Verificar si el rol existe
    const roles = await query(
      'SELECT id_rol FROM roles WHERE id_rol = ?',
      [rol_id]
    );

    if (roles.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'El rol especificado no existe' 
      });
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, 12);

    // Insertar usuario en transacción
    const connection = await require('../config/db').getConnection();
    
    try {
      await connection.beginTransaction();

      // Insertar usuario
      const [result] = await connection.execute(
        'INSERT INTO usuarios (email, password_hash) VALUES (?, ?)',
        [email, password_hash]
      );

      const id_usuario = result.insertId;

      // Asignar rol
      await connection.execute(
        'INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES (?, ?)',
        [id_usuario, rol_id]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: 'Usuario creado correctamente',
        data: { id_usuario, email }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear el usuario' 
    });
  }
};

// Obtener perfil del usuario autenticado
exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const usuarios = await query(
      `SELECT u.*, 
        GROUP_CONCAT(r.nombre_rol) as roles,
        e.id_empleado,
        e.nombre,
        e.apellido,
        e.identificacion,
        d.nombre_departamento,
        p.nombre_puesto
      FROM usuarios u
      LEFT JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      LEFT JOIN empleados e ON u.id_usuario = e.id_usuario
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      WHERE u.id_usuario = ?
      GROUP BY u.id_usuario`,
      [userId]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const permisos = await query(
      'SELECT * FROM vista_permisos_usuario WHERE id_usuario = ?',
      [userId]
    );

    res.json({
      success: true,
      data: {
        usuario: usuarios[0],
        permisos
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Cambiar contraseña
exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Contraseña actual y nueva son requeridas' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Obtener usuario
    const usuarios = await query(
      'SELECT password_hash FROM usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    // Verificar contraseña actual
    const match = await bcrypt.compare(currentPassword, usuarios[0].password_hash);
    if (!match) {
      return res.status(401).json({ 
        success: false,
        message: 'Contraseña actual incorrecta' 
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await query(
      'UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?',
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};
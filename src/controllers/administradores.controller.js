const { query } = require('../config/db');
const nodemailer = require('nodemailer');

// Configurar transporter de correo
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Obtener todos los administradores aprobadores
exports.getAdministradores = async (req, res) => {
  try {
    const administradores = await query(`
      SELECT 
        aa.*,
        e.nombre,
        e.apellido,
        e.identificacion,
        e.celular,
        e.correo_personal,
        d.nombre_departamento,
        p.nombre_puesto
      FROM administradores_aprobadores aa
      JOIN empleados e ON aa.id_empleado = e.id_empleado
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      WHERE aa.activo = 1
      ORDER BY aa.nivel
    `);

    res.json({
      success: true,
      data: administradores
    });
  } catch (error) {
    console.error('Error obteniendo administradores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Asignar administrador aprobador
exports.asignarAdministrador = async (req, res) => {
  try {
    const {
      id_empleado,
      nivel,
      email_notificacion,
      puede_aprobar_vacaciones = 1,
      puede_aprobar_horas_extras = 1,
      puede_aprobar_permisos = 1
    } = req.body;

    // Validar que el nivel sea 1, 2 o 3
    if (![1, 2, 3].includes(parseInt(nivel))) {
      return res.status(400).json({
        success: false,
        message: 'El nivel debe ser 1, 2 o 3'
      });
    }

    // Verificar si ya existe un administrador en ese nivel
    const [existeNivel] = await query(
      'SELECT id_admin_aprobador FROM administradores_aprobadores WHERE nivel = ? AND activo = 1',
      [nivel]
    );

    if (existeNivel) {
      return res.status(409).json({
        success: false,
        message: `Ya existe un administrador en el nivel ${nivel}`
      });
    }

    // Verificar si el empleado ya es administrador
    const [existeEmpleado] = await query(
      'SELECT id_admin_aprobador FROM administradores_aprobadores WHERE id_empleado = ? AND activo = 1',
      [id_empleado]
    );

    if (existeEmpleado) {
      return res.status(409).json({
        success: false,
        message: 'El empleado ya es administrador aprobador'
      });
    }

    // Asignar administrador
    const result = await query(
      `INSERT INTO administradores_aprobadores 
       (id_empleado, nivel, email_notificacion, puede_aprobar_vacaciones, 
        puede_aprobar_horas_extras, puede_aprobar_permisos)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_empleado, nivel, email_notificacion, puede_aprobar_vacaciones, 
       puede_aprobar_horas_extras, puede_aprobar_permisos]
    );

    res.status(201).json({
      success: true,
      message: 'Administrador asignado exitosamente',
      data: {
        id_admin_aprobador: result.insertId
      }
    });
  } catch (error) {
    console.error('Error asignando administrador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Enviar notificación a los 3 administradores
exports.notificarAdministradores = async (tipo, id_referencia, id_empleado_solicitante, mensaje) => {
  try {
    // Obtener los 3 administradores activos
    const administradores = await query(`
      SELECT email_notificacion 
      FROM administradores_aprobadores 
      WHERE activo = 1 
      ORDER BY nivel
      LIMIT 3
    `);

    if (administradores.length === 0) {
      console.log('No hay administradores configurados para notificar');
      return;
    }

    // Guardar notificación en la base de datos
    await query(
      `INSERT INTO notificaciones_admin 
       (tipo, id_referencia, id_empleado_solicitante, mensaje)
       VALUES (?, ?, ?, ?)`,
      [tipo, id_referencia, id_empleado_solicitante, mensaje]
    );

    // Enviar correos
    const emails = administradores.map(a => a.email_notificacion);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emails.join(', '),
      subject: `Notificación - Solicitud de ${tipo.toUpperCase()}`,
      html: `
        <h2>Nueva solicitud requiere atención</h2>
        <p><strong>Tipo:</strong> ${tipo}</p>
        <p><strong>Mensaje:</strong> ${mensaje}</p>
        <p><strong>ID Solicitud:</strong> ${id_referencia}</p>
        <p><strong>ID Empleado Solicitante:</strong> ${id_empleado_solicitante}</p>
        <p>Por favor, revise el sistema para tomar acción.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Notificación enviada a ${emails.length} administradores`);

  } catch (error) {
    console.error('Error enviando notificación:', error);
  }
};

// Marcar notificación como vista
exports.marcarNotificacionVista = async (req, res) => {
  try {
    const { id_notificacion } = req.params;
    const userId = req.userId;

    // Obtener ID del empleado admin
    const [admin] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para esta acción'
      });
    }

    // Actualizar notificación
    await query(
      `UPDATE notificaciones_admin 
       SET visto_por = JSON_ARRAY_APPEND(IFNULL(visto_por, '[]'), '$', ?),
           fecha_visto = IF(fecha_visto IS NULL, NOW(), fecha_visto)
       WHERE id_notificacion = ?`,
      [admin.id_empleado, id_notificacion]
    );

    res.json({
      success: true,
      message: 'Notificación marcada como vista'
    });
  } catch (error) {
    console.error('Error marcando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener notificaciones pendientes
exports.getNotificacionesPendientes = async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar si es administrador
    const [admin] = await query(`
      SELECT aa.id_empleado 
      FROM administradores_aprobadores aa
      JOIN empleados e ON aa.id_empleado = e.id_empleado
      WHERE e.id_usuario = ? AND aa.activo = 1
    `, [userId]);

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para ver notificaciones'
      });
    }

    // Obtener notificaciones no vistas por este admin
    const notificaciones = await query(`
      SELECT 
        na.*,
        e.nombre as nombre_solicitante,
        e.apellido as apellido_solicitante,
        e.identificacion
      FROM notificaciones_admin na
      JOIN empleados e ON na.id_empleado_solicitante = e.id_empleado
      WHERE (na.visto_por IS NULL OR 
             NOT JSON_CONTAINS(na.visto_por, CAST(? AS JSON)))
      ORDER BY na.fecha_creacion DESC
    `, [JSON.stringify([admin.id_empleado])]);

    res.json({
      success: true,
      data: notificaciones
    });
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
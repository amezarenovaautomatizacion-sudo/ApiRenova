const { query } = require('../config/db');
const administradoresController = require('./administradores.controller');

// Solicitar permiso
exports.solicitarPermiso = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      tipo_permiso,
      fecha_permiso,
      hora_inicio,
      hora_fin,
      motivo,
      justificacion
    } = req.body;

    // Validaciones
    if (!tipo_permiso || !fecha_permiso || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de permiso, fecha y motivo son requeridos'
      });
    }

    if (!['con_goce', 'sin_goce'].includes(tipo_permiso)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de permiso inválido. Debe ser "con_goce" o "sin_goce"'
      });
    }

    // Verificar que sea máximo 24 horas antes
    const fechaPermiso = new Date(fecha_permiso);
    const ahora = new Date();
    const diferenciaHoras = (fechaPermiso - ahora) / (1000 * 60 * 60);

    if (diferenciaHoras < 24) {
      return res.status(400).json({
        success: false,
        message: 'Los permisos deben solicitarse al menos 24 horas antes'
      });
    }

    // Obtener empleado
    const [empleado] = await query(
      'SELECT id_empleado, nombre, apellido FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    // Calcular horas si se especifican
    let horasSolicitadas = null;
    if (hora_inicio && hora_fin) {
      const inicio = new Date(`2000-01-01T${hora_inicio}`);
      const fin = new Date(`2000-01-01T${hora_fin}`);
      horasSolicitadas = ((fin - inicio) / (1000 * 60 * 60)).toFixed(2);
    }

    // Insertar solicitud
    const result = await query(
      `INSERT INTO permisos 
       (id_empleado, tipo_permiso, fecha_permiso, hora_inicio, hora_fin,
        horas_solicitadas, motivo, justificacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empleado.id_empleado,
        tipo_permiso,
        fecha_permiso,
        hora_inicio || null,
        hora_fin || null,
        horasSolicitadas,
        motivo,
        justificacion || null
      ]
    );

    // Enviar notificación a los 3 administradores
    const mensaje = `Solicitud de permiso ${tipo_permiso === 'con_goce' ? 'CON goce' : 'SIN goce'} de sueldo para ${empleado.nombre} ${empleado.apellido} el ${fecha_permiso}. Motivo: ${motivo}`;
    
    administradoresController.notificarAdministradores(
      'permiso',
      result.insertId,
      empleado.id_empleado,
      mensaje
    );

    res.status(201).json({
      success: true,
      message: 'Permiso solicitado exitosamente. Los administradores han sido notificados.',
      data: {
        id_permiso: result.insertId
      }
    });
  } catch (error) {
    console.error('Error solicitando permiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Aprobar/rechazar permiso
exports.aprobarPermiso = async (req, res) => {
  try {
    const { id } = req.params;
    const { accion, motivo_rechazo } = req.body;
    const userId = req.userId;

    if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
      return res.status(400).json({
        success: false,
        message: 'Acción inválida. Debe ser "aprobar" o "rechazar"'
      });
    }

    // Verificar que el usuario sea administrador aprobador
    const [admin] = await query(`
      SELECT aa.id_empleado
      FROM administradores_aprobadores aa
      JOIN empleados e ON aa.id_empleado = e.id_empleado
      WHERE e.id_usuario = ? AND aa.activo = 1 AND aa.puede_aprobar_permisos = 1
    `, [userId]);

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para aprobar permisos'
      });
    }

    // Actualizar permiso
    const result = await query(
      `UPDATE permisos 
       SET estado = ?, id_aprobador = ?, fecha_aprobacion = NOW(),
           motivo_rechazo = ?, notificado_tres_admins = 1
       WHERE id_permiso = ? AND estado = 'pendiente'`,
      [
        accion === 'aprobar' ? 'aprobado' : 'rechazado',
        admin.id_empleado,
        accion === 'rechazar' ? motivo_rechazo : null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Permiso no encontrado o ya procesado'
      });
    }

    // Si fue aprobado, restar días si es con goce
    if (accion === 'aprobar') {
      const [permiso] = await query(
        'SELECT id_empleado, fecha_permiso, tipo_permiso FROM permisos WHERE id_permiso = ?',
        [id]
      );

      if (permiso.tipo_permiso === 'con_goce') {
        // Aquí podrías restar días de vacaciones si es necesario
        // Según la política de la empresa
      }
    }

    res.json({
      success: true,
      message: `Permiso ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} exitosamente`
    });
  } catch (error) {
    console.error('Error aprobando permiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener permisos del empleado
exports.getPermisosEmpleado = async (req, res) => {
  try {
    const userId = req.userId;

    const [empleado] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    const permisos = await query(`
      SELECT 
        p.*,
        CONCAT(a.nombre, ' ', a.apellido) as nombre_aprobador
      FROM permisos p
      LEFT JOIN empleados a ON p.id_aprobador = a.id_empleado
      WHERE p.id_empleado = ?
      ORDER BY p.fecha_solicitud DESC
    `, [empleado.id_empleado]);

    // Estadísticas
    const [estadisticas] = await query(`
      SELECT 
        COUNT(*) as total_solicitudes,
        COUNT(CASE WHEN estado = 'aprobado' THEN 1 END) as aprobados,
        COUNT(CASE WHEN estado = 'rechazado' THEN 1 END) as rechazados,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN tipo_permiso = 'con_goce' THEN 1 END) as con_goce,
        COUNT(CASE WHEN tipo_permiso = 'sin_goce' THEN 1 END) as sin_goce
      FROM permisos
      WHERE id_empleado = ?
    `, [empleado.id_empleado]);

    res.json({
      success: true,
      data: {
        permisos,
        estadisticas
      }
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener todos los permisos (admin)
exports.getAllPermisos = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado, 
      tipo_permiso,
      fecha_inicio, 
      fecha_fin 
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM permisos p
      JOIN empleados e ON p.id_empleado = e.id_empleado
      LEFT JOIN empleados a ON p.id_aprobador = a.id_empleado
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      baseQuery += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (tipo_permiso) {
      baseQuery += ` AND p.tipo_permiso = ?`;
      params.push(tipo_permiso);
    }

    if (fecha_inicio) {
      baseQuery += ` AND p.fecha_permiso >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      baseQuery += ` AND p.fecha_permiso <= ?`;
      params.push(fecha_fin);
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await query(countQuery, params);

    // Obtener datos
    const dataQuery = `
      SELECT 
        p.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_empleado,
        e.identificacion,
        CONCAT(a.nombre, ' ', a.apellido) as nombre_aprobador
      ${baseQuery}
      ORDER BY p.fecha_solicitud DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parseInt(limit), offset];
    const permisos = await query(dataQuery, dataParams);

    res.json({
      success: true,
      data: {
        permisos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
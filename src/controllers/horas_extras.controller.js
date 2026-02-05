const { query } = require('../config/db');
const administradoresController = require('./administradores.controller');

// Solicitar horas extras (gerente)
exports.solicitarHorasExtras = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      id_empleado,
      fecha_hora_extra,
      hora_inicio,
      hora_fin,
      motivo,
      razon_proyecto,
      tipo_pago = 'doble'
    } = req.body;

    // Validaciones
    if (!id_empleado || !fecha_hora_extra || !hora_inicio || !hora_fin || !motivo) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

    // Verificar que sea gerente (o tenga permisos)
    const [solicitante] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (!solicitante) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para solicitar horas extras'
      });
    }

    // Calcular horas solicitadas
    const inicio = new Date(`2000-01-01T${hora_inicio}`);
    const fin = new Date(`2000-01-01T${hora_fin}`);
    const horasSolicitadas = ((fin - inicio) / (1000 * 60 * 60)).toFixed(2);

    // Verificar que no sean más de 3 horas por día
    if (horasSolicitadas > 3) {
      return res.status(400).json({
        success: false,
        message: 'No se pueden solicitar más de 3 horas extras por día'
      });
    }

    // Insertar solicitud
    const result = await query(
      `INSERT INTO horas_extras 
       (id_empleado, id_solicitante, fecha_hora_extra, hora_inicio, hora_fin,
        horas_solicitadas, motivo, razon_proyecto, tipo_pago, fecha_limite_aprobacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 3 DAY))`,
      [
        id_empleado,
        solicitante.id_empleado,
        fecha_hora_extra,
        hora_inicio,
        hora_fin,
        horasSolicitadas,
        motivo,
        razon_proyecto || null,
        tipo_pago
      ]
    );

    // Crear registros de aprobación para los 3 administradores
    const administradores = await query(
      'SELECT id_empleado, nivel FROM administradores_aprobadores WHERE activo = 1 ORDER BY nivel LIMIT 3'
    );

    for (const admin of administradores) {
      await query(
        `INSERT INTO aprobaciones_multiples 
         (tipo_solicitud, id_solicitud, id_aprobador, nivel_requerido)
         VALUES ('hora_extra', ?, ?, ?)`,
        [result.insertId, admin.id_empleado, admin.nivel]
      );
    }

    // Enviar notificación a administradores
    const [empleado] = await query(
      'SELECT nombre, apellido FROM empleados WHERE id_empleado = ?',
      [id_empleado]
    );

    const mensaje = `Solicitud de horas extras para ${empleado.nombre} ${empleado.apellido} el ${fecha_hora_extra} de ${hora_inicio} a ${hora_fin}. Motivo: ${motivo}`;
    
    administradoresController.notificarAdministradores(
      'hora_extra',
      result.insertId,
      id_empleado,
      mensaje
    );

    res.status(201).json({
      success: true,
      message: 'Solicitud de horas extras enviada. Requiere aprobación de 3 administradores.',
      data: {
        id_hora_extra: result.insertId,
        horas_solicitadas: horasSolicitadas,
        fecha_limite_aprobacion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error solicitando horas extras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Aprobar/rechazar horas extras (administrador)
exports.aprobarHorasExtras = async (req, res) => {
  try {
    const { id } = req.params;
    const { accion, motivo } = req.body;
    const userId = req.userId;

    if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
      return res.status(400).json({
        success: false,
        message: 'Acción inválida. Debe ser "aprobar" o "rechazar"'
      });
    }

    // Verificar que el usuario sea administrador aprobador
    const [admin] = await query(`
      SELECT aa.id_empleado, aa.nivel
      FROM administradores_aprobadores aa
      JOIN empleados e ON aa.id_empleado = e.id_empleado
      WHERE e.id_usuario = ? AND aa.activo = 1
    `, [userId]);

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para aprobar horas extras'
      });
    }

    // Verificar que la solicitud existe y está pendiente
    const [solicitud] = await query(
      'SELECT estado, requiere_tres_aprobaciones FROM horas_extras WHERE id_hora_extra = ?',
      [id]
    );

    if (!solicitud) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'La solicitud ya fue procesada'
      });
    }

    // Registrar la aprobación
    await query(
      `INSERT INTO aprobaciones_horas_extras 
       (id_hora_extra, id_aprobador, nivel_aprobacion, accion, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [id, admin.id_empleado, admin.nivel, accion === 'aprobar' ? 'aprobado' : 'rechazado', motivo || null]
    );

    // Actualizar aprobación múltiple
    await query(
      `UPDATE aprobaciones_multiples 
       SET accion = ?, motivo = ?, fecha_accion = NOW()
       WHERE tipo_solicitud = 'hora_extra' 
         AND id_solicitud = ? 
         AND id_aprobador = ?`,
      [accion === 'aprobar' ? 'aprobado' : 'rechazado', motivo, id, admin.id_empleado]
    );

    // Contar aprobaciones
    const [aprobaciones] = await query(
      `SELECT 
        COUNT(CASE WHEN accion = 'aprobado' THEN 1 END) as aprobados,
        COUNT(CASE WHEN accion = 'rechazado' THEN 1 END) as rechazados
      FROM aprobaciones_horas_extras 
      WHERE id_hora_extra = ?`,
      [id]
    );

    let nuevoEstado = 'pendiente';
    
    if (aprobaciones.rechazados > 0) {
      // Si al menos uno rechaza, se rechaza todo
      nuevoEstado = 'rechazado';
    } else if (aprobaciones.aprobados >= 3) {
      // Si los 3 aprueban
      nuevoEstado = 'aprobado';
    }

    // Actualizar estado de la solicitud
    await query(
      'UPDATE horas_extras SET estado = ?, aprobaciones_obtenidas = ? WHERE id_hora_extra = ?',
      [nuevoEstado, aprobaciones.aprobados, id]
    );

    // Si fue rechazada, notificar al gerente que la solicitó
    if (nuevoEstado === 'rechazado') {
      const [detalle] = await query(
        `SELECT he.*, e.correo_personal 
         FROM horas_extras he
         JOIN empleados e ON he.id_solicitante = e.id_empleado
         WHERE he.id_hora_extra = ?`,
        [id]
      );

      if (detalle.correo_personal) {
        // Enviar correo de rechazo (implementar si es necesario)
      }
    }

    res.json({
      success: true,
      message: `Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} por usted. Estado actual: ${nuevoEstado}`,
      data: {
        aprobaciones_obtenidas: aprobaciones.aprobados,
        estado: nuevoEstado
      }
    });
  } catch (error) {
    console.error('Error aprobando horas extras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener horas extras del empleado
exports.getHorasExtrasEmpleado = async (req, res) => {
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

    const horasExtras = await query(`
      SELECT 
        he.*,
        e.nombre as nombre_solicitante,
        e.apellido as apellido_solicitante,
        em.nombre as nombre_empleado,
        em.apellido as apellido_empleado
      FROM horas_extras he
      JOIN empleados e ON he.id_solicitante = e.id_empleado
      JOIN empleados em ON he.id_empleado = em.id_empleado
      WHERE he.id_empleado = ?
      ORDER BY he.fecha_solicitud DESC
    `, [empleado.id_empleado]);

    // Estadísticas
    const [estadisticas] = await query(`
      SELECT 
        COUNT(*) as total_solicitudes,
        SUM(CASE WHEN estado = 'aprobado' THEN horas_solicitadas ELSE 0 END) as horas_aprobadas,
        SUM(CASE WHEN estado = 'pendiente' THEN horas_solicitadas ELSE 0 END) as horas_pendientes,
        SUM(CASE WHEN estado = 'ejecutado' THEN horas_solicitadas ELSE 0 END) as horas_ejecutadas
      FROM horas_extras
      WHERE id_empleado = ?
    `, [empleado.id_empleado]);

    res.json({
      success: true,
      data: {
        horasExtras,
        estadisticas
      }
    });
  } catch (error) {
    console.error('Error obteniendo horas extras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener todas las horas extras (admin)
exports.getAllHorasExtras = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado, 
      fecha_inicio, 
      fecha_fin 
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM horas_extras he
      JOIN empleados e ON he.id_empleado = e.id_empleado
      JOIN empleados s ON he.id_solicitante = s.id_empleado
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      baseQuery += ` AND he.estado = ?`;
      params.push(estado);
    }

    if (fecha_inicio) {
      baseQuery += ` AND he.fecha_hora_extra >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      baseQuery += ` AND he.fecha_hora_extra <= ?`;
      params.push(fecha_fin);
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await query(countQuery, params);

    // Obtener datos
    const dataQuery = `
      SELECT 
        he.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_empleado,
        CONCAT(s.nombre, ' ', s.apellido) as nombre_solicitante,
        e.identificacion
      ${baseQuery}
      ORDER BY he.fecha_solicitud DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parseInt(limit), offset];
    const horasExtras = await query(dataQuery, dataParams);

    // Obtener aprobaciones para cada solicitud
    for (let horaExtra of horasExtras) {
      const aprobaciones = await query(`
        SELECT 
          ahe.*,
          CONCAT(e.nombre, ' ', e.apellido) as nombre_aprobador
        FROM aprobaciones_horas_extras ahe
        JOIN empleados e ON ahe.id_aprobador = e.id_empleado
        WHERE ahe.id_hora_extra = ?
        ORDER BY ahe.nivel_aprobacion
      `, [horaExtra.id_hora_extra]);

      horaExtra.aprobaciones = aprobaciones;
    }

    res.json({
      success: true,
      data: {
        horasExtras,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo horas extras:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
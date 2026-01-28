const { query } = require('../config/db');

// Obtener todas las solicitudes de vacaciones
exports.getAllVacaciones = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estado,
      tipo,
      fecha_inicio,
      fecha_fin,
      id_empleado
    } = req.query;

    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM vacaciones v
      JOIN empleados e ON v.id_empleado = e.id_empleado
      JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
      JOIN estados_vacacion ev ON v.id_estado = ev.id_estado
      LEFT JOIN empleados a ON v.id_aprobador = a.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    // Añadir filtros
    if (estado) {
      baseQuery += ` AND v.id_estado = ?`;
      params.push(estado);
    }
    
    if (tipo) {
      baseQuery += ` AND v.id_tipo_vacacion = ?`;
      params.push(tipo);
    }
    
    if (fecha_inicio) {
      baseQuery += ` AND v.fecha_inicio >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      baseQuery += ` AND v.fecha_fin <= ?`;
      params.push(fecha_fin);
    }
    
    if (id_empleado) {
      baseQuery += ` AND v.id_empleado = ?`;
      params.push(id_empleado);
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await query(countQuery, params);
    
    // Obtener datos
    const dataQuery = `
      SELECT 
        v.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_empleado,
        e.identificacion,
        tv.nombre_tipo,
        tv.dias_maximos,
        ev.nombre_estado,
        CONCAT(a.nombre, ' ', a.apellido) as nombre_aprobador
      ${baseQuery}
      ORDER BY v.fecha_solicitud DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, parseInt(limit), offset];
    const vacaciones = await query(dataQuery, dataParams);

    res.json({
      success: true,
      data: {
        vacaciones,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo vacaciones:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Obtener vacaciones por empleado
exports.getVacacionesByEmpleado = async (req, res) => {
  try {
    const userId = req.userId; // ID del usuario logueado

    // Obtener id_empleado asociado al usuario
    const empleados = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No se encontró empleado asociado al usuario' 
      });
    }

    const id_empleado = empleados[0].id_empleado;

    // Obtener vacaciones del empleado
    const vacaciones = await query(
      `SELECT 
        v.*,
        tv.nombre_tipo,
        ev.nombre_estado,
        CONCAT(a.nombre, ' ', a.apellido) as nombre_aprobador
      FROM vacaciones v
      JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
      JOIN estados_vacacion ev ON v.id_estado = ev.id_estado
      LEFT JOIN empleados a ON v.id_aprobador = a.id_empleado
      WHERE v.id_empleado = ?
      ORDER BY v.fecha_solicitud DESC`,
      [id_empleado]
    );

    // Calcular días usados y disponibles
    const diasUsados = vacaciones
      .filter(v => v.id_estado === 2) // Solo aprobadas
      .reduce((sum, v) => sum + v.dias_solicitados, 0);

    const diasDisponibles = 30 - diasUsados; // Ajusta 30 según tu política

    res.json({
      success: true,
      data: {
        vacaciones,
        resumen: {
          totalSolicitudes: vacaciones.length,
          diasUsados,
          diasDisponibles,
          solicitudesPendientes: vacaciones.filter(v => v.id_estado === 1).length
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo vacaciones por empleado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Crear solicitud de vacaciones
exports.createVacacion = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      id_tipo_vacacion,
      fecha_inicio,
      fecha_fin,
      motivo
    } = req.body;

    // Validaciones
    if (!id_tipo_vacacion || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan campos requeridos' 
      });
    }

    // Validar fechas
    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);
    
    if (inicio > fin) {
      return res.status(400).json({ 
        success: false,
        message: 'La fecha de inicio debe ser anterior a la fecha de fin' 
      });
    }

    // Calcular días solicitados
    const diasSolicitados = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

    // Obtener ID del empleado desde el usuario
    const empleados = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No se encontró empleado asociado al usuario' 
      });
    }

    const id_empleado = empleados[0].id_empleado;

    // Verificar si hay vacaciones solapadas (usando trigger de la BD)
    try {
      const result = await query(
        `INSERT INTO vacaciones (
          id_empleado, id_tipo_vacacion, fecha_inicio, fecha_fin,
          dias_solicitados, motivo, id_estado
        ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          id_empleado,
          id_tipo_vacacion,
          fecha_inicio,
          fecha_fin,
          diasSolicitados,
          motivo || ''
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Solicitud de vacaciones creada exitosamente',
        data: {
          id_vacacion: result.insertId
        }
      });

    } catch (error) {
      // Capturar error del trigger de solapamiento
      if (error.code === '45000') {
        return res.status(409).json({ 
          success: false,
          message: 'Ya tiene vacaciones solicitadas o aprobadas en ese período' 
        });
      }
      throw error;
    }

  } catch (error) {
    console.error('Error creando vacación:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Aprobar/Rechazar solicitud de vacaciones
exports.aprobarVacacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { accion, comentarios } = req.body; // accion: 'aprobar' o 'rechazar'
    const aprobadorId = req.userId;

    if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
      return res.status(400).json({ 
        success: false,
        message: 'Acción inválida. Debe ser "aprobar" o "rechazar"' 
      });
    }

    // Obtener ID del aprobador (empleado)
    const aprobadores = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [aprobadorId]
    );

    if (aprobadores.length === 0) {
      return res.status(403).json({ 
        success: false,
        message: 'No tiene permisos para aprobar vacaciones' 
      });
    }

    const id_aprobador = aprobadores[0].id_empleado;
    const id_estado = accion === 'aprobar' ? 2 : 3; // 2: aprobado, 3: rechazado

    // Actualizar solicitud
    const result = await query(
      `UPDATE vacaciones 
       SET id_estado = ?, id_aprobador = ?, fecha_aprobacion = NOW(), comentarios = ?
       WHERE id_vacacion = ? AND id_estado = 1`, // Solo si está pendiente
      [id_estado, id_aprobador, comentarios || '', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Solicitud no encontrada o ya procesada' 
      });
    }

    res.json({
      success: true,
      message: `Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'} exitosamente`
    });

  } catch (error) {
    console.error('Error aprobando vacación:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Cancelar solicitud propia
exports.cancelarVacacion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Obtener ID del empleado
    const empleados = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
      [userId]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No se encontró empleado asociado' 
      });
    }

    const id_empleado = empleados[0].id_empleado;

    // Solo puede cancelar si es el dueño y está pendiente
    const result = await query(
      `UPDATE vacaciones 
       SET id_estado = 4, comentarios = CONCAT(IFNULL(comentarios, ''), ' - Cancelada por el empleado')
       WHERE id_vacacion = ? AND id_empleado = ? AND id_estado = 1`,
      [id, id_empleado]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Solicitud no encontrada, no es suya o ya fue procesada' 
      });
    }

    res.json({
      success: true,
      message: 'Solicitud cancelada exitosamente'
    });

  } catch (error) {
    console.error('Error cancelando vacación:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Obtener estadísticas de vacaciones
exports.getEstadisticasVacaciones = async (req, res) => {
  try {
    // Solicitudes por estado
    const porEstado = await query(
      `SELECT 
        ev.nombre_estado,
        COUNT(v.id_vacacion) as cantidad
      FROM estados_vacacion ev
      LEFT JOIN vacaciones v ON ev.id_estado = v.id_estado
        AND YEAR(v.fecha_solicitud) = YEAR(CURRENT_DATE)
      GROUP BY ev.id_estado
      ORDER BY ev.id_estado`
    );

    // Solicitudes por tipo
    const porTipo = await query(
      `SELECT 
        tv.nombre_tipo,
        COUNT(v.id_vacacion) as cantidad,
        SUM(v.dias_solicitados) as total_dias
      FROM tipos_vacacion tv
      LEFT JOIN vacaciones v ON tv.id_tipo = v.id_tipo_vacacion
        AND YEAR(v.fecha_solicitud) = YEAR(CURRENT_DATE)
        AND v.id_estado = 2 -- solo aprobadas
      GROUP BY tv.id_tipo
      ORDER BY tv.id_tipo`
    );

    // Solicitudes por mes (año actual)
    const porMes = await query(
      `SELECT 
        MONTH(fecha_solicitud) as mes,
        COUNT(*) as cantidad,
        SUM(dias_solicitados) as total_dias
      FROM vacaciones
      WHERE YEAR(fecha_solicitud) = YEAR(CURRENT_DATE)
      GROUP BY MONTH(fecha_solicitud)
      ORDER BY mes`
    );

    // Top empleados con más días solicitados
    const topEmpleados = await query(
      `SELECT 
        e.nombre,
        e.apellido,
        COUNT(v.id_vacacion) as solicitudes,
        SUM(v.dias_solicitados) as total_dias
      FROM empleados e
      LEFT JOIN vacaciones v ON e.id_empleado = v.id_empleado
        AND YEAR(v.fecha_solicitud) = YEAR(CURRENT_DATE)
        AND v.id_estado = 2 -- solo aprobadas
      WHERE e.activo = 1
      GROUP BY e.id_empleado
      ORDER BY total_dias DESC
      LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        porEstado,
        porTipo,
        porMes,
        topEmpleados
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de vacaciones:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};
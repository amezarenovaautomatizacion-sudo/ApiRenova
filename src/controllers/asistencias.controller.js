const { query } = require('../config/db');

// Registrar asistencia
exports.registrarAsistencia = async (req, res) => {
  try {
    const userId = req.userId;
    const { tipo } = req.body; // 'entrada' o 'salida'

    if (!['entrada', 'salida'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo debe ser "entrada" o "salida"'
      });
    }

    // Obtener empleado
    const [empleado] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ? AND activo = 1',
      [userId]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0];

    // Verificar si ya existe registro para hoy
    const [registroHoy] = await query(
      'SELECT * FROM asistencias WHERE id_empleado = ? AND fecha = ?',
      [empleado.id_empleado, today]
    );

    if (tipo === 'entrada') {
      if (registroHoy) {
        return res.status(400).json({
          success: false,
          message: 'Ya registró entrada hoy'
        });
      }

      // Registrar entrada
      await query(
        `INSERT INTO asistencias 
         (id_empleado, fecha, hora_entrada, estado) 
         VALUES (?, ?, ?, 'presente')`,
        [empleado.id_empleado, today, now]
      );

      res.json({
        success: true,
        message: 'Entrada registrada exitosamente',
        data: {
          fecha: today,
          hora_entrada: now,
          estado: 'presente'
        }
      });

    } else { // salida
      if (!registroHoy) {
        return res.status(400).json({
          success: false,
          message: 'No tiene registro de entrada hoy'
        });
      }

      if (registroHoy.hora_salida) {
        return res.status(400).json({
          success: false,
          message: 'Ya registró salida hoy'
        });
      }

      // Calcular horas trabajadas
      const entrada = new Date(`${today}T${registroHoy.hora_entrada}`);
      const salida = new Date();
      const horasTrabajadas = ((salida - entrada) / (1000 * 60 * 60)).toFixed(2);

      // Registrar salida
      await query(
        `UPDATE asistencias 
         SET hora_salida = ?, horas_trabajadas = ?, estado = 'completado'
         WHERE id_asistencia = ?`,
        [now, horasTrabajadas, registroHoy.id_asistencia]
      );

      res.json({
        success: true,
        message: 'Salida registrada exitosamente',
        data: {
          fecha: today,
          hora_entrada: registroHoy.hora_entrada,
          hora_salida: now,
          horas_trabajadas: horasTrabajadas,
          estado: 'completado'
        }
      });
    }

  } catch (error) {
    console.error('Error registrando asistencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener asistencias del empleado
exports.getAsistenciasEmpleado = async (req, res) => {
  try {
    const userId = req.userId;
    const { mes, año } = req.query;

    // Obtener empleado
    const [empleado] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ? AND activo = 1',
      [userId]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    let queryStr = `
      SELECT * FROM asistencias 
      WHERE id_empleado = ?
    `;
    const params = [empleado.id_empleado];

    if (mes && año) {
      queryStr += ` AND MONTH(fecha) = ? AND YEAR(fecha) = ?`;
      params.push(mes, año);
    } else {
      // Por defecto, último mes
      queryStr += ` AND fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
    }

    queryStr += ` ORDER BY fecha DESC`;

    const asistencias = await query(queryStr, params);

    // Calcular estadísticas
    const totalDias = asistencias.length;
    const diasCompletos = asistencias.filter(a => a.estado === 'completado').length;
    const horasTotales = asistencias.reduce((sum, a) => sum + parseFloat(a.horas_trabajadas || 0), 0);
    const promedioDiario = totalDias > 0 ? (horasTotales / totalDias).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        asistencias,
        estadisticas: {
          totalDias,
          diasCompletos,
          horasTotales: horasTotales.toFixed(2),
          promedioDiario
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo asistencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener todas las asistencias (admin/gerente)
exports.getAllAsistencias = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      fecha_inicio,
      fecha_fin,
      id_empleado,
      departamento
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id_empleado
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      WHERE e.activo = 1
    `;

    const params = [];

    if (fecha_inicio) {
      baseQuery += ` AND a.fecha >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      baseQuery += ` AND a.fecha <= ?`;
      params.push(fecha_fin);
    }

    if (id_empleado) {
      baseQuery += ` AND a.id_empleado = ?`;
      params.push(id_empleado);
    }

    if (departamento) {
      baseQuery += ` AND e.id_departamento = ?`;
      params.push(departamento);
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await query(countQuery, params);

    // Obtener datos
    const dataQuery = `
      SELECT 
        a.*,
        e.nombre,
        e.apellido,
        e.identificacion,
        d.nombre_departamento
      ${baseQuery}
      ORDER BY a.fecha DESC, a.hora_entrada DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parseInt(limit), offset];
    const asistencias = await query(dataQuery, dataParams);

    // Estadísticas
    const [estadisticas] = await query(`
      SELECT 
        COUNT(DISTINCT a.id_empleado) as empleados_con_asistencia,
        AVG(a.horas_trabajadas) as promedio_horas,
        SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) as total_ausencias
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id_empleado
      WHERE a.fecha = CURDATE() AND e.activo = 1
    `);

    res.json({
      success: true,
      data: {
        asistencias,
        estadisticas,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo asistencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Registrar asistencia manual (admin)
exports.registrarAsistenciaManual = async (req, res) => {
  try {
    const {
      id_empleado,
      fecha,
      hora_entrada,
      hora_salida,
      estado,
      observaciones
    } = req.body;

    if (!id_empleado || !fecha) {
      return res.status(400).json({
        success: false,
        message: 'ID de empleado y fecha son requeridos'
      });
    }

    // Verificar si ya existe registro
    const [existente] = await query(
      'SELECT id_asistencia FROM asistencias WHERE id_empleado = ? AND fecha = ?',
      [id_empleado, fecha]
    );

    if (existente) {
      // Actualizar
      await query(
        `UPDATE asistencias 
         SET hora_entrada = ?, hora_salida = ?, estado = ?, observaciones = ?,
             horas_trabajadas = TIMESTAMPDIFF(HOUR, CONCAT(fecha, ' ', ?), CONCAT(fecha, ' ', ?))
         WHERE id_asistencia = ?`,
        [hora_entrada, hora_salida, estado, observaciones, hora_entrada, hora_salida, existente.id_asistencia]
      );
    } else {
      // Insertar nuevo
      await query(
        `INSERT INTO asistencias 
         (id_empleado, fecha, hora_entrada, hora_salida, estado, observaciones, horas_trabajadas)
         VALUES (?, ?, ?, ?, ?, ?, 
           TIMESTAMPDIFF(HOUR, CONCAT(?, ' ', ?), CONCAT(?, ' ', ?)))`,
        [id_empleado, fecha, hora_entrada, hora_salida, estado, observaciones, fecha, hora_entrada, fecha, hora_salida]
      );
    }

    res.json({
      success: true,
      message: 'Asistencia registrada exitosamente'
    });

  } catch (error) {
    console.error('Error registrando asistencia manual:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
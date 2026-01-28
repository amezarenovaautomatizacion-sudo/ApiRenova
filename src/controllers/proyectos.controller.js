const { query } = require('../config/db');

// Obtener todos los proyectos
exports.getAllProyectos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      estado,
      search
    } = req.query;

    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM proyectos p
      LEFT JOIN empleados e ON p.id_gerente_proyecto = e.id_empleado
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      baseQuery += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (search) {
      baseQuery += ` AND (p.nombre_proyecto LIKE ? OR p.descripcion LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const [countResult] = await query(countQuery, params);

    // Obtener datos
    const dataQuery = `
      SELECT 
        p.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_gerente,
        e.id_empleado as id_gerente
      ${baseQuery}
      ORDER BY p.fecha_inicio DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, parseInt(limit), offset];
    const proyectos = await query(dataQuery, dataParams);

    // Para cada proyecto, obtener empleados asignados
    for (let proyecto of proyectos) {
      const empleados = await query(
        `SELECT 
          ap.*,
          e.nombre,
          e.apellido,
          e.identificacion,
          d.nombre_departamento
        FROM asignaciones_proyecto ap
        JOIN empleados e ON ap.id_empleado = e.id_empleado
        LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
        WHERE ap.id_proyecto = ? AND ap.activo = 1`,
        [proyecto.id_proyecto]
      );
      proyecto.empleados = empleados;
    }

    res.json({
      success: true,
      data: {
        proyectos,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener proyecto por ID
exports.getProyectoById = async (req, res) => {
  try {
    const { id } = req.params;

    const [proyecto] = await query(
      `SELECT 
        p.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_gerente
      FROM proyectos p
      LEFT JOIN empleados e ON p.id_gerente_proyecto = e.id_empleado
      WHERE p.id_proyecto = ?`,
      [id]
    );

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Empleados asignados
    const empleados = await query(
      `SELECT 
        ap.*,
        e.nombre,
        e.apellido,
        e.identificacion,
        d.nombre_departamento,
        puestos.nombre_puesto
      FROM asignaciones_proyecto ap
      JOIN empleados e ON ap.id_empleado = e.id_empleado
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos ON e.id_puesto = puestos.id_puesto
      WHERE ap.id_proyecto = ? AND ap.activo = 1`,
      [id]
    );

    // Estadísticas del proyecto
    const [estadisticas] = await query(
      `SELECT 
        COUNT(*) as total_empleados,
        SUM(porcentaje_dedicacion) as dedicacion_total,
        AVG(porcentaje_dedicacion) as dedicacion_promedio
      FROM asignaciones_proyecto
      WHERE id_proyecto = ? AND activo = 1`,
      [id]
    );

    proyecto.empleados = empleados;
    proyecto.estadisticas = estadisticas;

    res.json({
      success: true,
      data: proyecto
    });

  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear proyecto
exports.createProyecto = async (req, res) => {
  try {
    const {
      nombre_proyecto,
      descripcion,
      fecha_inicio,
      fecha_fin_estimada,
      id_gerente_proyecto,
      presupuesto
    } = req.body;

    if (!nombre_proyecto || !fecha_inicio || !fecha_fin_estimada) {
      return res.status(400).json({
        success: false,
        message: 'Nombre del proyecto y fechas son requeridos'
      });
    }

    const result = await query(
      `INSERT INTO proyectos 
       (nombre_proyecto, descripcion, fecha_inicio, fecha_fin_estimada, 
        id_gerente_proyecto, presupuesto, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'planificado')`,
      [nombre_proyecto, descripcion || null, fecha_inicio, fecha_fin_estimada,
       id_gerente_proyecto || null, presupuesto || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: {
        id_proyecto: result.insertId
      }
    });

  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar proyecto
exports.updateProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar si existe
    const [proyecto] = await query(
      'SELECT id_proyecto FROM proyectos WHERE id_proyecto = ?',
      [id]
    );

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    const allowedFields = [
      'nombre_proyecto', 'descripcion', 'fecha_fin_estimada',
      'fecha_fin_real', 'estado', 'id_gerente_proyecto', 'presupuesto'
    ];

    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    values.push(id);
    const sql = `UPDATE proyectos SET ${setClauses.join(', ')} WHERE id_proyecto = ?`;

    await query(sql, values);

    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Asignar empleado a proyecto
exports.asignarEmpleado = async (req, res) => {
  try {
    const { id_proyecto } = req.params;
    const {
      id_empleado,
      rol_en_proyecto,
      porcentaje_dedicacion
    } = req.body;

    if (!id_empleado || !rol_en_proyecto) {
      return res.status(400).json({
        success: false,
        message: 'ID de empleado y rol son requeridos'
      });
    }

    // Verificar si ya está asignado activamente
    const [asignacionExistente] = await query(
      `SELECT id_asignacion FROM asignaciones_proyecto 
       WHERE id_proyecto = ? AND id_empleado = ? AND activo = 1`,
      [id_proyecto, id_empleado]
    );

    if (asignacionExistente) {
      return res.status(409).json({
        success: false,
        message: 'El empleado ya está asignado a este proyecto'
      });
    }

    await query(
      `INSERT INTO asignaciones_proyecto 
       (id_proyecto, id_empleado, rol_en_proyecto, porcentaje_dedicacion)
       VALUES (?, ?, ?, ?)`,
      [id_proyecto, id_empleado, rol_en_proyecto, porcentaje_dedicacion || 100]
    );

    res.status(201).json({
      success: true,
      message: 'Empleado asignado al proyecto exitosamente'
    });

  } catch (error) {
    console.error('Error asignando empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Remover empleado de proyecto
exports.removerEmpleado = async (req, res) => {
  try {
    const { id_proyecto, id_empleado } = req.params;

    const result = await query(
      `UPDATE asignaciones_proyecto 
       SET activo = 0, fecha_desasignacion = CURDATE()
       WHERE id_proyecto = ? AND id_empleado = ? AND activo = 1`,
      [id_proyecto, id_empleado]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Asignación no encontrada o ya removida'
      });
    }

    res.json({
      success: true,
      message: 'Empleado removido del proyecto exitosamente'
    });

  } catch (error) {
    console.error('Error removiendo empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener proyectos del empleado
exports.getProyectosByEmpleado = async (req, res) => {
  try {
    const userId = req.userId;

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

    const proyectos = await query(
      `SELECT 
        p.*,
        ap.rol_en_proyecto,
        ap.porcentaje_dedicacion,
        ap.fecha_asignacion
      FROM asignaciones_proyecto ap
      JOIN proyectos p ON ap.id_proyecto = p.id_proyecto
      WHERE ap.id_empleado = ? AND ap.activo = 1
      ORDER BY p.fecha_inicio DESC`,
      [empleado.id_empleado]
    );

    res.json({
      success: true,
      data: proyectos
    });

  } catch (error) {
    console.error('Error obteniendo proyectos del empleado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
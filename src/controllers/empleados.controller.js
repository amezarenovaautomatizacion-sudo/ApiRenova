const { query } = require('../config/db');

// Obtener todos los empleados (con paginación y filtros)
exports.getAllEmpleados = async (req, res) => {
  try {
    // Obtener query params y asegurar que sean números donde corresponde
    const page = parseInt(req.query.page ?? '1', 10);
    const limit = parseInt(req.query.limit ?? '10', 10);
    const offset = (page - 1) * limit;
    const search = req.query.search ?? '';
    const departamento = req.query.departamento;
    const puesto = req.query.puesto;
    const activo = parseInt(req.query.activo ?? '1', 10);

    // Construir consulta base
    let baseQuery = `
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN empleados j ON e.id_jefe = j.id_empleado
      WHERE e.activo = ?
    `;
    
    const params = [activo];

    // Filtro de búsqueda
    if (search) {
      baseQuery += ` AND (
        e.nombre LIKE ? OR
        e.apellido LIKE ? OR
        e.identificacion LIKE ? OR
        u.email LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Filtro por departamento
    if (departamento) {
      baseQuery += ` AND e.id_departamento = ?`;
      params.push(departamento);
    }

    // Filtro por puesto
    if (puesto) {
      baseQuery += ` AND e.id_puesto = ?`;
      params.push(puesto);
    }

    // --- Conteo total ---
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await query(countQuery, params);
    const total = countResult[0]?.total ?? 0;

    // --- Obtener datos ---
    const dataQuery = `
      SELECT
        e.*,
        d.nombre_departamento,
        p.nombre_puesto,
        p.nivel,
        u.email,
        u.ultimo_login,
        CONCAT(j.nombre, ' ', j.apellido) as nombre_jefe
      ${baseQuery}
      ORDER BY e.fecha_contratacion DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const empleados = await query(dataQuery, dataParams);

    // Responder
    res.json({
      success: true,
      data: {
        empleados,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener un empleado por ID
exports.getEmpleadoById = async (req, res) => {
  try {
    const { id } = req.params;

    const empleados = await query(
      `SELECT 
        e.*,
        d.nombre_departamento,
        p.nombre_puesto,
        p.nivel,
        u.email,
        u.ultimo_login,
        u.fecha_creacion,
        CONCAT(j.nombre, ' ', j.apellido) as nombre_jefe,
        j.id_empleado as id_jefe
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN empleados j ON e.id_jefe = j.id_empleado
      WHERE e.id_empleado = ?`,
      [id]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Empleado no encontrado' 
      });
    }

    // Obtener proyectos activos del empleado
    const proyectos = await query(
      `SELECT 
        ap.*,
        p.nombre_proyecto,
        p.estado as estado_proyecto
      FROM asignaciones_proyecto ap
      JOIN proyectos p ON ap.id_proyecto = p.id_proyecto
      WHERE ap.id_empleado = ? AND ap.activo = 1`,
      [id]
    );

    // Obtener vacaciones recientes
    const vacaciones = await query(
      `SELECT 
        v.*,
        tv.nombre_tipo,
        ev.nombre_estado
      FROM vacaciones v
      JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
      JOIN estados_vacacion ev ON v.id_estado = ev.id_estado
      WHERE v.id_empleado = ?
      ORDER BY v.fecha_solicitud DESC
      LIMIT 5`,
      [id]
    );

    // Obtener asistencias del mes actual
    const asistencias = await query(
      `SELECT 
        fecha,
        estado,
        horas_trabajadas
      FROM asistencias 
      WHERE id_empleado = ? 
        AND YEAR(fecha) = YEAR(CURRENT_DATE)
        AND MONTH(fecha) = MONTH(CURRENT_DATE)
      ORDER BY fecha DESC`,
      [id]
    );

    const empleado = empleados[0];
    empleado.proyectos = proyectos;
    empleado.vacaciones = vacaciones;
    empleado.asistencias = asistencias;

    res.json({
      success: true,
      data: empleado
    });

  } catch (error) {
    console.error('Error obteniendo empleado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Crear nuevo empleado
exports.createEmpleado = async (req, res) => {
  try {
    const {
      id_usuario,
      id_departamento,
      id_puesto,
      id_jefe,
      nombre,
      apellido,
      identificacion,
      telefono,
      direccion,
      fecha_contratacion,
      fecha_nacimiento,
      salario_base
    } = req.body;

    // Validaciones básicas
    if (!nombre || !apellido || !identificacion || !fecha_contratacion || !fecha_nacimiento) {
      return res.status(400).json({ 
        success: false,
        message: 'Faltan campos requeridos' 
      });
    }

    // Verificar si la identificación ya existe
    const existente = await query(
      'SELECT id_empleado FROM empleados WHERE identificacion = ?',
      [identificacion]
    );

    if (existente.length > 0) {
      return res.status(409).json({ 
        success: false,
        message: 'La identificación ya está registrada' 
      });
    }

    // Verificar si el usuario ya tiene empleado
    if (id_usuario) {
      const usuarioEmpleado = await query(
        'SELECT id_empleado FROM empleados WHERE id_usuario = ?',
        [id_usuario]
      );

      if (usuarioEmpleado.length > 0) {
        return res.status(409).json({ 
          success: false,
          message: 'El usuario ya tiene un empleado asociado' 
        });
      }
    }

    // Insertar empleado
    const result = await query(
      `INSERT INTO empleados (
        id_usuario, id_departamento, id_puesto, id_jefe,
        nombre, apellido, identificacion, telefono,
        direccion, fecha_contratacion, fecha_nacimiento, salario_base
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_usuario || null,
        id_departamento || null,
        id_puesto || null,
        id_jefe || null,
        nombre,
        apellido,
        identificacion,
        telefono || null,
        direccion || null,
        fecha_contratacion,
        fecha_nacimiento,
        salario_base || 0
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente',
      data: {
        id_empleado: result.insertId
      }
    });

  } catch (error) {
    console.error('Error creando empleado:', error);
    
    // Manejar errores específicos de MySQL
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ 
        success: false,
        message: 'Referencia inválida (departamento, puesto o jefe no existe)' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Actualizar empleado
exports.updateEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar si el empleado existe
    const empleados = await query(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ?',
      [id]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Empleado no encontrado' 
      });
    }

    // Construir SET dinámico
    const allowedFields = [
      'id_departamento', 'id_puesto', 'id_jefe', 'nombre', 'apellido',
      'telefono', 'direccion', 'fecha_contratacion', 'fecha_nacimiento',
      'salario_base', 'activo'
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

    // No permitir cambiar la identificación
    if (updateData.identificacion) {
      const existente = await query(
        'SELECT id_empleado FROM empleados WHERE identificacion = ? AND id_empleado != ?',
        [updateData.identificacion, id]
      );

      if (existente.length > 0) {
        return res.status(409).json({ 
          success: false,
          message: 'La identificación ya está en uso por otro empleado' 
        });
      }
    }

    values.push(id);
    
    const sql = `UPDATE empleados SET ${setClauses.join(', ')} WHERE id_empleado = ?`;
    
    await query(sql, values);

    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando empleado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Eliminar empleado (soft delete)
exports.deleteEmpleado = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el empleado existe
    const empleados = await query(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ?',
      [id]
    );

    if (empleados.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Empleado no encontrado' 
      });
    }

    // Soft delete: marcar como inactivo
    await query(
      'UPDATE empleados SET activo = 0 WHERE id_empleado = ?',
      [id]
    );

    // También desactivar asignaciones de proyectos
    await query(
      'UPDATE asignaciones_proyecto SET activo = 0 WHERE id_empleado = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Empleado eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando empleado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};

// Obtener estadísticas de empleados
exports.getEstadisticas = async (req, res) => {
  try {
    // Total empleados activos
    const [totalActivos] = await query(
      'SELECT COUNT(*) as total FROM empleados WHERE activo = 1'
    );

    // Empleados por departamento
    const porDepartamento = await query(
      `SELECT 
        d.nombre_departamento,
        COUNT(e.id_empleado) as cantidad
      FROM departamentos d
      LEFT JOIN empleados e ON d.id_departamento = e.id_departamento AND e.activo = 1
      GROUP BY d.id_departamento
      ORDER BY cantidad DESC`
    );

    // Empleados por puesto
    const porPuesto = await query(
      `SELECT 
        p.nombre_puesto,
        p.nivel,
        COUNT(e.id_empleado) as cantidad
      FROM puestos p
      LEFT JOIN empleados e ON p.id_puesto = e.id_puesto AND e.activo = 1
      GROUP BY p.id_puesto
      ORDER BY cantidad DESC`
    );

    // Últimas contrataciones
    const ultimasContrataciones = await query(
      `SELECT 
        e.nombre,
        e.apellido,
        e.fecha_contratacion,
        d.nombre_departamento,
        p.nombre_puesto
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      WHERE e.activo = 1
      ORDER BY e.fecha_contratacion DESC
      LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        totalActivos: totalActivos.total,
        porDepartamento,
        porPuesto,
        ultimasContrataciones
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
};
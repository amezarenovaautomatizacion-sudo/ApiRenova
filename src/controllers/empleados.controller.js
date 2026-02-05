const { query } = require('../config/db');

// Obtener todos los empleados (con paginación y filtros)
exports.getAllEmpleados = async (req, res) => {
  try {
    const page = parseInt(req.query.page ?? '1', 10);
    const limit = parseInt(req.query.limit ?? '10', 10);
    const offset = (page - 1) * limit;
    const search = req.query.search ?? '';
    const departamento = req.query.departamento;
    const puesto = req.query.puesto;
    const activo = parseInt(req.query.activo ?? '1', 10);

    let baseQuery = `
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN empleados j ON e.id_jefe = j.id_empleado
      WHERE e.activo = ?
    `;

    const params = [activo];

    if (search) {
      baseQuery += ` AND (
        e.nombre LIKE ? OR
        e.apellido LIKE ? OR
        e.identificacion LIKE ? OR
        u.email LIKE ?
      )`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (departamento) {
      baseQuery += ` AND e.id_departamento = ?`;
      params.push(departamento);
    }

    if (puesto) {
      baseQuery += ` AND e.id_puesto = ?`;
      params.push(puesto);
    }

    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await query(countQuery, params);
    const total = countResult[0]?.total ?? 0;

    const dataQuery = `
      SELECT
        e.*,
        d.nombre_departamento,
        p.nombre_puesto,
        p.nivel,
        u.email,
        u.ultimo_login,
        CONCAT(j.nombre, ' ', j.apellido) AS nombre_jefe
      ${baseQuery}
      ORDER BY e.fecha_contratacion DESC
      LIMIT ? OFFSET ?
    `;

    const empleados = await query(dataQuery, [...params, limit, offset]);

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
        CONCAT(j.nombre, ' ', j.apellido) AS nombre_jefe,
        j.id_empleado AS id_jefe
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

    const proyectos = await query(
      `SELECT 
        ap.*,
        p.nombre_proyecto,
        p.estado AS estado_proyecto
      FROM asignaciones_proyecto ap
      JOIN proyectos p ON ap.id_proyecto = p.id_proyecto
      WHERE ap.id_empleado = ? AND ap.activo = 1`,
      [id]
    );

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

// Crear nuevo empleado (con nuevos campos)
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
      salario_base,
      // Nuevos campos
      celular,
      correo_personal,
      direccion_completa,
      nss,
      rfc,
      curp,
      telefono_emergencia,
      contacto_emergencia,
      parentesco_emergencia
    } = req.body;

    if (!nombre || !apellido || !identificacion || !fecha_contratacion || !fecha_nacimiento) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }

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

    if (nss) {
      const nssExistente = await query(
        'SELECT id_empleado FROM empleados WHERE nss = ?',
        [nss]
      );
      if (nssExistente.length > 0) {
        return res.status(409).json({ success: false, message: 'El NSS ya está registrado' });
      }
    }

    if (rfc) {
      const rfcExistente = await query(
        'SELECT id_empleado FROM empleados WHERE rfc = ?',
        [rfc]
      );
      if (rfcExistente.length > 0) {
        return res.status(409).json({ success: false, message: 'El RFC ya está registrado' });
      }
    }

    if (curp) {
      const curpExistente = await query(
        'SELECT id_empleado FROM empleados WHERE curp = ?',
        [curp]
      );
      if (curpExistente.length > 0) {
        return res.status(409).json({ success: false, message: 'La CURP ya está registrada' });
      }
    }

    const result = await query(
      `INSERT INTO empleados (
        id_usuario, id_departamento, id_puesto, id_jefe,
        nombre, apellido, identificacion, telefono,
        direccion, fecha_contratacion, fecha_nacimiento, salario_base,
        celular, correo_personal, direccion_completa, nss,
        rfc, curp, telefono_emergencia, contacto_emergencia,
        parentesco_emergencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        salario_base || 0,
        celular || null,
        correo_personal || null,
        direccion_completa || null,
        nss || null,
        rfc || null,
        curp || null,
        telefono_emergencia || null,
        contacto_emergencia || null,
        parentesco_emergencia || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente',
      data: { id_empleado: result.insertId }
    });

  } catch (error) {
    console.error('Error creando empleado:', error);
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

    const allowedFields = [
      'id_departamento', 'id_puesto', 'id_jefe', 'nombre', 'apellido',
      'telefono', 'direccion', 'fecha_contratacion', 'fecha_nacimiento',
      'salario_base', 'activo', 'celular', 'correo_personal',
      'direccion_completa', 'nss', 'rfc', 'curp',
      'telefono_emergencia', 'contacto_emergencia', 'parentesco_emergencia'
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

    await query('UPDATE empleados SET activo = 0 WHERE id_empleado = ?', [id]);
    await query('UPDATE asignaciones_proyecto SET activo = 0 WHERE id_empleado = ?', [id]);

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

// Obtener estadísticas
exports.getEstadisticas = async (req, res) => {
  try {
    const [totalActivos] = await query(
      'SELECT COUNT(*) AS total FROM empleados WHERE activo = 1'
    );

    const porDepartamento = await query(
      `SELECT d.nombre_departamento, COUNT(e.id_empleado) AS cantidad
       FROM departamentos d
       LEFT JOIN empleados e ON d.id_departamento = e.id_departamento AND e.activo = 1
       GROUP BY d.id_departamento`
    );

    const porPuesto = await query(
      `SELECT p.nombre_puesto, p.nivel, COUNT(e.id_empleado) AS cantidad
       FROM puestos p
       LEFT JOIN empleados e ON p.id_puesto = e.id_puesto AND e.activo = 1
       GROUP BY p.id_puesto`
    );

    res.json({
      success: true,
      data: {
        totalActivos: totalActivos.total,
        porDepartamento,
        porPuesto
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

const { query } = require('../config/db');

// Asignar jefe a empleado
exports.asignarJefe = async (req, res) => {
  try {
    const { id_empleado, id_jefe } = req.body;

    if (!id_empleado || !id_jefe) {
      return res.status(400).json({
        success: false,
        message: 'ID de empleado y jefe son requeridos'
      });
    }

    // Verificar que no sea auto-asignación
    if (id_empleado === id_jefe) {
      return res.status(400).json({
        success: false,
        message: 'Un empleado no puede ser su propio jefe'
      });
    }

    // Verificar que ambos empleados existen y están activos
    const [empleado] = await query(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ? AND activo = 1',
      [id_empleado]
    );

    const [jefe] = await query(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ? AND activo = 1',
      [id_jefe]
    );

    if (!empleado || !jefe) {
      return res.status(404).json({
        success: false,
        message: 'Empleado o jefe no encontrado o inactivo'
      });
    }

    // Actualizar jefe
    await query(
      'UPDATE empleados SET id_jefe = ? WHERE id_empleado = ?',
      [id_jefe, id_empleado]
    );

    // Registrar en historial
    await query(
      `INSERT INTO jefes_directos (id_empleado, id_jefe, tipo_jefatura)
       VALUES (?, ?, 'directo')`,
      [id_empleado, id_jefe]
    );

    res.json({
      success: true,
      message: 'Jefe asignado exitosamente'
    });
  } catch (error) {
    console.error('Error asignando jefe:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener empleados por jefe
exports.getEmpleadosPorJefe = async (req, res) => {
  try {
    const userId = req.userId;

    // Obtener el ID del empleado que es jefe
    const [jefe] = await query(
      'SELECT id_empleado FROM empleados WHERE id_usuario = ? AND activo = 1',
      [userId]
    );

    if (!jefe) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    // Obtener empleados que tienen a este empleado como jefe
    const empleados = await query(`
      SELECT 
        e.*,
        d.nombre_departamento,
        p.nombre_puesto,
        u.email,
        (SELECT COUNT(*) FROM vacaciones v 
         WHERE v.id_empleado = e.id_empleado AND v.id_estado = 1) as vacaciones_pendientes,
        (SELECT COUNT(*) FROM asistencias a 
         WHERE a.id_empleado = e.id_empleado AND a.fecha = CURDATE()) as asistencia_hoy
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      WHERE e.id_jefe = ? AND e.activo = 1
      ORDER BY e.nombre, e.apellido
    `, [jefe.id_empleado]);

    res.json({
      success: true,
      data: {
        jefe: {
          id_empleado: jefe.id_empleado,
          total_empleados: empleados.length
        },
        empleados
      }
    });
  } catch (error) {
    console.error('Error obteniendo empleados por jefe:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener jerarquía completa
exports.getJerarquia = async (req, res) => {
  try {
    const jerarquia = await query(`
      WITH RECURSIVE jerarquia_cte AS (
        -- Empleados sin jefe (nivel más alto)
        SELECT 
          id_empleado,
          CONCAT(nombre, ' ', apellido) as nombre_completo,
          id_departamento,
          id_puesto,
          id_jefe,
          1 as nivel,
          CAST(id_empleado AS CHAR(200)) as path
        FROM empleados
        WHERE id_jefe IS NULL AND activo = 1
        
        UNION ALL
        
        -- Empleados con jefe
        SELECT 
          e.id_empleado,
          CONCAT(e.nombre, ' ', e.apellido) as nombre_completo,
          e.id_departamento,
          e.id_puesto,
          e.id_jefe,
          jc.nivel + 1 as nivel,
          CONCAT(jc.path, '->', e.id_empleado) as path
        FROM empleados e
        INNER JOIN jerarquia_cte jc ON e.id_jefe = jc.id_empleado
        WHERE e.activo = 1
      )
      SELECT 
        jc.*,
        d.nombre_departamento,
        p.nombre_puesto
      FROM jerarquia_cte jc
      LEFT JOIN departamentos d ON jc.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON jc.id_puesto = p.id_puesto
      ORDER BY jc.nivel, jc.nombre_completo
    `);

    res.json({
      success: true,
      data: jerarquia
    });
  } catch (error) {
    console.error('Error obteniendo jerarquía:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Cambiar jefe de un empleado
exports.cambiarJefe = async (req, res) => {
  try {
    const { id_empleado } = req.params;
    const { id_nuevo_jefe } = req.body;

    if (!id_nuevo_jefe) {
      return res.status(400).json({
        success: false,
        message: 'ID del nuevo jefe es requerido'
      });
    }

    // Verificar que el empleado existe
    const [empleado] = await query(
      'SELECT id_jefe FROM empleados WHERE id_empleado = ? AND activo = 1',
      [id_empleado]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado o inactivo'
      });
    }

    // Finalizar relación actual en historial
    await query(
      `UPDATE jefes_directos 
       SET fecha_fin = CURDATE() 
       WHERE id_empleado = ? AND id_jefe = ? AND fecha_fin IS NULL`,
      [id_empleado, empleado.id_jefe]
    );

    // Asignar nuevo jefe
    await query(
      'UPDATE empleados SET id_jefe = ? WHERE id_empleado = ?',
      [id_nuevo_jefe, id_empleado]
    );

    // Registrar nueva relación
    await query(
      `INSERT INTO jefes_directos (id_empleado, id_jefe, tipo_jefatura)
       VALUES (?, ?, 'directo')`,
      [id_empleado, id_nuevo_jefe]
    );

    res.json({
      success: true,
      message: 'Jefe cambiado exitosamente'
    });
  } catch (error) {
    console.error('Error cambiando jefe:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
const { query } = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.userId;

    // Obtener usuario y empleado
    const [usuario] = await query(
      `SELECT u.*, 
        GROUP_CONCAT(r.nombre_rol) as roles
      FROM usuarios u
      LEFT JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      WHERE u.id_usuario = ?
      GROUP BY u.id_usuario`,
      [userId]
    );

    let dashboardData = {
      usuario: {
        email: usuario.email,
        roles: usuario.roles ? usuario.roles.split(',') : [],
        ultimo_login: usuario.ultimo_login
      },
      estadisticas: {},
      notificaciones: [],
      actividadesRecientes: []
    };

    // Si el usuario tiene empleado asociado
    const [empleado] = await query(
      `SELECT e.*, d.nombre_departamento, p.nombre_puesto
       FROM empleados e
       LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
       LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
       WHERE e.id_usuario = ? AND e.activo = 1`,
      [userId]
    );

    if (empleado) {
      dashboardData.empleado = empleado;

      // Estadísticas del empleado
      const [estadisticas] = await query(
        `SELECT 
          (SELECT COUNT(*) FROM asistencias 
           WHERE id_empleado = ? AND MONTH(fecha) = MONTH(CURRENT_DATE)) as asistencias_mes,
          (SELECT COUNT(*) FROM vacaciones 
           WHERE id_empleado = ? AND id_estado = 2 AND YEAR(fecha_inicio) = YEAR(CURRENT_DATE)) as vacaciones_aprobadas,
          (SELECT COUNT(*) FROM asignaciones_proyecto 
           WHERE id_empleado = ? AND activo = 1) as proyectos_activos`,
        [empleado.id_empleado, empleado.id_empleado, empleado.id_empleado]
      );

      dashboardData.estadisticas = estadisticas;

      // Vacaciones pendientes
      const vacacionesPendientes = await query(
        `SELECT v.*, tv.nombre_tipo
         FROM vacaciones v
         JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
         WHERE v.id_empleado = ? AND v.id_estado = 1
         ORDER BY v.fecha_solicitud DESC
         LIMIT 5`,
        [empleado.id_empleado]
      );

      if (vacacionesPendientes.length > 0) {
        dashboardData.notificaciones.push({
          tipo: 'vacaciones',
          mensaje: `Tiene ${vacacionesPendientes.length} solicitud(es) de vacaciones pendientes`,
          data: vacacionesPendientes
        });
      }

      // Asistencias del mes
      const asistenciasMes = await query(
        `SELECT fecha, estado, horas_trabajadas
         FROM asistencias
         WHERE id_empleado = ? AND MONTH(fecha) = MONTH(CURRENT_DATE)
         ORDER BY fecha DESC
         LIMIT 10`,
        [empleado.id_empleado]
      );

      dashboardData.actividadesRecientes = asistenciasMes;
    }

    // Si el usuario es admin/gerente, obtener estadísticas globales
    if (usuario.roles && (usuario.roles.includes('admin') || usuario.roles.includes('gerente'))) {
      const [estadisticasGlobales] = await query(`
        SELECT 
          (SELECT COUNT(*) FROM empleados WHERE activo = 1) as total_empleados,
          (SELECT COUNT(*) FROM vacaciones WHERE id_estado = 1) as vacaciones_pendientes,
          (SELECT COUNT(*) FROM proyectos WHERE estado = 'en_progreso') as proyectos_activos,
          (SELECT COUNT(*) FROM asistencias WHERE fecha = CURDATE()) as asistencias_hoy
      `);

      dashboardData.estadisticasGlobales = estadisticasGlobales;

      // Vacaciones que requieren aprobación
      const vacacionesPorAprobar = await query(`
        SELECT v.*, e.nombre, e.apellido, tv.nombre_tipo
        FROM vacaciones v
        JOIN empleados e ON v.id_empleado = e.id_empleado
        JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
        WHERE v.id_estado = 1
        ORDER BY v.fecha_solicitud DESC
        LIMIT 5
      `);

      if (vacacionesPorAprobar.length > 0) {
        dashboardData.notificaciones.push({
          tipo: 'aprobacion',
          mensaje: `Hay ${vacacionesPorAprobar.length} solicitud(es) de vacaciones por aprobar`,
          data: vacacionesPorAprobar
        });
      }
    }

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
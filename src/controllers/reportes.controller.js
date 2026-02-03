const { query } = require('../config/db');

// Reporte general de empleados
exports.reporteEmpleados = async (req, res) => {
  try {
    const { formato = 'json', fecha_inicio, fecha_fin } = req.query;

    // Empleados activos con detalles
    const empleados = await query(`
      SELECT 
        e.*,
        d.nombre_departamento,
        p.nombre_puesto,
        p.nivel,
        u.email,
        CONCAT(j.nombre, ' ', j.apellido) as nombre_jefe
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN usuarios u ON e.id_usuario = u.id_usuario
      LEFT JOIN empleados j ON e.id_jefe = j.id_empleado
      WHERE e.activo = 1
      ORDER BY d.nombre_departamento, p.nivel, e.fecha_contratacion
    `);

    // Estadísticas
    const [estadisticas] = await query(`
      SELECT 
        COUNT(*) as total_empleados,
        COUNT(DISTINCT id_departamento) as total_departamentos,
        AVG(salario_base) as salario_promedio,
        MIN(fecha_contratacion) as contratacion_mas_antigua,
        MAX(fecha_contratacion) as contratacion_mas_reciente
      FROM empleados
      WHERE activo = 1
    `);

    // Distribución por departamento
    const distribucionDepartamento = await query(`
      SELECT 
        d.nombre_departamento,
        COUNT(e.id_empleado) as cantidad,
        ROUND(COUNT(e.id_empleado) * 100.0 / (SELECT COUNT(*) FROM empleados WHERE activo = 1), 2) as porcentaje,
        AVG(e.salario_base) as salario_promedio
      FROM departamentos d
      LEFT JOIN empleados e ON d.id_departamento = e.id_departamento AND e.activo = 1
      GROUP BY d.id_departamento
      ORDER BY cantidad DESC
    `);

    const reporte = {
      metadata: {
        generado: new Date().toISOString(),
        periodo: fecha_inicio && fecha_fin ? `${fecha_inicio} - ${fecha_fin}` : 'Completo',
        totalRegistros: empleados.length
      },
      estadisticas,
      distribucionDepartamento,
      empleados
    };

    if (formato === 'csv') {
      // Convertir a CSV (simplificado)
      let csv = 'ID,Nombre,Apellido,Identificacion,Email,Telefono,Departamento,Puesto,Salario,Fecha Contratacion\n';
      empleados.forEach(emp => {
        csv += `${emp.id_empleado},"${emp.nombre}","${emp.apellido}","${emp.identificacion}","${emp.email || ''}","${emp.telefono || ''}","${emp.nombre_departamento || ''}","${emp.nombre_puesto || ''}",${emp.salario_base || 0},"${emp.fecha_contratacion}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_empleados.csv');
      return res.send(csv);
    }

    res.json({
      success: true,
      data: reporte
    });

  } catch (error) {
    console.error('Error generando reporte de empleados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Reporte de asistencias
exports.reporteAsistencias = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_departamento, formato = 'json' } = req.query;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({
        success: false,
        message: 'Fecha inicio y fecha fin son requeridas'
      });
    }

    let queryStr = `
      SELECT 
        a.*,
        e.nombre,
        e.apellido,
        e.identificacion,
        d.nombre_departamento,
        p.nombre_puesto
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id_empleado
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      WHERE a.fecha BETWEEN ? AND ?
        AND e.activo = 1
    `;

    const params = [fecha_inicio, fecha_fin];

    if (id_departamento) {
      queryStr += ` AND e.id_departamento = ?`;
      params.push(id_departamento);
    }

    queryStr += ` ORDER BY a.fecha DESC, e.apellido, e.nombre`;

    const asistencias = await query(queryStr, params);

    // Estadísticas
    const [estadisticas] = await query(`
      SELECT 
        COUNT(DISTINCT a.id_empleado) as empleados_con_registros,
        COUNT(*) as total_registros,
        AVG(a.horas_trabajadas) as promedio_horas,
        SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) as total_ausencias,
        SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END) as total_tardanzas,
        SUM(a.horas_trabajadas) as horas_totales
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id_empleado
      WHERE a.fecha BETWEEN ? AND ?
        AND e.activo = 1
      ${id_departamento ? 'AND e.id_departamento = ?' : ''}
    `, params);

    // Resumen por empleado
    const resumenEmpleado = await query(`
      SELECT 
        e.id_empleado,
        e.nombre,
        e.apellido,
        d.nombre_departamento,
        COUNT(a.id_asistencia) as dias_trabajados,
        SUM(a.horas_trabajadas) as horas_totales,
        AVG(a.horas_trabajadas) as horas_promedio,
        SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) as dias_ausente
      FROM empleados e
      LEFT JOIN asistencias a ON e.id_empleado = a.id_empleado 
        AND a.fecha BETWEEN ? AND ?
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      WHERE e.activo = 1
      ${id_departamento ? 'AND e.id_departamento = ?' : ''}
      GROUP BY e.id_empleado
      ORDER BY horas_totales DESC
    `, params);

    const reporte = {
      metadata: {
        generado: new Date().toISOString(),
        periodo: `${fecha_inicio} - ${fecha_fin}`,
        departamento: id_departamento || 'Todos',
        totalRegistros: asistencias.length
      },
      estadisticas,
      resumenEmpleado,
      detalleAsistencias: asistencias
    };

    if (formato === 'csv') {
      let csv = 'ID,Fecha,Empleado,Identificacion,Departamento,Puesto,Entrada,Salida,Horas,Estado,Observaciones\n';
      asistencias.forEach(a => {
        csv += `${a.id_asistencia},${a.fecha},"${a.nombre} ${a.apellido}",${a.identificacion},"${a.nombre_departamento || ''}","${a.nombre_puesto || ''}",${a.hora_entrada || ''},${a.hora_salida || ''},${a.horas_trabajadas || 0},"${a.estado}","${a.observaciones || ''}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=asistencias_${fecha_inicio}_${fecha_fin}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: reporte
    });

  } catch (error) {
    console.error('Error generando reporte de asistencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Reporte de vacaciones
exports.reporteVacaciones = async (req, res) => {
  try {
    const { año = new Date().getFullYear(), id_departamento, formato = 'json' } = req.query;

    const reporte = await query(`
      SELECT 
        e.id_empleado,
        e.nombre,
        e.apellido,
        d.nombre_departamento,
        p.nombre_puesto,
        COUNT(v.id_vacacion) as total_solicitudes,
        SUM(CASE WHEN v.id_estado = 2 THEN v.dias_solicitados ELSE 0 END) as dias_aprobados,
        SUM(CASE WHEN v.id_estado = 3 THEN v.dias_solicitados ELSE 0 END) as dias_rechazados,
        SUM(CASE WHEN v.id_estado = 1 THEN v.dias_solicitados ELSE 0 END) as dias_pendientes,
        GROUP_CONCAT(DISTINCT tv.nombre_tipo) as tipos_usados
      FROM empleados e
      LEFT JOIN vacaciones v ON e.id_empleado = v.id_empleado 
        AND YEAR(v.fecha_solicitud) = ?
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      LEFT JOIN tipos_vacacion tv ON v.id_tipo_vacacion = tv.id_tipo
      WHERE e.activo = 1
      ${id_departamento ? 'AND e.id_departamento = ?' : ''}
      GROUP BY e.id_empleado
      ORDER BY d.nombre_departamento, e.apellido, e.nombre
    `, id_departamento ? [año, id_departamento] : [año]);

    // Resumen por tipo
    const resumenTipo = await query(`
      SELECT 
        tv.nombre_tipo,
        COUNT(v.id_vacacion) as total_solicitudes,
        SUM(v.dias_solicitados) as total_dias,
        AVG(v.dias_solicitados) as promedio_dias,
        SUM(CASE WHEN v.id_estado = 2 THEN 1 ELSE 0 END) as aprobadas,
        SUM(CASE WHEN v.id_estado = 3 THEN 1 ELSE 0 END) as rechazadas
      FROM tipos_vacacion tv
      LEFT JOIN vacaciones v ON tv.id_tipo = v.id_tipo_vacacion 
        AND YEAR(v.fecha_solicitud) = ?
      GROUP BY tv.id_tipo
      ORDER BY tv.id_tipo
    `, [año]);

    // Distribución mensual
    const distribucionMensual = await query(`
      SELECT 
        MONTH(fecha_solicitud) as mes,
        COUNT(*) as solicitudes,
        SUM(dias_solicitados) as total_dias,
        AVG(dias_solicitados) as promedio_dias
      FROM vacaciones
      WHERE YEAR(fecha_solicitud) = ?
        AND id_estado = 2
      GROUP BY MONTH(fecha_solicitud)
      ORDER BY mes
    `, [año]);

    const resultado = {
      metadata: {
        generado: new Date().toISOString(),
        año,
        departamento: id_departamento || 'Todos',
        totalEmpleados: reporte.length
      },
      resumenTipo,
      distribucionMensual,
      detalleEmpleados: reporte
    };

    if (formato === 'csv') {
      let csv = 'ID Empleado,Nombre,Apellido,Departamento,Puesto,Solicitudes,Días Aprobados,Días Rechazados,Días Pendientes,Tipos Usados\n';
      reporte.forEach(r => {
        csv += `${r.id_empleado},"${r.nombre}","${r.apellido}","${r.nombre_departamento || ''}","${r.nombre_puesto || ''}",${r.total_solicitudes},${r.dias_aprobados || 0},${r.dias_rechazados || 0},${r.dias_pendientes || 0},"${r.tipos_usados || ''}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=vacaciones_${año}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error('Error generando reporte de vacaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Reporte de nómina (ejemplo simplificado)
exports.reporteNomina = async (req, res) => {
  try {
    const { mes, año, formato = 'json' } = req.query;
    const mesActual = mes || new Date().getMonth() + 1;
    const añoActual = año || new Date().getFullYear();

    const reporte = await query(`
      SELECT 
        e.id_empleado,
        e.nombre,
        e.apellido,
        e.identificacion,
        d.nombre_departamento,
        p.nombre_puesto,
        e.salario_base,
        e.salario_base as salario_neto,
        'Pendiente' as estado_pago,
        CURDATE() as fecha_generacion
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN puestos p ON e.id_puesto = p.id_puesto
      WHERE e.activo = 1
      ORDER BY d.nombre_departamento, e.apellido, e.nombre
    `);

    const [totales] = await query(`
      SELECT 
        COUNT(*) as total_empleados,
        SUM(salario_base) as total_nomina,
        AVG(salario_base) as promedio_salario
      FROM empleados
      WHERE activo = 1
    `);

    const resultado = {
      metadata: {
        generado: new Date().toISOString(),
        periodo: `${mesActual}/${añoActual}`,
        totales
      },
      detalle: reporte
    };

    if (formato === 'csv') {
      let csv = 'ID,Nombre,Apellido,Identificacion,Departamento,Puesto,Salario Base,Salario Neto,Estado Pago,Fecha Generacion\n';
      reporte.forEach(r => {
        csv += `${r.id_empleado},"${r.nombre}","${r.apellido}","${r.identificacion}","${r.nombre_departamento || ''}","${r.nombre_puesto || ''}",${r.salario_base},${r.salario_neto},"${r.estado_pago}","${r.fecha_generacion}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=nomina_${mesActual}_${añoActual}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: resultado
    });

  } catch (error) {
    console.error('Error generando reporte de nómina:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
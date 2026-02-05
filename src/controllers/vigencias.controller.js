const { query } = require('../config/db');

// Calcular vigencias para un empleado
exports.calcularVigenciasEmpleado = async (req, res) => {
  try {
    const userId = req.userId;

    const [empleado] = await query(
      'SELECT id_empleado, fecha_contratacion FROM empleados WHERE id_usuario = ? AND activo = 1',
      [userId]
    );

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    const fechaContratacion = new Date(empleado.fecha_contratacion);
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    
    // Calcular años de antigüedad
    const antiguedadAnios = hoy.getFullYear() - fechaContratacion.getFullYear();
    
    // Calcular fecha de derecho (1 año después de contratación)
    const fechaDerecho = new Date(fechaContratacion);
    fechaDerecho.setFullYear(fechaDerecho.getFullYear() + 1);
    
    // Si ya pasó el primer año
    let vigenciaInfo = null;
    if (hoy >= fechaDerecho) {
      // Calcular período de 6 meses
      const fechaInicioPeriodo = new Date(fechaDerecho);
      const fechaFinPeriodo = new Date(fechaDerecho);
      fechaFinPeriodo.setMonth(fechaFinPeriodo.getMonth() + 6);
      
      // Verificar si ya existe vigencia para este año
      const [vigenciaExistente] = await query(
        'SELECT * FROM vigencias_vacacionales WHERE id_empleado = ? AND ano_ejercicio = ?',
        [empleado.id_empleado, anoActual]
      );
      
      if (!vigenciaExistente) {
        // Crear nueva vigencia
        const result = await query(
          `INSERT INTO vigencias_vacacionales 
           (id_empleado, ano_ejercicio, fecha_derecho, fecha_inicio_periodo, 
            fecha_fin_periodo, dias_disponibles, estado)
           VALUES (?, ?, ?, ?, ?, 12, 'en_progreso')`,
          [
            empleado.id_empleado,
            anoActual,
            fechaDerecho.toISOString().split('T')[0],
            fechaInicioPeriodo.toISOString().split('T')[0],
            fechaFinPeriodo.toISOString().split('T')[0]
          ]
        );
        
        vigenciaInfo = {
          id_vigencia: result.insertId,
          mensaje: 'Nueva vigencia creada',
          fecha_derecho: fechaDerecho.toISOString().split('T')[0],
          fecha_inicio_periodo: fechaInicioPeriodo.toISOString().split('T')[0],
          fecha_fin_periodo: fechaFinPeriodo.toISOString().split('T')[0],
          dias_disponibles: 12,
          estado: 'en_progreso'
        };
      } else {
        vigenciaInfo = vigenciaExistente;
      }
      
      // Verificar si está por vencer (último mes)
      const fechaFin = new Date(vigenciaInfo.fecha_fin_periodo);
      const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes <= 30 && !vigenciaInfo.notificado_vencimiento) {
        // Notificar al empleado (implementar)
        await query(
          'UPDATE vigencias_vacacionales SET notificado_vencimiento = 1 WHERE id_vigencia = ?',
          [vigenciaInfo.id_vigencia]
        );
        
        vigenciaInfo.notificado_vencimiento = true;
        vigenciaInfo.mensaje_vencimiento = `¡Atención! Tu período vacacional vence en ${diasRestantes} días`;
      }
      
      // Programar automáticamente si faltan menos de 30 días y no se han tomado vacaciones
      if (diasRestantes <= 30 && vigenciaInfo.dias_disfrutados === 0 && !vigenciaInfo.fecha_programacion_auto) {
        const fechaProgramacion = new Date(fechaFin);
        fechaProgramacion.setFullYear(fechaProgramacion.getFullYear() - 1);
        
        await query(
          'UPDATE vigencias_vacacionales SET estado = "programado", fecha_programacion_auto = ? WHERE id_vigencia = ?',
          [hoy.toISOString().split('T')[0], vigenciaInfo.id_vigencia]
        );
        
        vigenciaInfo.estado = 'programado';
        vigenciaInfo.fecha_programacion_auto = hoy.toISOString().split('T')[0];
        vigenciaInfo.mensaje_programacion = 'Vacaciones programadas automáticamente para el próximo año';
      }
    }

    // Calcular días faltantes para el primer derecho
    let diasParaPrimerDerecho = null;
    if (hoy < fechaDerecho) {
      diasParaPrimerDerecho = Math.ceil((fechaDerecho - hoy) / (1000 * 60 * 60 * 24));
    }

    // Obtener historial de vigencias
    const vigenciasHistorial = await query(
      'SELECT * FROM vigencias_vacacionales WHERE id_empleado = ? ORDER BY ano_ejercicio DESC',
      [empleado.id_empleado]
    );

    res.json({
      success: true,
      data: {
        empleado: {
          id_empleado: empleado.id_empleado,
          fecha_contratacion: empleado.fecha_contratacion,
          antiguedad_anios: antiguedadAnios
        },
        dias_para_primer_derecho: diasParaPrimerDerecho,
        vigencia_actual: vigenciaInfo,
        historial: vigenciasHistorial,
        resumen: {
          total_vigencias: vigenciasHistorial.length,
          total_dias_disponibles: vigenciasHistorial.reduce((sum, v) => sum + (v.dias_disponibles || 0), 0),
          total_dias_disfrutados: vigenciasHistorial.reduce((sum, v) => sum + (v.dias_disfrutados || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error calculando vigencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar días disfrutados en vigencia
exports.actualizarDiasDisfrutados = async (id_empleado, ano_ejercicio, dias) => {
  try {
    await query(
      `UPDATE vigencias_vacacionales 
       SET dias_disfrutados = dias_disfrutados + ?, 
           dias_pendientes = dias_disponibles - (dias_disfrutados + ?)
       WHERE id_empleado = ? AND ano_ejercicio = ?`,
      [dias, dias, id_empleado, ano_ejercicio]
    );
    
    return true;
  } catch (error) {
    console.error('Error actualizando días disfrutados:', error);
    return false;
  }
};

// Verificar y notificar vigencias por vencer (tarea programada)
exports.verificarVigenciasPorVencer = async () => {
  try {
    const vigenciasPorVencer = await query(`
      SELECT 
        v.*,
        e.nombre,
        e.apellido,
        e.correo_personal
      FROM vigencias_vacacionales v
      JOIN empleados e ON v.id_empleado = e.id_empleado
      WHERE v.estado = 'en_progreso'
        AND DATEDIFF(v.fecha_fin_periodo, CURDATE()) <= 30
        AND v.notificado_vencimiento = 0
        AND e.activo = 1
    `);

    for (const vigencia of vigenciasPorVencer) {
      // Aquí implementar envío de notificación
      console.log(`Notificar a ${vigencia.nombre} ${vigencia.apellido}: Su período vacacional vence en ${vigencia.dias_restantes} días`);
      
      // Marcar como notificado
      await query(
        'UPDATE vigencias_vacacionales SET notificado_vencimiento = 1 WHERE id_vigencia = ?',
        [vigencia.id_vigencia]
      );
    }

    return vigenciasPorVencer.length;
  } catch (error) {
    console.error('Error verificando vigencias:', error);
    return 0;
  }
};
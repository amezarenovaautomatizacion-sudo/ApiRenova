const cron = require('node-cron');
const { query } = require('../config/db');
const vigenciasController = require('../controllers/vigencias.controller');

// Verificar vigencias por vencer cada día a las 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Ejecutando tarea programada: Verificar vigencias por vencer');
  const count = await vigenciasController.verificarVigenciasPorVencer();
  console.log(`Se verificaron ${count} vigencias por vencer`);
});

// Programar vacaciones automáticas para el próximo año
cron.schedule('0 9 * * *', async () => {
  console.log('Ejecutando tarea programada: Programar vacaciones automáticas');
  
  // Encontrar vigencias que vencen en menos de 30 días y no se han disfrutado
  const vigencias = await query(`
    SELECT 
      v.*,
      e.nombre,
      e.apellido
    FROM vigencias_vacacionales v
    JOIN empleados e ON v.id_empleado = e.id_empleado
    WHERE v.estado = 'en_progreso'
      AND DATEDIFF(v.fecha_fin_periodo, CURDATE()) <= 30
      AND v.dias_disfrutados = 0
      AND v.fecha_programacion_auto IS NULL
      AND e.activo = 1
  `);

  for (const vigencia of vigencias) {
    // Programar vacaciones para el próximo año
    const fechaProgramacion = new Date(vigencia.fecha_fin_periodo);
    fechaProgramacion.setFullYear(fechaProgramacion.getFullYear() - 1);
    
    await query(
      `UPDATE vigencias_vacacionales 
       SET estado = 'programado', 
           fecha_programacion_auto = CURDATE()
       WHERE id_vigencia = ?`,
      [vigencia.id_vigencia]
    );
    
    console.log(`Vacaciones programadas automáticamente para ${vigencia.nombre} ${vigencia.apellido}`);
  }
});

// Limpiar notificaciones antiguas (más de 30 días)
cron.schedule('0 0 * * 0', async () => {
  console.log('Ejecutando tarea programada: Limpiar notificaciones antiguas');
  
  await query(
    'DELETE FROM notificaciones_admin WHERE fecha_creacion < DATE_SUB(NOW(), INTERVAL 30 DAY)'
  );
});

module.exports = cron;
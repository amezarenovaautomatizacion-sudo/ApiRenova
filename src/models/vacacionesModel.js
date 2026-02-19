const { pool } = require('../config/database');

// Función auxiliar para obtener ID de tipo de incidencia por nombre
const obtenerTipoIncidenciaId = async (nombreTipo) => {
  try {
    const [tipo] = await pool.query(
      'SELECT ID FROM tiposincidencia WHERE Nombre = ? AND Activo = TRUE',
      [nombreTipo]
    );
    return tipo.length > 0 ? tipo[0].ID : null;
  } catch (error) {
    console.error('Error obteniendo tipo de incidencia:', error);
    return null;
  }
};

const Vacaciones = {
  // =================== FUNCIONES DE DERECHOS VACACIONALES ===================
  
  /**
   * Obtener derechos vacacionales de un empleado
   */
  obtenerDerechosEmpleado: async (empleadoId) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          v.*,
          e.NombreCompleto,
          e.FechaIngreso,
          e.CorreoElectronico,
          DATEDIFF(v.VigenciaHasta, CURDATE()) as DiasParaVencer,
          DATEDIFF(v.ProximoPeriodo, CURDATE()) as DiasParaProximoPeriodo
         FROM vacacionesempleado v
         JOIN empleados e ON v.EmpleadoID = e.ID
         WHERE v.EmpleadoID = ? AND v.Activo = TRUE`,
        [empleadoId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Calcular antigüedad y días correspondientes
   */
  calcularDerechos: async (empleadoId) => {
    try {
      // Obtener fecha de ingreso del empleado
      const [empleado] = await pool.query(
        'SELECT FechaIngreso FROM empleados WHERE ID = ?',
        [empleadoId]
      );

      if (empleado.length === 0) {
        throw new Error('Empleado no encontrado');
      }

      const fechaIngreso = new Date(empleado[0].FechaIngreso);
      const hoy = new Date();
      
      // Calcular años completos
      let aniosCompletos = hoy.getFullYear() - fechaIngreso.getFullYear();
      const mesDiferencia = hoy.getMonth() - fechaIngreso.getMonth();
      
      if (mesDiferencia < 0 || (mesDiferencia === 0 && hoy.getDate() < fechaIngreso.getDate())) {
        aniosCompletos--;
      }

      // Obtener días según antigüedad
      const [config] = await pool.query(
        `SELECT DiasDerecho 
         FROM configvacaciones 
         WHERE ? BETWEEN AniosMin AND AniosMax 
         AND Activo = TRUE 
         ORDER BY AniosMin LIMIT 1`,
        [aniosCompletos]
      );

      const diasDerecho = config.length > 0 ? config[0].DiasDerecho : 12;

      // Calcular fechas importantes
      const primerAniversario = new Date(fechaIngreso);
      primerAniversario.setFullYear(primerAniversario.getFullYear() + 1);

      let vigenciaHasta = new Date(primerAniversario);
      vigenciaHasta.setMonth(vigenciaHasta.getMonth() + 6);

      let proximoPeriodo = new Date(vigenciaHasta);
      proximoPeriodo.setMonth(proximoPeriodo.getMonth() - 1); // 1 mes antes

      // Si ya pasó el primer año, calcular basado en el último periodo
      if (hoy > primerAniversario) {
        // Para simplificar, asumimos periodos anuales después del primero
        const ultimoPeriodo = new Date(hoy);
        ultimoPeriodo.setFullYear(ultimoPeriodo.getFullYear() - 1);
        
        vigenciaHasta = new Date(ultimoPeriodo);
        vigenciaHasta.setMonth(vigenciaHasta.getMonth() + 18); // 1 año + 6 meses
        
        proximoPeriodo = new Date(vigenciaHasta);
        proximoPeriodo.setMonth(proximoPeriodo.getMonth() - 1);
      }

      return {
        empleadoId,
        aniosCompletos,
        diasDerecho,
        fechaIngreso: fechaIngreso.toISOString().split('T')[0],
        primerAniversario: primerAniversario.toISOString().split('T')[0],
        vigenciaHasta: vigenciaHasta.toISOString().split('T')[0],
        proximoPeriodo: proximoPeriodo.toISOString().split('T')[0],
        hoy: hoy.toISOString().split('T')[0]
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Actualizar derechos vacacionales
   */
  actualizarDerechos: async (empleadoId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Calcular nuevos derechos
      const calculo = await Vacaciones.calcularDerechos(empleadoId);

      // Obtener días ya tomados
      const [derechosActuales] = await connection.query(
        'SELECT DiasTomados FROM vacacionesempleado WHERE EmpleadoID = ?',
        [empleadoId]
      );

      const diasTomados = derechosActuales.length > 0 ? derechosActuales[0].DiasTomados : 0;
      const diasDisponibles = calculo.diasDerecho - diasTomados;

      // Actualizar o insertar
      const [result] = await connection.query(
        `INSERT INTO vacacionesempleado 
         (EmpleadoID, DiasDisponibles, DiasTomados, DiasPendientes, 
          ProximoPeriodo, VigenciaHasta, UltimaActualizacion) 
         VALUES (?, ?, ?, 0, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         DiasDisponibles = VALUES(DiasDisponibles),
         ProximoPeriodo = VALUES(ProximoPeriodo),
         VigenciaHasta = VALUES(VigenciaHasta),
         UltimaActualizacion = VALUES(UltimaActualizacion)`,
        [
          empleadoId,
          diasDisponibles,
          diasTomados,
          calculo.proximoPeriodo,
          calculo.vigenciaHasta,
          calculo.hoy
        ]
      );

      await connection.commit();

      return {
        empleadoId,
        diasDerecho: calculo.diasDerecho,
        diasDisponibles,
        diasTomados,
        proximoPeriodo: calculo.proximoPeriodo,
        vigenciaHasta: calculo.vigenciaHasta
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // =================== FUNCIONES DE SOLICITUDES ===================
  
  /**
   * Solicitar vacaciones
   */
  solicitarVacaciones: async (solicitudData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Verificar que tiene días disponibles
      const [derechos] = await connection.query(
        'SELECT DiasDisponibles FROM vacacionesempleado WHERE EmpleadoID = ?',
        [solicitudData.empleadoId]
      );

      if (derechos.length === 0 || derechos[0].DiasDisponibles < solicitudData.diasSolicitados) {
        throw new Error('No tiene días suficientes disponibles');
      }

      // 2. Crear solicitud
      const [solicitudResult] = await connection.query(
        `INSERT INTO solicitudes 
         (EmpleadoID, Tipo, Estado, Motivo, FechaSolicitud, 
          FechaInicio, FechaFin, DiasSolicitados, Observaciones) 
         VALUES (?, 'vacaciones', 'pendiente', ?, CURDATE(), ?, ?, ?, ?)`,
        [
          solicitudData.empleadoId,
          solicitudData.motivo,
          solicitudData.fechaInicio,
          solicitudData.fechaFin,
          solicitudData.diasSolicitados,
          solicitudData.observaciones || null
        ]
      );

      const solicitudId = solicitudResult.insertId;

      // 3. Crear aprobaciones para los 3 aprobadores
      const [aprobadores] = await connection.query(
        `SELECT u.ID as UsuarioID, a.ID as AprobadorID
         FROM aprobadores a
         JOIN usuarios u ON a.UsuarioID = u.ID
         WHERE a.Activo = TRUE
         ORDER BY a.createdAt
         LIMIT 3`
      );

      for (let i = 0; i < aprobadores.length; i++) {
        await connection.query(
          `INSERT INTO aprobacionessolicitud 
           (SolicitudID, AprobadorID, OrdenAprobacion, Estado) 
           VALUES (?, ?, ?, 'pendiente')`,
          [solicitudId, aprobadores[i].UsuarioID, i + 1]
        );
      }

      // 4. Registrar en historial
      await connection.query(
        `INSERT INTO historialsolicitud 
         (SolicitudID, UsuarioID, Accion, EstadoNuevo, Comentarios) 
         VALUES (?, ?, 'solicitud_creada', 'pendiente', ?)`,
        [solicitudId, solicitudData.creadoPor, 'Solicitud de vacaciones creada']
      );

      await connection.commit();

      return {
        solicitudId,
        aprobadores: aprobadores.length,
        diasSolicitados: solicitudData.diasSolicitados
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Procesar aprobación/rechazo de solicitud
   */
procesarAprobacion: async (aprobacionId, aprobadorId, estado, comentarios) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log(`🔍 [procesarAprobacion] INICIANDO: AprobacionID=${aprobacionId}, AprobadorID=${aprobadorId}, Estado=${estado}`);

    // 1. Verificar que la aprobación existe y pertenece al aprobador
    const [aprobacionActual] = await connection.query(
      `SELECT aps.*, s.Tipo, s.EmpleadoID, s.Estado as EstadoSolicitud
       FROM aprobacionessolicitud aps
       JOIN solicitudes s ON aps.SolicitudID = s.ID
       WHERE aps.ID = ? AND aps.AprobadorID = ?`,
      [aprobacionId, aprobadorId]
    );

    if (aprobacionActual.length === 0) {
      throw new Error('No se encontró la aprobación o no tienes permisos');
    }

    const aprobacion = aprobacionActual[0];
    const solicitudId = aprobacion.SolicitudID;
    const estadoAnterior = aprobacion.Estado;

    console.log(`🔍 SolicitudID: ${solicitudId}, EstadoAnterior: ${estadoAnterior}`);

    // 2. ¡CONVERSIÓN CRÍTICA! El trigger espera 'aprobado', no 'aprobada'
    // PERO también debemos asegurar que SIEMPRE se guarde como 'aprobado' en la BD
    let estadoParaBD;
    if (estado === 'aprobada' || estado === 'aprobado') {
      estadoParaBD = 'aprobado'; // Siempre 'aprobado' para la BD
    } else if (estado === 'rechazada' || estado === 'rechazado') {
      estadoParaBD = 'rechazado'; // Siempre 'rechazado' para la BD
    } else {
      estadoParaBD = estado; // Para otros casos (pendiente, etc.)
    }
    
    console.log(`🔍 Estado convertido: ${estado} → ${estadoParaBD} para la BD`);

    // 3. ACTUALIZAR LA APROBACIÓN CON EL ESTADO CORRECTO PARA LA BD
    const [updateResult] = await connection.query(
      `UPDATE aprobacionessolicitud 
       SET Estado = ?, 
           FechaAprobacion = NOW(), 
           Comentarios = ?,
           updatedAt = CURRENT_TIMESTAMP
       WHERE ID = ?`,
      [estadoParaBD, comentarios, aprobacionId]
    );

    console.log(`🔍 Aprobación actualizada: ${updateResult.affectedRows} filas afectadas`);

    // 4. Registrar en historial (usando el estado original para la vista)
    // Aquí podemos mantener el estado como vino del frontend para que se vea bien
    await connection.query(
      `INSERT INTO historialsolicitud 
       (SolicitudID, UsuarioID, Accion, EstadoAnterior, EstadoNuevo, Comentarios) 
       VALUES (?, ?, 'aprobacion_procesada', ?, ?, ?)`,
      [
        solicitudId,
        aprobadorId,
        estadoAnterior || 'pendiente',
        estado,  // Guardamos el estado original para que la vista lo muestre bien
        comentarios || `Aprobación ${estado}`
      ]
    );

    await connection.commit();

    // 5. Verificar el estado actual de la solicitud después del trigger
    const [solicitudActualizada] = await connection.query(
      'SELECT Estado FROM solicitudes WHERE ID = ?',
      [solicitudId]
    );

    return {
      success: true,
      aprobacionId,
      solicitudId,
      estado: estado, // Devolvemos el estado original para el frontend
      estadoSolicitud: solicitudActualizada[0]?.Estado,
      mensaje: `Aprobación ${estado} exitosamente.`
    };

  } catch (error) {
    console.error('❌ Error en procesarAprobacion:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  /**
   * Editar aprobación (cambiar de opinión)
   */
editarAprobacion: async (aprobacionId, aprobadorId, nuevoEstado, nuevoComentario) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener aprobación actual
    const [aprobacionActual] = await connection.query(
      `SELECT aps.*, s.Estado as EstadoSolicitud, s.Tipo
       FROM aprobacionessolicitud aps
       JOIN solicitudes s ON aps.SolicitudID = s.ID
       WHERE aps.ID = ? AND aps.AprobadorID = ?`,
      [aprobacionId, aprobadorId]
    );

    if (aprobacionActual.length === 0) {
      throw new Error('Aprobación no encontrada o no tienes permisos');
    }

    const estadoAnterior = aprobacionActual[0].Estado;
    const solicitudId = aprobacionActual[0].SolicitudID;

    // 2. Validar 24 horas
    if (aprobacionActual[0].FechaAprobacion) {
      const fechaAprobacion = new Date(aprobacionActual[0].FechaAprobacion);
      const ahora = new Date();
      const horasDiferencia = (ahora - fechaAprobacion) / (1000 * 60 * 60);
      if (horasDiferencia > 24) {
        throw new Error('No se puede cambiar una aprobación después de 24 horas');
      }
    }

    // 3. Convertir estado para BD
    let estadoParaBD;
    if (nuevoEstado === 'aprobada' || nuevoEstado === 'aprobado') {
      estadoParaBD = 'aprobado';
    } else if (nuevoEstado === 'rechazada' || nuevoEstado === 'rechazado') {
      estadoParaBD = 'rechazado';
    } else {
      estadoParaBD = nuevoEstado;
    }

    // 4. ACTUALIZAR LA APROBACIÓN
    await connection.query(
      `UPDATE aprobacionessolicitud 
       SET Estado = ?, 
           FechaAprobacion = NOW(), 
           Comentarios = ?,
           updatedAt = CURRENT_TIMESTAMP
       WHERE ID = ?`,
      [estadoParaBD, nuevoComentario, aprobacionId]
    );

    // 5. Registrar en historial
    await connection.query(
      `INSERT INTO historialsolicitud 
       (SolicitudID, UsuarioID, Accion, EstadoAnterior, EstadoNuevo, Comentarios) 
       VALUES (?, ?, 'aprobacion_editada', ?, ?, ?)`,
      [
        solicitudId,
        aprobadorId,
        estadoAnterior || 'pendiente',
        nuevoEstado,
        `Cambio de opinión: de ${estadoAnterior} a ${nuevoEstado}. ${nuevoComentario}`
      ]
    );

    await connection.commit();

    return {
      success: true,
      aprobacionId,
      solicitudId,
      estadoAnterior,
      nuevoEstado,
      mensaje: `Aprobación cambiada de ${estadoAnterior} a ${nuevoEstado}.`
    };

  } catch (error) {
    console.error('❌ Error en editarAprobacion:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  /**
   * Cancelar solicitud y eliminar incidencia asociada
   */
cancelarSolicitud: async (solicitudId, usuarioId, motivo) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener información de la solicitud
    const [solicitud] = await connection.query(
      `SELECT * FROM solicitudes WHERE ID = ?`,
      [solicitudId]
    );

    if (solicitud.length === 0) {
      throw new Error('Solicitud no encontrada');
    }

    const tipoSolicitud = solicitud[0].Tipo;
    const empleadoId = solicitud[0].EmpleadoID;

    // 2. Si ya está aprobada y es vacaciones, revertir días
    if (solicitud[0].Estado === 'aprobada' && tipoSolicitud === 'vacaciones') {
      await connection.query(
        `UPDATE vacacionesempleado 
         SET DiasTomados = DiasTomados - ?,
             DiasDisponibles = DiasDisponibles + ?,
             DiasPendientes = DiasPendientes - ?
         WHERE EmpleadoID = ?`,
        [
          solicitud[0].DiasSolicitados,
          solicitud[0].DiasSolicitados,
          solicitud[0].DiasSolicitados,
          empleadoId
        ]
      );
    }

    // 3. Eliminar incidencia asociada si existe
    await connection.query(
      'DELETE FROM incidencias WHERE SolicitudID = ?',
      [solicitudId]
    );

    // 4. Actualizar estado de la solicitud
    await connection.query(
      `UPDATE solicitudes 
       SET Estado = 'cancelada', 
           updatedAt = CURRENT_TIMESTAMP 
       WHERE ID = ?`,
      [solicitudId]
    );

    // 5. Actualizar TODAS las aprobaciones a rechazado
    await connection.query(
      `UPDATE aprobacionessolicitud 
       SET Estado = 'rechazado', 
           Comentarios = CONCAT('Cancelada: ', ?),
           FechaAprobacion = NOW(),
           updatedAt = CURRENT_TIMESTAMP
       WHERE SolicitudID = ?`,
      [motivo || 'Solicitud cancelada por usuario', solicitudId]
    );

    // 6. Registrar en historial
    await connection.query(
      `INSERT INTO historialsolicitud 
       (SolicitudID, UsuarioID, Accion, EstadoAnterior, EstadoNuevo, Comentarios) 
       VALUES (?, ?, 'solicitud_cancelada', ?, 'cancelada', ?)`,
      [
        solicitudId,
        usuarioId,
        solicitud[0].Estado,
        motivo || 'Solicitud cancelada por usuario'
      ]
    );

    await connection.commit();

    return {
      success: true,
      solicitudId,
      tipoSolicitud,
      mensaje: 'Solicitud cancelada exitosamente'
    };

  } catch (error) {
    console.error('❌ Error en cancelarSolicitud:', error);
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  // =================== FUNCIONES DE CONSULTA ===================
  
  /**
   * Obtener solicitudes de un empleado
   */
  obtenerSolicitudesEmpleado: async (empleadoId, tipo = null) => {
    try {
      let query = `
        SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          COUNT(DISTINCT aps.ID) as TotalAprobadores,
          SUM(CASE WHEN aps.Estado = 'aprobada' THEN 1 ELSE 0 END) as Aprobaciones,
          SUM(CASE WHEN aps.Estado = 'rechazado' THEN 1 ELSE 0 END) as Rechazos
        FROM solicitudes s
        JOIN empleados e ON s.EmpleadoID = e.ID
        LEFT JOIN aprobacionessolicitud aps ON s.ID = aps.SolicitudID
        WHERE s.EmpleadoID = ? AND s.Activo = TRUE
      `;
      
      const params = [empleadoId];
      
      if (tipo) {
        query += ' AND s.Tipo = ?';
        params.push(tipo);
      }
      
      query += ' GROUP BY s.ID ORDER BY s.FechaSolicitud DESC, s.createdAt DESC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener solicitudes aprobadas de un empleado
   */
  obtenerSolicitudesAprobadasEmpleado: async (empleadoId, tipo = null) => {
    try {
      let query = `
        SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          COUNT(DISTINCT aps.ID) as TotalAprobadores,
          SUM(CASE WHEN aps.Estado = 'aprobada' THEN 1 ELSE 0 END) as Aprobaciones,
          SUM(CASE WHEN aps.Estado = 'rechazado' THEN 1 ELSE 0 END) as Rechazos,
          MAX(aps.FechaAprobacion) as UltimaAprobacion
        FROM solicitudes s
        JOIN empleados e ON s.EmpleadoID = e.ID
        LEFT JOIN aprobacionessolicitud aps ON s.ID = aps.SolicitudID
        WHERE s.EmpleadoID = ? AND s.Estado = 'aprobada' AND s.Activo = TRUE
      `;
      
      const params = [empleadoId];
      
      if (tipo) {
        query += ' AND s.Tipo = ?';
        params.push(tipo);
      }
      
      query += ' GROUP BY s.ID ORDER BY s.FechaInicio DESC, s.createdAt DESC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener solicitudes por estado
   */
  obtenerSolicitudesPorEstado: async (empleadoId, estado, tipo = null) => {
    try {
      let query = `
        SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          COUNT(DISTINCT aps.ID) as TotalAprobadores,
          SUM(CASE WHEN aps.Estado = 'aprobada' THEN 1 ELSE 0 END) as Aprobaciones,
          SUM(CASE WHEN aps.Estado = 'rechazado' THEN 1 ELSE 0 END) as Rechazos
        FROM solicitudes s
        JOIN empleados e ON s.EmpleadoID = e.ID
        LEFT JOIN aprobacionessolicitud aps ON s.ID = aps.SolicitudID
        WHERE s.EmpleadoID = ? AND s.Estado = ? AND s.Activo = TRUE
      `;
      
      const params = [empleadoId, estado];
      
      if (tipo) {
        query += ' AND s.Tipo = ?';
        params.push(tipo);
      }
      
      query += ' GROUP BY s.ID ORDER BY s.FechaSolicitud DESC, s.createdAt DESC';
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener solicitudes pendientes para un aprobador
   */
  obtenerSolicitudesPendientes: async (aprobadorId) => {
    try {
      console.log(`🔍 [obtenerSolicitudesPendientes] Buscando para aprobadorID: ${aprobadorId}`);
      
      const [rows] = await pool.query(
        `SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico,
          aps.ID as AprobacionID,
          aps.OrdenAprobacion,
          aps.Estado as EstadoAprobacion,
          aps.FechaAprobacion,
          aps.Comentarios as ComentariosAprobacion,
          (SELECT COUNT(*) FROM aprobacionessolicitud WHERE SolicitudID = s.ID) as TotalAprobadores,
          (SELECT COUNT(*) FROM aprobacionessolicitud WHERE SolicitudID = s.ID AND Estado = 'aprobada') as Aprobados,
          (SELECT COUNT(*) FROM aprobacionessolicitud WHERE SolicitudID = s.ID AND Estado = 'rechazado') as Rechazados
        FROM aprobacionessolicitud aps
        JOIN solicitudes s ON aps.SolicitudID = s.ID
        JOIN empleados e ON s.EmpleadoID = e.ID
        WHERE aps.AprobadorID = ? 
          AND aps.Estado = 'pendiente'
          AND s.Estado = 'pendiente'
          AND s.Activo = TRUE
        ORDER BY aps.OrdenAprobacion, s.FechaSolicitud DESC`,
        [aprobadorId]
      );
      
      console.log(`📊 Solicitudes pendientes encontradas: ${rows.length}`);
      rows.forEach((row, index) => {
        console.log(`${index + 1}. SolicitudID: ${row.ID}, AprobacionID: ${row.AprobacionID}, Empleado: ${row.EmpleadoNombre}`);
      });
      
      return rows;
    } catch (error) {
      console.error('❌ Error en obtenerSolicitudesPendientes:', error);
      throw error;
    }
  },

  /**
   * Obtener todas las solicitudes aprobadas (para admin/manager)
   */
  obtenerTodasSolicitudesAprobadas: async (filtros = {}) => {
    try {
      let query = `
        SELECT 
          s.*,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico,
          e.PuestoID,
          p.Nombre as PuestoNombre,
          COUNT(DISTINCT aps.ID) as TotalAprobadores,
          SUM(CASE WHEN aps.Estado = 'aprobada' THEN 1 ELSE 0 END) as Aprobaciones,
          MAX(aps.FechaAprobacion) as FechaUltimaAprobacion
        FROM solicitudes s
        JOIN empleados e ON s.EmpleadoID = e.ID
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        LEFT JOIN aprobacionessolicitud aps ON s.ID = aps.SolicitudID
        WHERE s.Estado = 'aprobada' AND s.Activo = TRUE
      `;
      
      const params = [];
      
      if (filtros.empleadoId) {
        query += ' AND s.EmpleadoID = ?';
        params.push(filtros.empleadoId);
      }
      
      if (filtros.tipo) {
        query += ' AND s.Tipo = ?';
        params.push(filtros.tipo);
      }
      
      if (filtros.fechaDesde) {
        query += ' AND s.FechaInicio >= ?';
        params.push(filtros.fechaDesde);
      }
      
      if (filtros.fechaHasta) {
        query += ' AND s.FechaInicio <= ?';
        params.push(filtros.fechaHasta);
      }
      
      query += ' GROUP BY s.ID ORDER BY s.FechaInicio DESC, s.createdAt DESC';
      
      // Paginación
      if (filtros.limit) {
        query += ' LIMIT ?';
        params.push(filtros.limit);
        
        if (filtros.offset) {
          query += ' OFFSET ?';
          params.push(filtros.offset);
        }
      }
      
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Contar solicitudes aprobadas (para paginación)
   */
  contarSolicitudesAprobadas: async (filtros = {}) => {
    try {
      let query = 'SELECT COUNT(*) as total FROM solicitudes s WHERE s.Estado = "aprobada" AND s.Activo = TRUE';
      const params = [];
      
      if (filtros.empleadoId) {
        query += ' AND s.EmpleadoID = ?';
        params.push(filtros.empleadoId);
      }
      
      if (filtros.tipo) {
        query += ' AND s.Tipo = ?';
        params.push(filtros.tipo);
      }
      
      if (filtros.fechaDesde) {
        query += ' AND s.FechaInicio >= ?';
        params.push(filtros.fechaDesde);
      }
      
      if (filtros.fechaHasta) {
        query += ' AND s.FechaInicio <= ?';
        params.push(filtros.fechaHasta);
      }
      
      const [rows] = await pool.query(query, params);
      return rows[0].total;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Vacaciones;
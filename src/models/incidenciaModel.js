const { pool } = require('../config/database');

const Incidencia = {
  // Crear nueva incidencia
  create: async (incidenciaData) => {
    try {
      const [result] = await pool.query(
        `INSERT INTO incidencias 
         (EmpleadoID, TipoIncidenciaID, Descripcion, FechaIncidencia, 
          HoraIncidencia, Observaciones, CreadoPor) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          incidenciaData.empleadoId,
          incidenciaData.tipoIncidenciaId,
          incidenciaData.descripcion,
          incidenciaData.fechaIncidencia,
          incidenciaData.horaIncidencia,
          incidenciaData.observaciones,
          incidenciaData.creadoPor
        ]
      );
      return { id: result.insertId, ...incidenciaData };
    } catch (error) {
      throw error;
    }
  },

  // Obtener incidencia por ID
  findById: async (id) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          i.*,
          ti.Nombre as TipoIncidenciaNombre,
          ti.Descripcion as TipoIncidenciaDescripcion,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico as EmpleadoCorreo,
          u.Usuario as CreadoPorUsuario
         FROM incidencias i
         JOIN tiposincidencia ti ON i.TipoIncidenciaID = ti.ID
         JOIN empleados e ON i.EmpleadoID = e.ID
         JOIN usuarios u ON i.CreadoPor = u.ID
         WHERE i.ID = ?`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Obtener incidencias por empleado - CORREGIDO
  findByEmpleadoId: async (empleadoId) => {
    try {
      console.log(`🔍 [findByEmpleadoId] Buscando incidencias para empleado ID: ${empleadoId}`);
      
      const [rows] = await pool.query(
        `SELECT 
          i.*,
          ti.Nombre as TipoIncidenciaNombre,
          ti.Descripcion as TipoIncidenciaDescripcion,
          u.Usuario as CreadoPorUsuario,
          s.Tipo as TipoSolicitud,
          s.Estado as EstadoSolicitud,
          s.Motivo as MotivoSolicitud
         FROM incidencias i
         JOIN tiposincidencia ti ON i.TipoIncidenciaID = ti.ID
         JOIN usuarios u ON i.CreadoPor = u.ID
         LEFT JOIN solicitudes s ON i.SolicitudID = s.ID
         WHERE i.EmpleadoID = ? AND i.Activo = TRUE
         ORDER BY i.FechaIncidencia DESC, i.createdAt DESC`,
        [empleadoId]
      );
      
      console.log(`🔍 [findByEmpleadoId] Incidencias encontradas: ${rows.length}`);
      
      // Log detallado
      rows.forEach((inc, index) => {
        console.log(`🔍 [findByEmpedadoId] Incidencia ${index + 1}:`);
        console.log(`   ID: ${inc.ID}`);
        console.log(`   Tipo: ${inc.TipoIncidenciaNombre}`);
        console.log(`   Fecha: ${inc.FechaIncidencia}`);
        console.log(`   Descripción: ${inc.Descripcion.substring(0, 50)}...`);
        console.log(`   Relacionada con solicitud: ${inc.SolicitudID ? 'Sí' : 'No'}`);
      });
      
      return rows;
    } catch (error) {
      console.error('❌ Error en findByEmpleadoId:', error);
      throw error;
    }
  },


  // Obtener todas las incidencias (con filtros)
  findAll: async (filtros = {}) => {
    try {
      let query = `
        SELECT 
          i.*,
          ti.Nombre as TipoIncidenciaNombre,
          e.NombreCompleto as EmpleadoNombre,
          e.CorreoElectronico as EmpleadoCorreo,
          u.Usuario as CreadoPorUsuario
        FROM incidencias i
        JOIN tiposincidencia ti ON i.TipoIncidenciaID = ti.ID
        JOIN empleados e ON i.EmpleadoID = e.ID
        JOIN usuarios u ON i.CreadoPor = u.ID
        WHERE i.Activo = TRUE
      `;
      
      const params = [];
      
      // Aplicar filtros
      if (filtros.empleadoId) {
        query += ' AND i.EmpleadoID = ?';
        params.push(filtros.empleadoId);
      }
      
      if (filtros.tipoIncidenciaId) {
        query += ' AND i.TipoIncidenciaID = ?';
        params.push(filtros.tipoIncidenciaId);
      }
      
      if (filtros.fechaDesde) {
        query += ' AND i.FechaIncidencia >= ?';
        params.push(filtros.fechaDesde);
      }
      
      if (filtros.fechaHasta) {
        query += ' AND i.FechaIncidencia <= ?';
        params.push(filtros.fechaHasta);
      }
      
      if (filtros.creadoPor) {
        query += ' AND i.CreadoPor = ?';
        params.push(filtros.creadoPor);
      }
      
      // Ordenamiento
      query += ' ORDER BY i.FechaIncidencia DESC, i.createdAt DESC';
      
      // Paginación
      if (filtros.limit) {
        query += ' LIMIT ?';
        params.push(filtros.limit);
        
        if (filtros.offset) {
          query += ' OFFSET ?';
          params.push(filtros.offset);
        }
      }
      
      console.log(`🔍 [findAll] Query: ${query}`);
      console.log(`🔍 [findAll] Params:`, params);
      
      const [rows] = await pool.query(query, params);
      console.log(`🔍 [findAll] Resultados: ${rows.length}`);
      
      return rows;
    } catch (error) {
      console.error('❌ Error en findAll:', error);
      throw error;
    }
  },

  // Contar incidencias (para paginación)
  count: async (filtros = {}) => {
    try {
      let query = 'SELECT COUNT(*) as total FROM incidencias i WHERE i.Activo = TRUE';
      const params = [];
      
      // Aplicar filtros
      if (filtros.empleadoId) {
        query += ' AND i.EmpleadoID = ?';
        params.push(filtros.empleadoId);
      }
      
      if (filtros.tipoIncidenciaId) {
        query += ' AND i.TipoIncidenciaID = ?';
        params.push(filtros.tipoIncidenciaId);
      }
      
      if (filtros.fechaDesde) {
        query += ' AND i.FechaIncidencia >= ?';
        params.push(filtros.fechaDesde);
      }
      
      if (filtros.fechaHasta) {
        query += ' AND i.FechaIncidencia <= ?';
        params.push(filtros.fechaHasta);
      }
      
      if (filtros.creadoPor) {
        query += ' AND i.CreadoPor = ?';
        params.push(filtros.creadoPor);
      }
      
      const [rows] = await pool.query(query, params);
      return rows[0].total;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar incidencia
  update: async (id, incidenciaData) => {
    try {
      const [result] = await pool.query(
        `UPDATE incidencias 
         SET TipoIncidenciaID = ?, Descripcion = ?, FechaIncidencia = ?,
             HoraIncidencia = ?, Observaciones = ?
         WHERE ID = ?`,
        [
          incidenciaData.tipoIncidenciaId,
          incidenciaData.descripcion,
          incidenciaData.fechaIncidencia,
          incidenciaData.horaIncidencia,
          incidenciaData.observaciones,
          id
        ]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  },

  // Activar/desactivar incidencia (soft delete)
  toggleActive: async (id, activo) => {
    try {
      const [result] = await pool.query(
        'UPDATE incidencias SET Activo = ? WHERE ID = ?',
        [activo, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      throw error;
    }
  },

  // Verificar si un usuario es jefe directo o indirecto de un empleado - CORREGIDO
  esJefeDeEmpleado: async (jefeUsuarioId, empleadoId) => {
    try {
      console.log(`🔍 [esJefeDeEmpleado] Verificando si usuario ${jefeUsuarioId} es jefe de empleado ${empleadoId}`);
      
      // Buscar el EmpleadoID del jefe
      const [jefeEmpleado] = await pool.query(
        'SELECT ID FROM empleados WHERE UsuarioID = ?',
        [jefeUsuarioId]
      );
      
      if (jefeEmpleado.length === 0) {
        console.log('❌ [esJefeDeEmpleado] No se encontró el empleado del jefe');
        return false;
      }
      
      const jefeEmpleadoId = jefeEmpleado[0].ID;
      console.log(`🔍 [esJefeDeEmpleado] Jefe EmpleadoID: ${jefeEmpleadoId}`);
      
      // Si el jefe es el mismo empleado
      if (jefeEmpleadoId === empleadoId) {
        console.log('❌ [esJefeDeEmpleado] Un empleado no puede ser jefe de sí mismo');
        return false;
      }
      
      // Función recursiva para verificar jerarquía
      const verificarJerarquia = async (jefeActualId, empleadoBuscadoId, nivel = 0) => {
        // Verificar relación directa
        const [relacionDirecta] = await pool.query(
          'SELECT ID FROM empleadojefes WHERE JefeID = ? AND EmpleadoID = ?',
          [jefeActualId, empleadoBuscadoId]
        );
        
        if (relacionDirecta.length > 0) {
          console.log(`✅ [esJefeDeEmpleado] Encontrada relación directa (nivel ${nivel}): ${jefeActualId} -> ${empleadoBuscadoId}`);
          return true;
        }
        
        // Obtener subordinados directos del jefe actual
        const [subordinados] = await pool.query(
          'SELECT EmpleadoID FROM empleadojefes WHERE JefeID = ?',
          [jefeActualId]
        );
        
        console.log(`🔍 [esJefeDeEmpleado] Subordinados directos de ${jefeActualId}: ${subordinados.length}`);
        
        // Para cada subordinado, verificar recursivamente
        for (const sub of subordinados) {
          const esSubordinadoIndirecto = await verificarJerarquia(sub.EmpleadoID, empleadoBuscadoId, nivel + 1);
          if (esSubordinadoIndirecto) {
            console.log(`✅ [esJefeDeEmpleado] Encontrada relación indirecta (nivel ${nivel}): ${jefeActualId} -> ${sub.EmpleadoID} -> ${empleadoBuscadoId}`);
            return true;
          }
        }
        
        return false;
      };
      
      const resultado = await verificarJerarquia(jefeEmpleadoId, empleadoId);
      console.log(`🔍 [esJefeDeEmpleado] Resultado final: ${resultado ? 'ES JEFE' : 'NO ES JEFE'}`);
      
      return resultado;
    } catch (error) {
      console.error('❌ Error en esJefeDeEmpleado:', error);
      throw error;
    }
  }
};

module.exports = Incidencia;
const { pool } = require('../config/database');
const { 
  emitirNotificacionGeneral,
  emitirNotificacionImportante 
} = require('../sockets/notificacionSocket');

const Notificacion = {
  // Obtener notificaciones personales con filtros
  obtenerNotificacionesPersonales: async (filtros) => {
    const {
      usuarioId,
      tipo,
      estado,
      importante,
      page = 1,
      limit = 20
    } = filtros;

    const offset = (page - 1) * limit;
    const queryParams = [usuarioId];
    let whereClause = 'np.UsuarioID = ?';

    if (tipo) {
      whereClause += ' AND tn.Nombre = ?';
      queryParams.push(tipo);
    }

    if (estado && estado.trim() !== '') {
      whereClause += ' AND np.Estado = ?';
      queryParams.push(estado);
    }

    if (importante !== undefined && importante) {
      whereClause += ' AND tn.Prioridad IN (?, ?)';
      queryParams.push('alta', 'urgente');
    }

    // Obtener notificaciones
    const [rows] = await pool.query(`
      SELECT 
        np.ID,
        np.Titulo,
        np.Mensaje,
        np.DatosExtra,
        np.Estado,
        np.Leido,
        np.FechaVista,
        np.FechaEliminada,
        np.VigenciaDias,
        np.FechaExpiracion,
        np.Activo,
        np.createdAt,
        np.updatedAt,
        tn.Nombre as Tipo,
        tn.Icono,
        tn.Color,
        tn.Prioridad,
        u.Usuario,
        e.NombreCompleto as NombreEmpleado
      FROM notificaciones_personales np
      JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
      JOIN usuarios u ON np.UsuarioID = u.ID
      LEFT JOIN empleados e ON e.UsuarioID = u.ID
      WHERE ${whereClause} 
        AND np.Activo = 1
        AND np.FechaExpiracion > NOW()
      ORDER BY 
        CASE tn.Prioridad 
          WHEN 'urgente' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'media' THEN 3
          WHEN 'baja' THEN 4
        END,
        np.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    // Obtener total
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM notificaciones_personales np
      JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
      WHERE ${whereClause} 
        AND np.Activo = 1
        AND np.FechaExpiracion > NOW()
    `, queryParams);

    return {
      notificaciones: rows,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    };
  },

  // Obtener resumen de notificaciones
  obtenerResumenNotificaciones: async (usuarioId) => {
    const [result] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN Estado = 'no_vista' THEN 1 END) as no_vistas,
        COUNT(CASE WHEN Estado = 'vista' AND Leido = 0 THEN 1 END) as no_leidas,
        COUNT(CASE WHEN tn.Prioridad IN ('alta', 'urgente') THEN 1 END) as importantes,
        MAX(np.createdAt) as ultima_notificacion
      FROM notificaciones_personales np
      JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
      WHERE np.UsuarioID = ? 
        AND np.Activo = 1
        AND np.FechaExpiracion > NOW()
    `, [usuarioId]);

    return result[0];
  },

  // Marcar notificación como vista
  marcarComoVista: async (notificacionId, usuarioId) => {
    const [result] = await pool.query(`
      UPDATE notificaciones_personales 
      SET Estado = 'vista', 
          FechaVista = NOW(),
          updatedAt = NOW()
      WHERE ID = ? AND UsuarioID = ? AND Activo = 1
    `, [notificacionId, usuarioId]);

    if (result.affectedRows === 0) return null;

    // Obtener la notificación actualizada
    const [rows] = await pool.query(`
      SELECT * FROM notificaciones_personales WHERE ID = ?
    `, [notificacionId]);

    return rows[0];
  },

  // Marcar notificación como leída
  marcarComoLeida: async (notificacionId, usuarioId) => {
    const [result] = await pool.query(`
      UPDATE notificaciones_personales 
      SET Leido = 1,
          updatedAt = NOW()
      WHERE ID = ? AND UsuarioID = ? AND Activo = 1
    `, [notificacionId, usuarioId]);

    if (result.affectedRows === 0) return null;

    // Obtener la notificación actualizada
    const [rows] = await pool.query(`
      SELECT * FROM notificaciones_personales WHERE ID = ?
    `, [notificacionId]);

    return rows[0];
  },

  // Eliminar notificación (marcar como eliminada)
  eliminarNotificacion: async (notificacionId, usuarioId) => {
    const [result] = await pool.query(`
      UPDATE notificaciones_personales 
      SET Estado = 'eliminada',
          FechaEliminada = NOW(),
          updatedAt = NOW()
      WHERE ID = ? AND UsuarioID = ? AND Activo = 1
    `, [notificacionId, usuarioId]);

    if (result.affectedRows === 0) return null;

    return { id: notificacionId, eliminada: true };
  },

  // Marcar todas las notificaciones como vistas
  marcarTodasComoVistas: async (usuarioId) => {
    const [result] = await pool.query(`
      UPDATE notificaciones_personales 
      SET Estado = 'vista', 
          FechaVista = NOW(),
          updatedAt = NOW()
      WHERE UsuarioID = ? 
        AND Estado = 'no_vista'
        AND Activo = 1
        AND FechaExpiracion > NOW()
    `, [usuarioId]);

    return { afectadas: result.affectedRows };
  },

// Versión ultra-simple garantizada
obtenerNotificacionesGenerales: async (filtros) => {
  const { usuarioId, importante, vista, page = 1, limit = 20 } = filtros;
  const offset = (page - 1) * limit;
  
  try {
    // CONSULTA SIMPLE DIRECTA - sin joins complejos primero
    const [todasNotificaciones] = await pool.query(`
      SELECT ID, Titulo, Importante, FechaExpiracion
      FROM notificaciones_generales 
      WHERE Activo = 1 AND FechaExpiracion > NOW()
      ORDER BY ID
    `);
    
    console.log('🔍 Todas las notificaciones en BD:', todasNotificaciones.length);
    console.log('🔍 IDs encontrados:', todasNotificaciones.map(n => n.ID));

    // Ahora la consulta completa
    const sql = `
      SELECT 
        ng.ID,
        ng.Titulo,
        ng.Mensaje,
        ng.DatosExtra,
        ng.Importante,
        ng.VigenciaDias,
        ng.FechaExpiracion,
        ng.CreadoPor,
        ng.Activo,
        ng.createdAt,
        ng.updatedAt,
        COALESCE(tn.Nombre, 'notificacion_general') as Tipo,
        COALESCE(tn.Icono, 'announcement') as Icono,
        COALESCE(tn.Color, 'primary') as Color,
        COALESCE(ngv.Vista, 0) as YaVista,
        ngv.FechaVista,
        COALESCE(e.NombreCompleto, 'Sistema') as CreadorNombre
      FROM notificaciones_generales ng
      LEFT JOIN tipos_notificacion tn ON ng.TipoNotificacionID = tn.ID
      LEFT JOIN notificaciones_generales_vistas ngv 
        ON ng.ID = ngv.NotificacionGeneralID AND ngv.UsuarioID = ?
      LEFT JOIN empleados e ON e.UsuarioID = ng.CreadoPor
      WHERE ng.Activo = 1 AND ng.FechaExpiracion > UTC_TIMESTAMP()
      ORDER BY ng.Importante DESC, ng.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await pool.query(sql, [usuarioId, limit, offset]);
    
    console.log('🔍 Notificaciones devueltas por API:', rows.length);
    console.log('🔍 IDs devueltos:', rows.map(r => r.ID));

    // COUNT separado
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM notificaciones_generales
      WHERE Activo = 1 AND FechaExpiracion > UTC_TIMESTAMP()
    `);
    
    // Filtrar por vista si es necesario
    let notificacionesFiltradas = rows;
    if (vista !== undefined) {
      const vistaNum = vista ? 1 : 0;
      notificacionesFiltradas = rows.filter(n => n.YaVista === vistaNum);
    }

    return {
      notificaciones: notificacionesFiltradas,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    };
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
},

  // Marcar notificación general como vista
  marcarGeneralComoVista: async (notificacionId, usuarioId) => {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Verificar si ya existe una vista
      const [existente] = await connection.query(`
        SELECT * FROM notificaciones_generales_vistas 
        WHERE NotificacionGeneralID = ? AND UsuarioID = ?
      `, [notificacionId, usuarioId]);

      let result;
      if (existente.length > 0) {
        // Actualizar vista existente
        [result] = await connection.query(`
          UPDATE notificaciones_generales_vistas 
          SET Vista = 1, FechaVista = NOW(), updatedAt = NOW()
          WHERE NotificacionGeneralID = ? AND UsuarioID = ?
        `, [notificacionId, usuarioId]);
      } else {
        // Crear nueva vista
        [result] = await connection.query(`
          INSERT INTO notificaciones_generales_vistas 
          (NotificacionGeneralID, UsuarioID, Vista, FechaVista)
          VALUES (?, ?, 1, NOW())
        `, [notificacionId, usuarioId]);
      }

      await connection.commit();

      return { notificacionId, usuarioId, vista: true };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Crear notificación general
 crearNotificacionGeneral: async (notificacionData) => {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(`
        INSERT INTO notificaciones_generales 
        (TipoNotificacionID, Titulo, Mensaje, DatosExtra, 
         Importante, VigenciaDias, CreadoPor)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        notificacionData.tipoNotificacionId,
        notificacionData.titulo,
        notificacionData.mensaje,
        notificacionData.datosExtra ? JSON.stringify(notificacionData.datosExtra) : null,
        notificacionData.importante ? 1 : 0,
        notificacionData.vigenciaDias,
        notificacionData.creadoPor
      ]);

      const notificacionId = result.insertId;

      // Obtener notificación creada con detalles
      const [rows] = await connection.query(`
        SELECT 
          ng.*,
          tn.Nombre as Tipo,
          tn.Prioridad,
          tn.Icono,
          tn.Color,
          COALESCE(e.NombreCompleto, 'Sistema') as CreadorNombre
        FROM notificaciones_generales ng
        LEFT JOIN tipos_notificacion tn ON ng.TipoNotificacionID = tn.ID
        LEFT JOIN empleados e ON e.UsuarioID = ng.CreadoPor
        WHERE ng.ID = ?
      `, [notificacionId]);

      await connection.commit();

      // 👇 EMITIR NOTIFICACIÓN EN TIEMPO REAL
      const notificacion = rows[0];
      
      if (notificacion.Importante) {
        // Si es importante, emitir con prioridad
        await emitirNotificacionImportante(notificacion);
      } else {
        // Notificación general normal
        await emitirNotificacionGeneral(notificacion);
      }

      return notificacion;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

   crearNotificacionPersonal: async (data) => {
    const { usuarioId, tipoNotificacionId, titulo, mensaje, datosExtra, vigenciaDias = 30 } = data;
    
    const [result] = await pool.query(`
      INSERT INTO notificaciones_personales 
      (UsuarioID, TipoNotificacionID, Titulo, Mensaje, DatosExtra, VigenciaDias, FechaExpiracion)
      VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
    `, [usuarioId, tipoNotificacionId, titulo, mensaje, 
        datosExtra ? JSON.stringify(datosExtra) : null, vigenciaDias, vigenciaDias]);

    const [notificacion] = await pool.query(`
      SELECT 
        np.*,
        tn.Nombre as Tipo,
        tn.Prioridad,
        tn.Icono,
        tn.Color,
        u.Usuario,
        e.NombreCompleto as NombreEmpleado
      FROM notificaciones_personales np
      JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
      JOIN usuarios u ON np.UsuarioID = u.ID
      LEFT JOIN empleados e ON e.UsuarioID = u.ID
      WHERE np.ID = ?
    `, [result.insertId]);

    // Emitir al usuario específico
    const { emitirNotificacionPersonal } = require('../sockets/notificacionSocket');
    await emitirNotificacionPersonal(usuarioId, notificacion[0]);

    return notificacion[0];
  },

  // Obtener tipos de notificación
  obtenerTiposNotificacion: async () => {
    const [rows] = await pool.query(`
      SELECT * FROM tipos_notificacion 
      WHERE Activo = 1 
      ORDER BY Prioridad, Nombre
    `);
    return rows;
  },

  // Obtener configuraciones
  obtenerConfiguraciones: async () => {
    const [rows] = await pool.query(`
      SELECT * FROM config_notificaciones 
      WHERE Activo = 1 
      ORDER BY Clave
    `);
    return rows;
  },

  // Actualizar configuración
  actualizarConfiguracion: async (id, valor) => {
    const [result] = await pool.query(`
      UPDATE config_notificaciones 
      SET Valor = ?, updatedAt = NOW()
      WHERE ID = ?
    `, [valor, id]);

    if (result.affectedRows === 0) return null;

    // Obtener configuración actualizada
    const [rows] = await pool.query(`
      SELECT * FROM config_notificaciones WHERE ID = ?
    `, [id]);

    return rows[0];
  }
};

module.exports = Notificacion;
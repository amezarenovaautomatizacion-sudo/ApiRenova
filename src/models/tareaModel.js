// models/tareaModel.js
const { pool } = require('../config/database');

const Tarea = {
  // Crear nueva tarea (con asignación opcional)
  crear: async (tareaData) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // ✅ VALIDAR PRIORIDAD - VALOR POR DEFECTO
    const prioridadValida = ['baja', 'media', 'alta', 'urgente'].includes(tareaData.prioridad) 
      ? tareaData.prioridad 
      : 'media';

    const [result] = await connection.query(`
      INSERT INTO tareas (
        ProyectoID, Titulo, Descripcion, Estado, 
        FechaCreacion, FechaVencimiento, Prioridad, CreadoPor
      ) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)
    `, [
      tareaData.proyectoId,
      tareaData.titulo,
      tareaData.descripcion,
      tareaData.estado || 'pendiente',
      tareaData.fechaVencimiento,
      prioridadValida, // ✅ USAR VALOR VALIDADO
      tareaData.creadoPor
    ]);

    const tareaId = result.insertId;

    let asignacion = null;
    if (tareaData.empleadoId) {
      // Verificar que el empleado pertenezca al proyecto
      const [esMiembro] = await connection.query(`
        SELECT 1 FROM proyecto_empleados 
        WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1
      `, [tareaData.proyectoId, tareaData.empleadoId]);

      if (esMiembro.length === 0) {
        throw new Error('El empleado debe pertenecer al proyecto para ser asignado a la tarea');
      }

      const [asignacionResult] = await connection.query(`
        INSERT INTO tarea_asignaciones (
          TareaID, EmpleadoID, FechaAsignacion, AsignadoPor
        ) VALUES (?, ?, CURDATE(), ?)
      `, [tareaId, tareaData.empleadoId, tareaData.creadoPor]);

      const [empleado] = await connection.query(`
        SELECT ID, NombreCompleto, CorreoElectronico 
        FROM empleados WHERE ID = ?
      `, [tareaData.empleadoId]);

      asignacion = {
        id: asignacionResult.insertId,
        empleadoId: tareaData.empleadoId,
        empleadoNombre: empleado[0]?.NombreCompleto,
        empleadoEmail: empleado[0]?.CorreoElectronico,
        fechaAsignacion: new Date()
      };
    }

    await connection.commit();

    const [tarea] = await connection.query(`
      SELECT t.*, 
             p.Nombre as ProyectoNombre,
             p.JefeProyectoID,
             u.Usuario as CreadorUsuario
      FROM tareas t
      LEFT JOIN proyectos p ON t.ProyectoID = p.ID
      LEFT JOIN usuarios u ON t.CreadoPor = u.ID
      WHERE t.ID = ?
    `, [tareaId]);

    const tareaCreada = tarea[0];
    tareaCreada.asignacion = asignacion;
    tareaCreada.estadoAsignacion = asignacion ? 'asignado' : 'sin_asignar';
    tareaCreada.EmpleadoAsignadoID = asignacion?.empleadoId || null;
    tareaCreada.EmpleadoAsignadoNombre = asignacion?.empleadoNombre || null;

    return tareaCreada;

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  // Reasignar tarea (cambiar o remover asignación)
  reasignarTarea: async (tareaId, empleadoId, usuarioId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar que la tarea existe
    const [tarea] = await connection.query(`
      SELECT t.*, p.ID as ProyectoID, p.JefeProyectoID
      FROM tareas t
      JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ? AND t.Activo = 1
    `, [tareaId]);

    if (tarea.length === 0) {
      throw new Error('Tarea no encontrada');
    }

    const tareaInfo = tarea[0];

    // Obtener asignación actual antes de desactivarla
    const [asignacionActual] = await connection.query(`
      SELECT ta.*, e.NombreCompleto 
      FROM tarea_asignaciones ta
      JOIN empleados e ON ta.EmpleadoID = e.ID
      WHERE ta.TareaID = ? AND ta.Activo = 1
      LIMIT 1
    `, [tareaId]);

    // Desactivar todas las asignaciones activas actuales
    await connection.query(`
      UPDATE tarea_asignaciones 
      SET Activo = 0, updatedAt = NOW()
      WHERE TareaID = ? AND Activo = 1
    `, [tareaId]);

    let nuevaAsignacion = null;

    // Si se proporciona empleadoId, crear nueva asignación
    if (empleadoId) {
      // Verificar que el empleado existe
      const [empleado] = await connection.query(`
        SELECT ID, NombreCompleto, CorreoElectronico 
        FROM empleados WHERE ID = ?
      `, [empleadoId]);

      if (empleado.length === 0) {
        throw new Error('Empleado no encontrado');
      }

      const [asignacionResult] = await connection.query(`
        INSERT INTO tarea_asignaciones (
          TareaID, EmpleadoID, FechaAsignacion, AsignadoPor
        ) VALUES (?, ?, CURDATE(), ?)
      `, [tareaId, empleadoId, usuarioId]);

      nuevaAsignacion = {
        id: asignacionResult.insertId,
        empleadoId,
        empleadoNombre: empleado[0]?.NombreCompleto,
        empleadoEmail: empleado[0]?.CorreoElectronico,
        fechaAsignacion: new Date()
      };
    }

    await connection.commit();

    return {
      success: true,
      tareaId,
      tareaTitulo: tareaInfo.Titulo,
      asignacionPrevia: asignacionActual.length > 0 ? {
        id: asignacionActual[0].ID,
        empleadoId: asignacionActual[0].EmpleadoID,
        empleadoNombre: asignacionActual[0].NombreCompleto
      } : null,
      asignacionActual: nuevaAsignacion,
      estadoAsignacion: nuevaAsignacion ? 'asignado' : 'sin_asignar'
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  // Obtener tarea por ID con verificación de acceso
  obtenerPorId: async (tareaId, usuarioId, usuarioRol) => {
    try {
      let query = `
        SELECT t.*, 
               p.Nombre as ProyectoNombre,
               p.JefeProyectoID,
               u.Usuario as CreadorUsuario,
               CASE 
                 WHEN ? = 'admin' THEN 1
                 WHEN p.JefeProyectoID = (SELECT ID FROM empleados WHERE UsuarioID = ?) THEN 1
                 WHEN EXISTS (
                   SELECT 1 FROM proyecto_empleados pe
                   WHERE pe.ProyectoID = t.ProyectoID 
                     AND pe.EmpleadoID = (SELECT ID FROM empleados WHERE UsuarioID = ?)
                     AND pe.Activo = 1
                 ) THEN 1
                 ELSE 0
               END as TieneAcceso
        FROM tareas t
        LEFT JOIN proyectos p ON t.ProyectoID = p.ID
        LEFT JOIN usuarios u ON t.CreadoPor = u.ID
        WHERE t.ID = ? AND t.Activo = 1
      `;

      const [rows] = await pool.query(query, [usuarioRol, usuarioId, usuarioId, tareaId]);

      if (rows.length === 0) return null;

      const tarea = rows[0];
      
      if (tarea.TieneAcceso === 0) {
        throw new Error('No tienes acceso a esta tarea');
      }

      // Obtener asignación activa
      const [asignacion] = await pool.query(`
        SELECT ta.*,
               e.NombreCompleto,
               e.CorreoElectronico,
               e.ID as EmpleadoID,
               u.Usuario as AsignadoPorUsuario
        FROM tarea_asignaciones ta
        JOIN empleados e ON ta.EmpleadoID = e.ID
        LEFT JOIN usuarios u ON ta.AsignadoPor = u.ID
        WHERE ta.TareaID = ? AND ta.Activo = 1
        LIMIT 1
      `, [tareaId]);

      tarea.asignacion = asignacion.length > 0 ? {
        id: asignacion[0].ID,
        empleadoId: asignacion[0].EmpleadoID,
        empleadoNombre: asignacion[0].NombreCompleto,
        empleadoEmail: asignacion[0].CorreoElectronico,
        fechaAsignacion: asignacion[0].FechaAsignacion,
        asignadoPor: asignacion[0].AsignadoPorUsuario
      } : null;

      tarea.estadoAsignacion = tarea.asignacion ? 'asignado' : 'sin_asignar';

      // Obtener historial de asignaciones (últimas 5)
      const [historialAsignaciones] = await pool.query(`
        SELECT ta.*,
               e.NombreCompleto as EmpleadoNombre,
               u.Usuario as AsignadoPorUsuario
        FROM tarea_asignaciones ta
        LEFT JOIN empleados e ON ta.EmpleadoID = e.ID
        LEFT JOIN usuarios u ON ta.AsignadoPor = u.ID
        WHERE ta.TareaID = ?
        ORDER BY ta.createdAt DESC
        LIMIT 5
      `, [tareaId]);

      tarea.historialAsignaciones = historialAsignaciones;

      return tarea;

    } catch (error) {
      throw error;
    }
  },

  // Listar tareas de un proyecto
listarPorProyecto: async (proyectoId, filtros) => {
  const {
    estado,
    prioridad,
    asignadoA,
    page = 1,
    limit = 20,
    soloSinAsignar = false,
    search = ''
  } = filtros;

  const offset = (page - 1) * limit;
  let whereClause = 't.ProyectoID = ? AND t.Activo = 1';
  const queryParams = [proyectoId];

  if (estado) {
    whereClause += ' AND t.Estado = ?';
    queryParams.push(estado);
  }

  // ✅ VALIDAR PRIORIDAD - SOLO SI ES UN VALOR VÁLIDO
  if (prioridad && ['baja', 'media', 'alta', 'urgente'].includes(prioridad)) {
    whereClause += ' AND t.Prioridad = ?';
    queryParams.push(prioridad);
  }

  if (asignadoA) {
    whereClause += ' AND t.ID IN (SELECT TareaID FROM tarea_asignaciones WHERE EmpleadoID = ? AND Activo = 1)';
    queryParams.push(asignadoA);
  }

  if (soloSinAsignar === 'true' || soloSinAsignar === true) {
    whereClause += ' AND t.ID NOT IN (SELECT TareaID FROM tarea_asignaciones WHERE Activo = 1)';
  }

  if (search) {
    whereClause += ' AND (t.Titulo LIKE ? OR t.Descripcion LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`);
  }

  const [rows] = await pool.query(`
    SELECT 
      t.*,
      u.Usuario as CreadorUsuario,
      (SELECT ta.EmpleadoID FROM tarea_asignaciones ta WHERE ta.TareaID = t.ID AND ta.Activo = 1 LIMIT 1) as EmpleadoAsignadoID,
      (SELECT e.NombreCompleto FROM tarea_asignaciones ta 
       JOIN empleados e ON ta.EmpleadoID = e.ID
       WHERE ta.TareaID = t.ID AND ta.Activo = 1 LIMIT 1) as EmpleadoAsignadoNombre,
      CASE 
        WHEN EXISTS (SELECT 1 FROM tarea_asignaciones ta WHERE ta.TareaID = t.ID AND ta.Activo = 1) 
        THEN 'asignado' 
        ELSE 'sin_asignar' 
      END as estadoAsignacion
    FROM tareas t
    LEFT JOIN usuarios u ON t.CreadoPor = u.ID
    WHERE ${whereClause}
    GROUP BY t.ID
    ORDER BY 
      CASE t.Prioridad 
        WHEN 'urgente' THEN 1
        WHEN 'alta' THEN 2
        WHEN 'media' THEN 3
        WHEN 'baja' THEN 4
        ELSE 5
      END,
      t.FechaVencimiento ASC,
      t.createdAt DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, limit, offset]);

  const [countResult] = await pool.query(`
    SELECT COUNT(DISTINCT t.ID) as total
    FROM tareas t
    WHERE ${whereClause}
  `, queryParams);

  return {
    tareas: rows,
    pagination: {
      page,
      limit,
      total: countResult[0].total,
      totalPages: Math.ceil(countResult[0].total / limit)
    }
  };
},

// Actualizar tarea
actualizar: async (tareaId, tareaData, usuarioId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verificar que la tarea existe
    const [tarea] = await connection.query(`
      SELECT * FROM tareas WHERE ID = ? AND Activo = 1
    `, [tareaId]);

    if (tarea.length === 0) {
      throw new Error('Tarea no encontrada');
    }

    const campos = [];
    const valores = [];

    const camposPermitidos = ['titulo', 'descripcion', 'fechaVencimiento', 'prioridad'];
    
    Object.keys(tareaData).forEach(key => {
      if (camposPermitidos.includes(key) && tareaData[key] !== undefined) {
        const campoDB = key === 'titulo' ? 'Titulo' :
                       key === 'descripcion' ? 'Descripcion' :
                       key === 'fechaVencimiento' ? 'FechaVencimiento' :
                       key === 'prioridad' ? 'Prioridad' : null;
        
        if (campoDB) {
          campos.push(`${campoDB} = ?`);
          valores.push(tareaData[key]);
        }
      }
    });

    if (campos.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    valores.push(tareaId);

    const [result] = await connection.query(`
      UPDATE tareas 
      SET ${campos.join(', ')}
      WHERE ID = ? AND Activo = 1
    `, valores);

    if (result.affectedRows === 0) {
      throw new Error('Error al actualizar la tarea');
    }

    await connection.commit();

    const [tareaActualizada] = await connection.query(`
      SELECT t.*, 
             p.JefeProyectoID,
             (SELECT e.NombreCompleto FROM tarea_asignaciones ta 
              JOIN empleados e ON ta.EmpleadoID = e.ID
              WHERE ta.TareaID = t.ID AND ta.Activo = 1 LIMIT 1) as EmpleadoAsignadoNombre
      FROM tareas t
      LEFT JOIN proyectos p ON t.ProyectoID = p.ID
      WHERE t.ID = ?
    `, [tareaId]);

    return tareaActualizada[0];

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
},

  // Asignar empleado a tarea (o reasignar)
  asignarEmpleado: async (tareaId, empleadoId, asignadoPor) => {
    // Reutilizamos reasignarTarea para mantener consistencia
    return await Tarea.reasignarTarea(tareaId, empleadoId, asignadoPor);
  },

  // Quitar asignación de tarea (dejar sin asignar)
  quitarAsignacion: async (asignacionId, usuarioId, tareaId = null) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let resultado;

      if (asignacionId) {
        const [asignacion] = await connection.query(`
          SELECT ta.*, t.Titulo 
          FROM tarea_asignaciones ta
          JOIN tareas t ON ta.TareaID = t.ID
          WHERE ta.ID = ? AND ta.Activo = 1
        `, [asignacionId]);

        if (asignacion.length === 0) {
          throw new Error('Asignación no encontrada');
        }

        await connection.query(`
          UPDATE tarea_asignaciones 
          SET Activo = 0, updatedAt = NOW()
          WHERE ID = ? AND Activo = 1
        `, [asignacionId]);

        resultado = {
          tareaId: asignacion[0].TareaID,
          tareaTitulo: asignacion[0].Titulo,
          asignacionRemovida: true
        };
      } else if (tareaId) {
        // Quitar todas las asignaciones activas de la tarea
        const [tarea] = await connection.query(`
          SELECT Titulo FROM tareas WHERE ID = ? AND Activo = 1
        `, [tareaId]);

        if (tarea.length === 0) {
          throw new Error('Tarea no encontrada');
        }

        await connection.query(`
          UPDATE tarea_asignaciones 
          SET Activo = 0, updatedAt = NOW()
          WHERE TareaID = ? AND Activo = 1
        `, [tareaId]);

        resultado = {
          tareaId,
          tareaTitulo: tarea[0].Titulo,
          asignacionRemovida: true,
          todasRemovidas: true
        };
      }

      await connection.commit();

      return {
        ...resultado,
        estadoAsignacion: 'sin_asignar',
        success: true
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Eliminar tarea (lógica)
  eliminar: async (tareaId, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [tarea] = await connection.query(`
        SELECT Titulo FROM tareas WHERE ID = ? AND Activo = 1
      `, [tareaId]);

      if (tarea.length === 0) {
        throw new Error('Tarea no encontrada');
      }

      await connection.query(`
        UPDATE tareas 
        SET Activo = 0, updatedAt = NOW()
        WHERE ID = ? AND Activo = 1
      `, [tareaId]);

      // Desactivar asignaciones
      await connection.query(`
        UPDATE tarea_asignaciones 
        SET Activo = 0, updatedAt = NOW()
        WHERE TareaID = ? AND Activo = 1
      `, [tareaId]);

      await connection.commit();

      return {
        success: true,
        tareaId,
        titulo: tarea[0].Titulo,
        eliminada: true
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = Tarea;
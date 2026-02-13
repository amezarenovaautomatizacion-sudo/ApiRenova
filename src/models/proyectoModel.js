// models/proyectoModel.js
const { pool } = require('../config/database');

const Proyecto = {
  // Crear nuevo proyecto
  crear: async (proyectoData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(`
        INSERT INTO proyectos (
          Nombre, Descripcion, FechaInicio, FechaFin, Estado,
          Presupuesto, MontoAsignado, Moneda, JefeProyectoID, CreadoPor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        proyectoData.nombre,
        proyectoData.descripcion,
        proyectoData.fechaInicio,
        proyectoData.fechaFin,
        proyectoData.estado || 'activo',
        proyectoData.presupuesto,
        proyectoData.montoAsignado || 0,
        proyectoData.moneda || 'MXN',
        proyectoData.jefeProyectoId,
        proyectoData.creadoPor
      ]);

      const proyectoId = result.insertId;

      await connection.query(`
        INSERT INTO proyecto_empleados (
          ProyectoID, EmpleadoID, Rol, FechaAsignacion, AsignadoPor
        ) VALUES (?, ?, ?, CURDATE(), ?)
      `, [proyectoId, proyectoData.jefeProyectoId, 'jefe', proyectoData.creadoPor]);

      await connection.commit();

      const [proyecto] = await connection.query(`
        SELECT p.*, 
               e.NombreCompleto as JefeProyectoNombre,
               e.CorreoElectronico as JefeProyectoEmail,
               u.Usuario as CreadorUsuario
        FROM proyectos p
        LEFT JOIN empleados e ON p.JefeProyectoID = e.ID
        LEFT JOIN usuarios u ON p.CreadoPor = u.ID
        WHERE p.ID = ?
      `, [proyectoId]);

      return proyecto[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Eliminar proyecto (lógica)
  eliminar: async (proyectoId, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Verificar que el proyecto existe y está activo
      const [proyecto] = await connection.query(`
        SELECT ID, Nombre FROM proyectos 
        WHERE ID = ? AND Activo = 1
      `, [proyectoId]);

      if (proyecto.length === 0) {
        throw new Error('Proyecto no encontrado');
      }

      // Eliminación lógica del proyecto
      await connection.query(`
        UPDATE proyectos 
        SET Activo = 0, updatedAt = NOW()
        WHERE ID = ? AND Activo = 1
      `, [proyectoId]);

      // Registrar en historial
      await connection.query(`
        INSERT INTO proyecto_historial (ProyectoID, Accion, Detalles, UsuarioID)
        VALUES (?, 'proyecto_eliminado', ?, ?)
      `, [proyectoId, `Proyecto eliminado por usuario ID: ${usuarioId}`, usuarioId]);

      await connection.commit();

      return {
        success: true,
        message: 'Proyecto eliminado exitosamente',
        proyectoId,
        nombre: proyecto[0].Nombre
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener proyecto por ID con verificación de acceso
  obtenerPorId: async (proyectoId, usuarioId, usuarioRol) => {
    try {
      const [empleado] = await pool.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);
      
      const empleadoId = empleado[0]?.ID;

      let query = `
        SELECT p.*, 
               e.NombreCompleto as JefeProyectoNombre,
               e.CorreoElectronico as JefeProyectoEmail,
               e.ID as JefeEmpleadoID,
               pe.Rol as MiRolEnProyecto,
               u.Usuario as CreadorUsuario,
               (SELECT COUNT(*) FROM proyecto_empleados pe2 WHERE pe2.ProyectoID = p.ID AND pe2.Activo = 1) as TotalEmpleados,
               (SELECT COUNT(*) FROM tareas t WHERE t.ProyectoID = p.ID AND t.Activo = 1) as TotalTareas,
               (SELECT COUNT(*) FROM tareas t WHERE t.ProyectoID = p.ID AND t.Activo = 1 AND t.Estado = 'realizada') as TareasCompletadas
        FROM proyectos p
        LEFT JOIN empleados e ON p.JefeProyectoID = e.ID
        LEFT JOIN usuarios u ON p.CreadoPor = u.ID
        LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID 
          AND pe.EmpleadoID = ? AND pe.Activo = 1
        WHERE p.ID = ? AND p.Activo = 1
      `;

      const params = [empleadoId, proyectoId];

      if (usuarioRol !== 'admin') {
        query += ` AND (pe.ID IS NOT NULL OR p.JefeProyectoID = ?)`;
        params.push(empleadoId);
      }

      const [rows] = await pool.query(query, params);
      return rows[0] || null;

    } catch (error) {
      throw error;
    }
  },

  // Listar proyectos con filtros según rol
  listar: async (filtros) => {
    const {
      usuarioId,
      usuarioRol,
      estado,
      jefeProyectoId,
      page = 1,
      limit = 10,
      soloMisProyectos = false,
      search = ''
    } = filtros;

    const offset = (page - 1) * limit;
    let whereClause = 'p.Activo = 1';
    const queryParams = [];

    const [empleado] = await pool.query(`
      SELECT ID FROM empleados WHERE UsuarioID = ?
    `, [usuarioId]);
    
    const empleadoId = empleado[0]?.ID;

    if (estado) {
      whereClause += ' AND p.Estado = ?';
      queryParams.push(estado);
    }

    if (jefeProyectoId) {
      whereClause += ' AND p.JefeProyectoID = ?';
      queryParams.push(jefeProyectoId);
    }

    if (search) {
      whereClause += ' AND (p.Nombre LIKE ? OR p.Descripcion LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (usuarioRol !== 'admin') {
      if (soloMisProyectos) {
        whereClause += ' AND p.JefeProyectoID = ?';
        queryParams.push(empleadoId);
      } else {
        whereClause += ` AND (
          p.JefeProyectoID = ?
          OR p.ID IN (
            SELECT pe.ProyectoID 
            FROM proyecto_empleados pe
            WHERE pe.EmpleadoID = ? AND pe.Activo = 1
          )
        )`;
        queryParams.push(empleadoId, empleadoId);
      }
    }

    const [rows] = await pool.query(`
      SELECT 
        p.*,
        e.NombreCompleto as JefeProyectoNombre,
        e.CorreoElectronico as JefeProyectoEmail,
        COUNT(DISTINCT pe.EmpleadoID) as TotalEmpleados,
        COUNT(DISTINCT t.ID) as TotalTareas,
        COUNT(DISTINCT CASE WHEN t.Estado = 'realizada' THEN t.ID END) as TareasCompletadas
      FROM proyectos p
      LEFT JOIN empleados e ON p.JefeProyectoID = e.ID
      LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID AND pe.Activo = 1
      LEFT JOIN tareas t ON p.ID = t.ProyectoID AND t.Activo = 1
      WHERE ${whereClause}
      GROUP BY p.ID
      ORDER BY p.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT p.ID) as total
      FROM proyectos p
      WHERE ${whereClause}
    `, queryParams);

    return {
      proyectos: rows,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    };
  },

  // Actualizar proyecto
  actualizar: async (proyectoId, proyectoData, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const campos = [];
      const valores = [];

      const camposPermitidos = ['nombre', 'descripcion', 'fechaFin', 'estado', 'presupuesto', 'montoAsignado', 'moneda'];
      
      Object.keys(proyectoData).forEach(key => {
        if (camposPermitidos.includes(key) && proyectoData[key] !== undefined) {
          const campoDB = key === 'nombre' ? 'Nombre' :
                         key === 'descripcion' ? 'Descripcion' :
                         key === 'fechaFin' ? 'FechaFin' :
                         key === 'estado' ? 'Estado' :
                         key === 'presupuesto' ? 'Presupuesto' :
                         key === 'montoAsignado' ? 'MontoAsignado' :
                         key === 'moneda' ? 'Moneda' : null;
          
          if (campoDB) {
            campos.push(`${campoDB} = ?`);
            valores.push(proyectoData[key]);
          }
        }
      });

      if (campos.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      valores.push(proyectoId);

      const [result] = await connection.query(`
        UPDATE proyectos 
        SET ${campos.join(', ')}
        WHERE ID = ? AND Activo = 1
      `, valores);

      if (result.affectedRows === 0) {
        throw new Error('Proyecto no encontrado');
      }

      await connection.query(`
        INSERT INTO proyecto_historial (ProyectoID, Accion, Detalles, UsuarioID)
        VALUES (?, 'proyecto_actualizado', ?, ?)
      `, [proyectoId, `Actualizado por usuario ID: ${usuarioId}`, usuarioId]);

      await connection.commit();

      const [proyecto] = await connection.query(`
        SELECT * FROM proyectos WHERE ID = ?
      `, [proyectoId]);

      return proyecto[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Asignar empleado a proyecto
  asignarEmpleado: async (proyectoId, empleadoId, asignadoPor) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [existente] = await connection.query(`
        SELECT ID, Activo FROM proyecto_empleados 
        WHERE ProyectoID = ? AND EmpleadoID = ?
      `, [proyectoId, empleadoId]);

      if (existente.length > 0) {
        if (existente[0].Activo === 1) {
          throw new Error('El empleado ya está asignado a este proyecto');
        } else {
          // Reactivar asignación existente
          await connection.query(`
            UPDATE proyecto_empleados 
            SET Activo = 1, FechaAsignacion = CURDATE(), AsignadoPor = ?, updatedAt = NOW()
            WHERE ID = ?
          `, [asignadoPor, existente[0].ID]);
        }
      } else {
        await connection.query(`
          INSERT INTO proyecto_empleados (
            ProyectoID, EmpleadoID, Rol, FechaAsignacion, AsignadoPor
          ) VALUES (?, ?, 'miembro', CURDATE(), ?)
        `, [proyectoId, empleadoId, asignadoPor]);
      }

      await connection.query(`
        INSERT INTO proyecto_historial (ProyectoID, Accion, Detalles, UsuarioID)
        VALUES (?, 'empleado_asignado', ?, ?)
      `, [proyectoId, `Empleado ID: ${empleadoId} asignado`, asignadoPor]);

      // Obtener información del empleado
      const [empleado] = await connection.query(`
        SELECT ID, NombreCompleto, CorreoElectronico 
        FROM empleados WHERE ID = ?
      `, [empleadoId]);

      await connection.commit();

      return {
        success: true,
        proyectoId,
        asignacion: {
          empleadoId,
          empleadoNombre: empleado[0]?.NombreCompleto || 'Desconocido',
          empleadoEmail: empleado[0]?.CorreoElectronico,
          fechaAsignacion: new Date()
        }
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Quitar empleado de proyecto
  quitarEmpleado: async (proyectoId, empleadoId, usuarioId) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [proyecto] = await connection.query(`
        SELECT JefeProyectoID FROM proyectos WHERE ID = ?
      `, [proyectoId]);

      if (proyecto[0]?.JefeProyectoID === parseInt(empleadoId)) {
        throw new Error('No se puede quitar al jefe del proyecto');
      }

      // Obtener información del empleado antes de quitar
      const [empleado] = await connection.query(`
        SELECT NombreCompleto FROM empleados WHERE ID = ?
      `, [empleadoId]);

      const [result] = await connection.query(`
        UPDATE proyecto_empleados 
        SET Activo = 0, updatedAt = NOW()
        WHERE ProyectoID = ? AND EmpleadoID = ? AND Activo = 1
      `, [proyectoId, empleadoId]);

      if (result.affectedRows === 0) {
        throw new Error('El empleado no está asignado a este proyecto');
      }

      // Desactivar asignaciones de tareas del empleado en este proyecto
      await connection.query(`
        UPDATE tarea_asignaciones ta
        JOIN tareas t ON ta.TareaID = t.ID
        SET ta.Activo = 0, ta.updatedAt = NOW()
        WHERE t.ProyectoID = ? AND ta.EmpleadoID = ? AND ta.Activo = 1
      `, [proyectoId, empleadoId]);

      await connection.query(`
        INSERT INTO proyecto_historial (ProyectoID, Accion, Detalles, UsuarioID)
        VALUES (?, 'empleado_removido', ?, ?)
      `, [proyectoId, `Empleado ${empleado[0]?.NombreCompleto || empleadoId} removido del proyecto`, usuarioId]);

      await connection.commit();

      return {
        success: true,
        proyectoId,
        empleadoId,
        empleadoNombre: empleado[0]?.NombreCompleto || 'Desconocido',
        removido: true
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener empleados del proyecto
   obtenerEmpleados: async (proyectoId, usuarioId, usuarioRol) => {
    try {
      const [usuarioEmpleado] = await pool.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);
      
      const empleadoId = usuarioEmpleado[0]?.ID;

      if (usuarioRol !== 'admin') {
        const [acceso] = await pool.query(`
          SELECT 1 FROM proyectos p
          LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID AND pe.Activo = 1
          WHERE p.ID = ? AND p.Activo = 1
            AND (p.JefeProyectoID = ? OR pe.EmpleadoID = ?)
        `, [proyectoId, empleadoId, empleadoId]);

        if (acceso.length === 0) {
          throw new Error('No tienes acceso a este proyecto');
        }
      }

      const [rows] = await pool.query(`
        SELECT 
          e.ID,
          e.NombreCompleto,
          e.CorreoElectronico,
          e.FechaIngreso,
          e.RFC,
          e.CURP,
          e.RolApp,
          p.Nombre as PuestoNombre,
          d.Nombre as DepartamentoNombre,
          d.ID as DepartamentoID,
          pe.Rol,
          pe.FechaAsignacion,
          pe.createdAt,
          u.Usuario as AsignadoPorUsuario,
          (SELECT COUNT(*) FROM tarea_asignaciones ta 
           JOIN tareas t ON ta.TareaID = t.ID
           WHERE ta.EmpleadoID = e.ID AND t.ProyectoID = ? AND ta.Activo = 1) as TareasActivas,
          'asignado' as EstadoAsignacion,
          DATE_FORMAT(pe.FechaAsignacion, '%d/%m/%Y') as FechaAsignacionFormateada
        FROM proyecto_empleados pe
        JOIN empleados e ON pe.EmpleadoID = e.ID
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        LEFT JOIN empleadodepartamentos ed ON e.ID = ed.EmpleadoID
        LEFT JOIN departamentos d ON ed.DepartamentoID = d.ID
        LEFT JOIN usuarios u ON pe.AsignadoPor = u.ID
        WHERE pe.ProyectoID = ? AND pe.Activo = 1
        ORDER BY 
          CASE 
            WHEN pe.Rol = 'jefe' THEN 0
            ELSE 1
          END,
          e.NombreCompleto
      `, [proyectoId, proyectoId]);

      return rows;

    } catch (error) {
      throw error;
    }
  },

  // Verificar si usuario tiene acceso al proyecto
  verificarAcceso: async (proyectoId, usuarioId, usuarioRol) => {
    try {
      if (usuarioRol === 'admin') {
        return true;
      }

      const [usuarioEmpleado] = await pool.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);
      
      const empleadoId = usuarioEmpleado[0]?.ID;

      const [acceso] = await pool.query(`
        SELECT 1 FROM proyectos p
        LEFT JOIN proyecto_empleados pe ON p.ID = pe.ProyectoID AND pe.Activo = 1
        WHERE p.ID = ? AND p.Activo = 1
          AND (p.JefeProyectoID = ? OR pe.EmpleadoID = ?)
      `, [proyectoId, empleadoId, empleadoId]);

      return acceso.length > 0;

    } catch (error) {
      throw error;
    }
  },

  // Obtener empleados disponibles para asignar (DOS MODOS)
  obtenerEmpleadosDisponibles: async (proyectoId, jefeId, usuarioRol, filtros = {}) => {
    try {
      const { departamentoId, search = '', modo = 'supervisados', incluirAsignados = false } = filtros;
      
      // Obtener IDs de empleados ya asignados al proyecto
      const [asignados] = await pool.query(`
        SELECT EmpleadoID FROM proyecto_empleados 
        WHERE ProyectoID = ? AND Activo = 1
      `, [proyectoId]);
      
      const empleadosAsignadosIds = asignados.map(a => a.EmpleadoID);
      
      // Construir consulta base
      let query = `
        SELECT 
          e.ID,
          e.NombreCompleto,
          e.CorreoElectronico,
          e.FechaIngreso,
          e.RFC,
          e.CURP,
          e.RolApp,
          p.Nombre as PuestoNombre,
          d.Nombre as DepartamentoNombre,
          d.ID as DepartamentoID,
          u.Activo,
          TIMESTAMPDIFF(YEAR, e.FechaIngreso, CURDATE()) as AntiguedadAnios,
          CASE 
            WHEN EXISTS (SELECT 1 FROM empleadojefes ej WHERE ej.JefeID = ? AND ej.EmpleadoID = e.ID) THEN 1 
            ELSE 0 
          END as EsSubordinado,
          (SELECT COUNT(*) FROM tarea_asignaciones ta 
           JOIN tareas t ON ta.TareaID = t.ID
           WHERE ta.EmpleadoID = e.ID AND ta.Activo = 1) as TareasPendientes,
          (SELECT COUNT(*) FROM proyectos pj 
           JOIN proyecto_empleados pe ON pj.ID = pe.ProyectoID
           WHERE pe.EmpleadoID = e.ID AND pe.Activo = 1 AND pj.Estado = 'activo') as ProyectosActivos
      `;

      const params = [jefeId];

      // Agregar campo de estado de asignación
      if (empleadosAsignadosIds.length > 0) {
        query += `,
          CASE 
            WHEN e.ID IN (${empleadosAsignadosIds.map(() => '?').join(',')}) THEN 'asignado'
            ELSE 'no_asignado'
          END as EstadoAsignacion
        `;
        params.push(...empleadosAsignadosIds);
      } else {
        query += `,
          'no_asignado' as EstadoAsignacion
        `;
      }

      query += `,
        CASE 
          WHEN e.ID = ? THEN 'jefe_proyecto'
          ELSE 'empleado'
        END as RolEnProyecto
      `;
      params.push(jefeId);

      query += `
        FROM empleados e
        INNER JOIN usuarios u ON e.UsuarioID = u.ID
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        LEFT JOIN empleadodepartamentos ed ON e.ID = ed.EmpleadoID
        LEFT JOIN departamentos d ON ed.DepartamentoID = d.ID
        WHERE u.Activo = 1
      `;

      // Excluir empleados ya asignados (si no se pide incluirlos)
      if (!incluirAsignados && empleadosAsignadosIds.length > 0) {
        query += ` AND e.ID NOT IN (${empleadosAsignadosIds.map(() => '?').join(',')})`;
        params.push(...empleadosAsignadosIds);
      }

      // MODO 1: Solo empleados bajo supervisión del jefe
      if (modo === 'supervisados') {
        query += ` AND EXISTS (SELECT 1 FROM empleadojefes ej WHERE ej.JefeID = ? AND ej.EmpleadoID = e.ID)`;
        params.push(jefeId);
      } 
      // MODO 2: Todos los empleados de la empresa
      else if (modo === 'todos') {
        // Excluir al jefe del proyecto
        query += ` AND e.ID != ?`;
        params.push(jefeId);
      }

      // Filtro por departamento
      if (departamentoId) {
        query += ` AND d.ID = ?`;
        params.push(departamentoId);
      }

      // Búsqueda por texto
      if (search) {
        query += ` AND (e.NombreCompleto LIKE ? OR e.CorreoElectronico LIKE ? OR e.RFC LIKE ? OR e.CURP LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += `
        GROUP BY e.ID
        ORDER BY 
          CASE 
            WHEN e.ID = ? THEN 0  -- Jefe del proyecto primero
            ELSE 1
          END,
          e.NombreCompleto
        LIMIT 100
      `;
      params.push(jefeId);

      const [rows] = await pool.query(query, params);

      // Agrupar por estado de asignación
      const resultado = {
        empleados: rows,
        modo,
        total: rows.length,
        totalAsignados: rows.filter(r => r.EstadoAsignacion === 'asignado').length,
        totalNoAsignados: rows.filter(r => r.EstadoAsignacion === 'no_asignado').length,
        empleadosAsignadosIds,
        filtrosAplicados: {
          modo,
          departamentoId: departamentoId || null,
          search: search || null,
          incluirAsignados
        }
      };

      return resultado;

    } catch (error) {
      throw error;
    }
  },

    // Buscar empleados general con filtros
    buscarEmpleadosGenerales: async (proyectoId, usuarioId, usuarioRol, filtros = {}) => {
    try {
      const { 
        departamentoId, 
        search = '', 
        soloNoAsignados = true,
        incluirJefe = false,
        page = 1,
        limit = 20
      } = filtros;

      const offset = (page - 1) * limit;
      const esAdmin = usuarioRol === 'admin';
      
      // Obtener ID del empleado del usuario
      const [usuarioEmpleado] = await pool.query(`
        SELECT ID FROM empleados WHERE UsuarioID = ?
      `, [usuarioId]);
      
      const empleadoId = usuarioEmpleado[0]?.ID;

      // Obtener IDs de empleados ya asignados al proyecto
      const [asignados] = await pool.query(`
        SELECT EmpleadoID FROM proyecto_empleados 
        WHERE ProyectoID = ? AND Activo = 1
      `, [proyectoId]);
      
      const empleadosAsignadosIds = asignados.map(a => a.EmpleadoID);

      // Obtener jefe del proyecto
      const [proyecto] = await pool.query(`
        SELECT JefeProyectoID FROM proyectos WHERE ID = ?
      `, [proyectoId]);
      
      const jefeProyectoId = proyecto[0]?.JefeProyectoID;

      // Construir consulta
      let query = `
        SELECT 
          e.ID,
          e.NombreCompleto,
          e.CorreoElectronico,
          e.FechaIngreso,
          e.RFC,
          e.CURP,
          e.RolApp,
          p.Nombre as PuestoNombre,
          d.Nombre as DepartamentoNombre,
          d.ID as DepartamentoID,
          u.Activo,
          TIMESTAMPDIFF(YEAR, e.FechaIngreso, CURDATE()) as AntiguedadAnios,
          CASE 
            WHEN EXISTS (SELECT 1 FROM empleadojefes ej WHERE ej.JefeID = ? AND ej.EmpleadoID = e.ID) THEN 1 
            ELSE 0 
          END as EsSubordinado,
          (SELECT COUNT(*) FROM proyecto_empleados pe WHERE pe.EmpleadoID = e.ID AND pe.Activo = 1) as ProyectosAsignados,
          (SELECT COUNT(*) FROM tarea_asignaciones ta WHERE ta.EmpleadoID = e.ID AND ta.Activo = 1) as TareasAsignadas
      `;

      const params = [empleadoId];

      // Agregar estado de asignación
      if (empleadosAsignadosIds.length > 0) {
        query += `,
          CASE 
            WHEN e.ID IN (${empleadosAsignadosIds.map(() => '?').join(',')}) THEN 'asignado'
            ELSE 'no_asignado'
          END as EstadoAsignacion
        `;
        params.push(...empleadosAsignadosIds);
      } else {
        query += `,
          'no_asignado' as EstadoAsignacion
        `;
      }

      query += `,
        CASE 
          WHEN e.ID = ? THEN 'jefe_proyecto'
          ELSE 'empleado'
        END as RolEnProyecto
      `;
      params.push(jefeProyectoId || 0);

      query += `
        FROM empleados e
        INNER JOIN usuarios u ON e.UsuarioID = u.ID
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        LEFT JOIN empleadodepartamentos ed ON e.ID = ed.EmpleadoID
        LEFT JOIN departamentos d ON ed.DepartamentoID = d.ID
        WHERE u.Activo = 1
      `;

      // Filtro para excluir asignados
      if (soloNoAsignados && empleadosAsignadosIds.length > 0) {
        query += ` AND e.ID NOT IN (${empleadosAsignadosIds.map(() => '?').join(',')})`;
        params.push(...empleadosAsignadosIds);
      }

      // Excluir al jefe del proyecto si no se quiere incluir
      if (!incluirJefe && jefeProyectoId) {
        query += ` AND e.ID != ?`;
        params.push(jefeProyectoId);
      }

      // Filtro por departamento
      if (departamentoId) {
        query += ` AND d.ID = ?`;
        params.push(departamentoId);
      }

      // Búsqueda por texto
      if (search) {
        query += ` AND (e.NombreCompleto LIKE ? OR e.CorreoElectronico LIKE ? OR e.RFC LIKE ? OR e.CURP LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      // Si no es admin, solo mostrar empleados de su mismo departamento o bajo su supervisión
      if (!esAdmin && empleadoId) {
        query += ` AND (
          EXISTS (SELECT 1 FROM empleadojefes ej WHERE ej.JefeID = ? AND ej.EmpleadoID = e.ID)
          OR EXISTS (
            SELECT 1 FROM empleadodepartamentos ed2
            WHERE ed2.EmpleadoID = e.ID 
            AND ed2.DepartamentoID IN (
              SELECT DepartamentoID FROM empleadodepartamentos WHERE EmpleadoID = ?
            )
          )
        )`;
        params.push(empleadoId, empleadoId);
      }

      // Contar total antes de paginación
      const countQuery = `
        SELECT COUNT(DISTINCT e.ID) as total
        FROM empleados e
        INNER JOIN usuarios u ON e.UsuarioID = u.ID
        LEFT JOIN empleadodepartamentos ed ON e.ID = ed.EmpleadoID
        LEFT JOIN departamentos d ON ed.DepartamentoID = d.ID
        WHERE ${query.split('WHERE')[1].split('GROUP BY')[0]}
      `;
      
      // Extraer la parte WHERE para el count
      const wherePart = query.split('WHERE')[1].split('GROUP BY')[0];
      const countParams = params.slice(0, params.length - 2); // Ajustar según sea necesario
      
      const [countResult] = await pool.query(countQuery, countParams);

      query += `
        GROUP BY e.ID
        ORDER BY 
          CASE 
            WHEN e.EstadoAsignacion = 'asignado' THEN 1
            ELSE 2
          END,
          e.NombreCompleto
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);

      const [rows] = await pool.query(query, params);

      return {
        empleados: rows,
        pagination: {
          page,
          limit,
          total: countResult[0]?.total || 0,
          totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
        },
        filtros: {
          soloNoAsignados,
          incluirJefe,
          departamentoId: departamentoId || null,
          search: search || null
        }
      };

    } catch (error) {
      throw error;
    }
  },

  // Obtener historial del proyecto
  obtenerHistorial: async (proyectoId, usuarioId, usuarioRol) => {
    try {
      const tieneAcceso = await Proyecto.verificarAcceso(proyectoId, usuarioId, usuarioRol);
      if (!tieneAcceso) {
        throw new Error('No tienes acceso a este proyecto');
      }

      const [rows] = await pool.query(`
        SELECT 
          ph.*,
          u.Usuario as UsuarioNombre,
          e.NombreCompleto as EmpleadoNombre
        FROM proyecto_historial ph
        LEFT JOIN usuarios u ON ph.UsuarioID = u.ID
        LEFT JOIN empleados e ON e.UsuarioID = u.ID
        WHERE ph.ProyectoID = ?
        ORDER BY ph.createdAt DESC
      `, [proyectoId]);

      return rows;

    } catch (error) {
      throw error;
    }
  }
};



module.exports = Proyecto;
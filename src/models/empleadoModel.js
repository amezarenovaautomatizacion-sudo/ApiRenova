const { pool } = require('../config/database');

const Empleado = {
  // Crear nuevo empleado
    create: async (empleadoData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Obtener RolID del rolApp
      const [rolResult] = await connection.query(
        'SELECT ID FROM Roles WHERE Nombre = ?',
        [empleadoData.rolApp]
      );
      
      if (rolResult.length === 0) {
        throw new Error('Rol no encontrado');
      }

      const rolId = rolResult[0].ID;

      // 1. Primero crear el usuario con RolID
      const [userResult] = await connection.query(
        'INSERT INTO Usuarios (Usuario, Contrasenia, Rol, RolID) VALUES (?, ?, ?, ?)',
        [empleadoData.correoElectronico, empleadoData.contrasenia, empleadoData.rolApp, rolId]
      );
      
      const usuarioId = userResult.insertId;

      // 2. Crear el empleado (resto del código igual)
      const [empleadoResult] = await connection.query(
        `INSERT INTO Empleados (
          UsuarioID, NombreCompleto, Celular, CorreoElectronico, 
          FechaIngreso, FechaNacimiento, Direccion, NSS, RFC, CURP, 
          TelefonoEmergencia, PuestoID, RolApp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuarioId,
          empleadoData.nombreCompleto,
          empleadoData.celular,
          empleadoData.correoElectronico,
          empleadoData.fechaIngreso,
          empleadoData.fechaNacimiento,
          empleadoData.direccion,
          empleadoData.nss,
          empleadoData.rfc,
          empleadoData.curp,
          empleadoData.telefonoEmergencia,
          empleadoData.puestoId,
          empleadoData.rolApp
        ]
      );

      const empleadoId = empleadoResult.insertId;

      // 3. Asignar departamentos si existen
      if (empleadoData.departamentos && empleadoData.departamentos.length > 0) {
        const deptoValues = empleadoData.departamentos.map(deptoId => 
          [empleadoId, deptoId]
        );
        await connection.query(
          'INSERT INTO EmpleadoDepartamentos (EmpleadoID, DepartamentoID) VALUES ?',
          [deptoValues]
        );
      }

      // 4. Asignar jefes si existen
      if (empleadoData.jefes && empleadoData.jefes.length > 0) {
        const jefeValues = empleadoData.jefes.map(jefeId => 
          [empleadoId, jefeId]
        );
        await connection.query(
          'INSERT INTO EmpleadoJefes (EmpleadoID, JefeID) VALUES ?',
          [jefeValues]
        );
      }

      await connection.commit();

      return {
        id: empleadoId,
        usuarioId: usuarioId,
        nombreCompleto: empleadoData.nombreCompleto,
        correoElectronico: empleadoData.correoElectronico,
        rolApp: empleadoData.rolApp
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Obtener empleado por ID de usuario
  findByUsuarioId: async (usuarioId) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          e.*,
          p.Nombre as PuestoNombre,
          p.Descripcion as PuestoDescripcion,
          u.Rol as UsuarioRol
         FROM Empleados e
         LEFT JOIN Puestos p ON e.PuestoID = p.ID
         LEFT JOIN Usuarios u ON e.UsuarioID = u.ID
         WHERE e.UsuarioID = ? AND u.Activo = TRUE`,
        [usuarioId]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Obtener empleado por ID de empleado
  findById: async (id) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          e.*,
          p.Nombre as PuestoNombre,
          p.Descripcion as PuestoDescripcion,
          u.Rol as UsuarioRol
         FROM Empleados e
         LEFT JOIN Puestos p ON e.PuestoID = p.ID
         LEFT JOIN Usuarios u ON e.UsuarioID = u.ID
         WHERE e.ID = ? AND u.Activo = TRUE`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  },

  // Obtener todos los empleados (con paginación)
  findAll: async (page = 1, limit = 10) => {
    try {
      const offset = (page - 1) * limit;
      
      const [rows] = await pool.query(
        `SELECT 
          e.ID,
          e.NombreCompleto,
          e.CorreoElectronico,
          e.RolApp,
          e.FechaIngreso,
          p.Nombre as PuestoNombre,
          u.Activo as UsuarioActivo
         FROM Empleados e
         LEFT JOIN Puestos p ON e.PuestoID = p.ID
         LEFT JOIN Usuarios u ON e.UsuarioID = u.ID
         WHERE u.Activo = TRUE
         ORDER BY e.NombreCompleto
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total 
         FROM Empleados e
         LEFT JOIN Usuarios u ON e.UsuarioID = u.ID
         WHERE u.Activo = TRUE`
      );

      return {
        empleados: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit)
        }
      };

    } catch (error) {
      throw error;
    }
  },

  // Obtener departamentos del empleado
  getDepartamentos: async (empleadoId) => {
    try {
      const [rows] = await pool.query(
        `SELECT d.* 
         FROM Departamentos d
         JOIN EmpleadoDepartamentos ed ON d.ID = ed.DepartamentoID
         WHERE ed.EmpleadoID = ? AND d.Activo = TRUE`,
        [empleadoId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Obtener jefes del empleado
  getJefes: async (empleadoId) => {
    try {
      const [rows] = await pool.query(
        `SELECT 
          j.ID,
          j.NombreCompleto,
          j.CorreoElectronico,
          j.RolApp,
          p.Nombre as PuestoNombre
         FROM Empleados j
         LEFT JOIN Puestos p ON j.PuestoID = p.ID
         JOIN EmpleadoJefes ej ON j.ID = ej.JefeID
         WHERE ej.EmpleadoID = ?`,
        [empleadoId]
      );
      return rows;
    } catch (error) {
      throw error;
    }
  },

  // Actualizar empleado y sincronizar rol en usuarios
  update: async (id, empleadoData) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Actualizar la tabla Empleados
      const [resultEmpleado] = await connection.query(
        `UPDATE Empleados 
        SET NombreCompleto = ?, Celular = ?, FechaNacimiento = ?, 
            Direccion = ?, NSS = ?, RFC = ?, CURP = ?, 
            TelefonoEmergencia = ?, PuestoID = ?, RolApp = ?
        WHERE ID = ?`,
        [
          empleadoData.nombreCompleto,
          empleadoData.celular,
          empleadoData.fechaNacimiento,
          empleadoData.direccion,
          empleadoData.nss,
          empleadoData.rfc,
          empleadoData.curp,
          empleadoData.telefonoEmergencia,
          empleadoData.puestoId,
          empleadoData.rolApp,
          id
        ]
      );

      // Obtener el rol y rolID correspondiente de la tabla Roles
      const [rol] = await connection.query(
        `SELECT ID, Nombre FROM Roles WHERE Nombre = ?`,
        [empleadoData.rolApp]
      );

      if (rol.length === 0) {
        throw new Error(`No se encontró el rol '${empleadoData.rolApp}' en la tabla Roles`);
      }

      const rolID = rol[0].ID;
      const rolNombre = rol[0].Nombre;

      // Actualizar la tabla Usuarios
      await connection.query(
        `UPDATE Usuarios 
        SET Rol = ?, RolID = ?
        WHERE ID = ?`,
        [rolNombre, rolID, id]
      );

      await connection.commit();
      return resultEmpleado.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Actualizar departamentos del empleado
  updateDepartamentos: async (empleadoId, departamentos) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Eliminar asignaciones actuales
      await connection.query(
        'DELETE FROM EmpleadoDepartamentos WHERE EmpleadoID = ?',
        [empleadoId]
      );

      // Insertar nuevas asignaciones si hay
      if (departamentos && departamentos.length > 0) {
        const deptoValues = departamentos.map(deptoId => 
          [empleadoId, deptoId]
        );
        await connection.query(
          'INSERT INTO EmpleadoDepartamentos (EmpleadoID, DepartamentoID) VALUES ?',
          [deptoValues]
        );
      }

      await connection.commit();
      return true;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // Actualizar jefes del empleado
  updateJefes: async (empleadoId, jefes) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Eliminar asignaciones actuales
      await connection.query(
        'DELETE FROM EmpleadoJefes WHERE EmpleadoID = ?',
        [empleadoId]
      );

      // Insertar nuevas asignaciones si hay
      if (jefes && jefes.length > 0) {
        const jefeValues = jefes.map(jefeId => 
          [empleadoId, jefeId]
        );
        await connection.query(
          'INSERT INTO EmpleadoJefes (EmpleadoID, JefeID) VALUES ?',
          [jefeValues]
        );
      }

      await connection.commit();
      return true;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = Empleado;
const Empleado = require('../models/empleadoModel');
const Catalogo = require('../models/catalogoModel');
const { hashPassword } = require('../utils/bcrypt');

const empleadoController = {
  // Crear nuevo empleado
  crearEmpleado: async (req, res, next) => {
    try {
      const {
        nombreCompleto,
        celular,
        correoElectronico,
        contrasenia,
        fechaIngreso,
        fechaNacimiento,
        direccion,
        nss,
        rfc,
        curp,
        telefonoEmergencia,
        puestoId,
        rolApp,
        departamentos,
        jefes
      } = req.body;

      const camposRequeridos = [
        'nombreCompleto',
        'correoElectronico',
        'contrasenia',
        'fechaIngreso',
        'fechaNacimiento',
        'rolApp'
      ];

      const faltantes = camposRequeridos.filter(campo => !req.body[campo]);
      if (faltantes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Campos requeridos faltantes: ${faltantes.join(', ')}`
        });
      }

      const fechaIngresoDate = new Date(fechaIngreso);
      const fechaNacimientoDate = new Date(fechaNacimiento);

      if (isNaN(fechaIngresoDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de ingreso inválido'
        });
      }

      if (isNaN(fechaNacimientoDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha de nacimiento inválido'
        });
      }

      const hashedPassword = await hashPassword(contrasenia);

      const empleadoData = {
        nombreCompleto,
        celular: celular || null,
        correoElectronico,
        contrasenia: hashedPassword,
        fechaIngreso: fechaIngresoDate.toISOString().split('T')[0],
        fechaNacimiento: fechaNacimientoDate.toISOString().split('T')[0],
        direccion: direccion || null,
        nss: nss || null,
        rfc: rfc || null,
        curp: curp || null,
        telefonoEmergencia: telefonoEmergencia || null,
        puestoId: puestoId || null,
        rolApp,
        departamentos: departamentos || [],
        jefes: jefes || []
      };

      const nuevoEmpleado = await Empleado.create(empleadoData);

      res.status(201).json({
        success: true,
        message: 'Empleado creado exitosamente',
        data: nuevoEmpleado
      });

    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('Usuarios.Usuario')) {
          return res.status(400).json({
            success: false,
            message: 'El correo electrónico ya está registrado como usuario'
          });
        } else if (error.sqlMessage.includes('Empleados.CorreoElectronico')) {
          return res.status(400).json({
            success: false,
            message: 'El correo electrónico ya está registrado para otro empleado'
          });
        } else if (error.sqlMessage.includes('Empleados.NSS')) {
          return res.status(400).json({
            success: false,
            message: 'El NSS ya está registrado'
          });
        } else if (error.sqlMessage.includes('Empleados.RFC')) {
          return res.status(400).json({
            success: false,
            message: 'El RFC ya está registrado'
          });
        } else if (error.sqlMessage.includes('Empleados.CURP')) {
          return res.status(400).json({
            success: false,
            message: 'El CURP ya está registrado'
          });
        }
      }
      next(error);
    }
  },

  // Obtener todos los empleados (filtrado por rol)
  obtenerEmpleados: async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const usuarioRol = req.user.rol;
      const search = req.query.search || '';
      const rolFilter = req.query.rol || '';

      let query;
      let countQuery;
      const queryParams = [];
      const countParams = [];

      let whereClause = 'WHERE u.Activo = TRUE';
      
      // Agregar búsqueda si existe
      if (search) {
        whereClause += ` AND (e.NombreCompleto LIKE ? OR e.CorreoElectronico LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
      }
      
      // Agregar filtro por rol si existe
      if (rolFilter) {
        whereClause += ` AND e.RolApp = ?`;
        queryParams.push(rolFilter);
        countParams.push(rolFilter);
      }

      // Agregar parámetros de paginación
      queryParams.push(limit, (page - 1) * limit);

      if (usuarioRol === 'admin') {
        query = `
          SELECT e.*, p.Nombre AS PuestoNombre, u.Activo AS UsuarioActivo
          FROM empleados e
          LEFT JOIN puestos p ON e.PuestoID = p.ID
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          ${whereClause}
          ORDER BY e.NombreCompleto
          LIMIT ? OFFSET ?
        `;
        countQuery = `
          SELECT COUNT(*) AS total
          FROM empleados e
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          ${whereClause.replace(/\?/g, () => countParams.shift() || '?')}
        `;
      } else {
        query = `
          SELECT
            e.ID,
            e.NombreCompleto,
            e.CorreoElectronico,
            e.RolApp,
            e.FechaIngreso,
            e.Celular,
            p.Nombre AS PuestoNombre,
            u.Activo AS UsuarioActivo
          FROM empleados e
          LEFT JOIN puestos p ON e.PuestoID = p.ID
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          ${whereClause}
          ORDER BY e.NombreCompleto
          LIMIT ? OFFSET ?
        `;
        countQuery = `
          SELECT COUNT(*) AS total
          FROM empleados e
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          ${whereClause.replace(/\?/g, () => countParams.shift() || '?')}
        `;
      }

      const [rows] = await req.app.locals.db.query(query, queryParams);
      const [countResult] = await req.app.locals.db.query(countQuery, countParams);

      res.status(200).json({
        success: true,
        data: {
          empleados: rows,
          pagination: {
            page,
            limit,
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  },

// Obtener empleado por ID (filtrado por rol)
obtenerEmpleado: async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarioRol = req.user.rol;

    let empleado;

    if (usuarioRol === 'admin') {
      const [rows] = await req.app.locals.db.query(
        `
        SELECT e.*, p.Nombre AS PuestoNombre, p.Descripcion AS PuestoDescripcion
        FROM empleados e
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        WHERE e.ID = ?
        `,
        [id]
      );
      empleado = rows[0];
    } else {
      const [rows] = await req.app.locals.db.query(
        `
        SELECT
          e.ID,
          e.NombreCompleto,
          e.CorreoElectronico,
          e.RolApp,
          e.FechaIngreso,
          e.FechaNacimiento,
          e.Celular,
          e.TelefonoEmergencia,
          p.Nombre AS PuestoNombre,
          u.Activo AS UsuarioActivo
        FROM empleados e
        LEFT JOIN puestos p ON e.PuestoID = p.ID
        LEFT JOIN usuarios u ON e.UsuarioID = u.ID
        WHERE e.ID = ?
        `,
        [id]
      );
      empleado = rows[0];

      if (empleado && empleado.FechaNacimiento) {
        const fecha = new Date(empleado.FechaNacimiento);
        empleado.FechaNacimiento = fecha.toISOString().split('T')[0];
      }
    }

    if (!empleado) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    // Obtener estado del usuario
    const [userRows] = await req.app.locals.db.query(
      'SELECT Activo FROM usuarios WHERE ID = ?',
      [empleado.UsuarioID]
    );
    empleado.UsuarioActivo = userRows[0]?.Activo || false;

    // Obtener departamentos del empleado
    const [departamentosRows] = await req.app.locals.db.query(
      `SELECT d.* 
       FROM departamentos d
       INNER JOIN empleadodepartamentos ed ON d.ID = ed.DepartamentoID
       WHERE ed.EmpleadoID = ? AND d.Activo = TRUE
       ORDER BY d.Nombre`,
      [id]
    );

    // Obtener jefes del empleado
    const [jefesRows] = await req.app.locals.db.query(
      `SELECT 
        j.ID,
        j.NombreCompleto,
        j.CorreoElectronico,
        j.RolApp,
        p.Nombre as PuestoNombre
       FROM empleados j
       LEFT JOIN puestos p ON j.PuestoID = p.ID
       INNER JOIN empleadojefes ej ON j.ID = ej.JefeID
       WHERE ej.EmpleadoID = ?
       ORDER BY j.NombreCompleto`,
      [id]
    );

    // LOG DETALLADO de cada jefe encontrado
    jefesRows.forEach((jefe, index) => {
    });

    res.status(200).json({
      success: true,
      data: {
        ...empleado,
        departamentos: departamentosRows,
        jefes: jefesRows
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerEmpleado:', error);
    next(error);
  }
},

  // Actualizar empleado
actualizarEmpleado: async (req, res, next) => {
  try {
    const { id } = req.params;
    const { departamentos, jefes, ...otrosCampos } = req.body;

    // Actualizar datos básicos
    await Empleado.update(id, otrosCampos);
    
    // Actualizar departamentos si vienen en la petición
    if (departamentos !== undefined) {
      await Empleado.updateDepartamentos(id, departamentos);
    }
    
    // Actualizar jefes si vienen en la petición
    if (jefes !== undefined) {
      await Empleado.updateJefes(id, jefes);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Empleado actualizado exitosamente' 
    });

  } catch (error) {
    console.error('❌ Error en actualizarEmpleado:', error);
    next(error);
  }
},

  // Cambiar estado del empleado (activar/desactivar)
  cambiarEstadoEmpleado: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { activo } = req.body;

      // Validar que se envió el estado
      if (activo === undefined) {
        return res.status(400).json({
          success: false,
          message: 'El campo "activo" es requerido'
        });
      }

      // Verificar que el empleado existe
      const [empleado] = await req.app.locals.db.query(
        `SELECT e.ID, e.UsuarioID, u.Activo 
         FROM empleados e
         JOIN usuarios u ON e.UsuarioID = u.ID
         WHERE e.ID = ?`,
        [id]
      );

      if (empleado.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      // Actualizar el estado del usuario asociado
      await req.app.locals.db.query(
        'UPDATE usuarios SET Activo = ? WHERE ID = ?',
        [activo, empleado[0].UsuarioID]
      );

      res.status(200).json({
        success: true,
        message: `Empleado ${activo ? 'activado' : 'desactivado'} exitosamente`,
        data: {
          id: parseInt(id),
          activo: activo
        }
      });

    } catch (error) {
      console.error('Error cambiando estado del empleado:', error);
      next(error);
    }
  },

// Eliminar empleado (soft delete)
eliminarEmpleado: async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verificar que el empleado existe
    const [empleado] = await req.app.locals.db.query(
      `SELECT e.ID, e.UsuarioID, u.Activo 
       FROM empleados e
       JOIN usuarios u ON e.UsuarioID = u.ID
       WHERE e.ID = ?`,
      [id]
    );

    if (empleado.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }

    // Verificar si ya está eliminado lógicamente
    if (!empleado[0].Activo) {
      return res.status(400).json({
        success: false,
        message: 'El empleado ya está desactivado'
      });
    }

    // Iniciar transacción
    const connection = await req.app.locals.db.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Desactivar el usuario (soft delete principal)
      await connection.query(
        'UPDATE usuarios SET Activo = FALSE WHERE ID = ?',
        [empleado[0].UsuarioID]
      );

      // 2. Opcional: Desactivar relaciones donde es jefe
      // (esto evita que aparezca en listados de jefes activos)
      // Pero mantenemos las relaciones históricas en la tabla
      
      await connection.commit();

      res.status(200).json({
        success: true,
        message: 'Empleado desactivado exitosamente (eliminado lógico)',
        data: {
          id: parseInt(id),
          activo: false
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error eliminando empleado:', error);
    next(error);
  }
},


  // Obtener catálogos
  obtenerCatalogos: async (req, res, next) => {
    try {
      const [puestos, departamentos, empleados] = await Promise.all([
        Catalogo.getPuestos(),
        Catalogo.getDepartamentos(),
        Catalogo.getEmpleadosSelect()
      ]);

      res.status(200).json({
        success: true,
        data: { puestos, departamentos, empleados }
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = empleadoController;
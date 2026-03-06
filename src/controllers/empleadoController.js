const Empleado = require('../models/empleadoModel');
const Catalogo = require('../models/catalogoModel');
const { hashPassword } = require('../utils/bcrypt');
const { formatArrayDates, formatDateFields } = require('../utils/dateFormatter');

const empleadoController = {
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

      const empleadoFormateado = formatDateFields(nuevoEmpleado, ['FechaIngreso', 'FechaNacimiento'], ['createdAt', 'updatedAt']);

      res.status(201).json({
        success: true,
        message: 'Empleado creado exitosamente',
        data: empleadoFormateado
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
      
      if (search) {
        whereClause += ` AND (e.NombreCompleto LIKE ? OR e.CorreoElectronico LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`);
        countParams.push(`%${search}%`, `%${search}%`);
      }
      
      if (rolFilter) {
        whereClause += ` AND e.RolApp = ?`;
        queryParams.push(rolFilter);
        countParams.push(rolFilter);
      }

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

      const empleadosFormateados = formatArrayDates(rows, ['FechaIngreso', 'FechaNacimiento'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          empleados: empleadosFormateados,
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
      }

      if (!empleado) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      empleado = formatDateFields(empleado, ['FechaIngreso', 'FechaNacimiento'], ['createdAt', 'updatedAt']);

      const [userRows] = await req.app.locals.db.query(
        'SELECT Activo FROM usuarios WHERE ID = ?',
        [empleado.UsuarioID]
      );
      empleado.UsuarioActivo = userRows[0]?.Activo || false;

      const [departamentosRows] = await req.app.locals.db.query(
        `SELECT d.* 
         FROM departamentos d
         INNER JOIN empleadodepartamentos ed ON d.ID = ed.DepartamentoID
         WHERE ed.EmpleadoID = ? AND d.Activo = TRUE
         ORDER BY d.Nombre`,
        [id]
      );

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

      const departamentosFormateados = formatArrayDates(departamentosRows, [], ['createdAt', 'updatedAt']);
      const jefesFormateados = formatArrayDates(jefesRows, ['FechaIngreso'], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          ...empleado,
          departamentos: departamentosFormateados,
          jefes: jefesFormateados
        }
      });

    } catch (error) {
      next(error);
    }
  },

  actualizarEmpleado: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { departamentos, jefes, ...otrosCampos } = req.body;

      if (otrosCampos.fechaNacimiento) {
        otrosCampos.fechaNacimiento = new Date(otrosCampos.fechaNacimiento).toISOString().split('T')[0];
      }

      await Empleado.update(id, otrosCampos);
      
      if (departamentos !== undefined) {
        await Empleado.updateDepartamentos(id, departamentos);
      }
      
      if (jefes !== undefined) {
        await Empleado.updateJefes(id, jefes);
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Empleado actualizado exitosamente' 
      });

    } catch (error) {
      next(error);
    }
  },

  cambiarEstadoEmpleado: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { activo } = req.body;

      if (activo === undefined) {
        return res.status(400).json({
          success: false,
          message: 'El campo "activo" es requerido'
        });
      }

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
      next(error);
    }
  },

  eliminarEmpleado: async (req, res, next) => {
    try {
      const { id } = req.params;

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

      if (!empleado[0].Activo) {
        return res.status(400).json({
          success: false,
          message: 'El empleado ya está desactivado'
        });
      }

      const connection = await req.app.locals.db.getConnection();
      await connection.beginTransaction();

      try {
        await connection.query(
          'UPDATE usuarios SET Activo = FALSE WHERE ID = ?',
          [empleado[0].UsuarioID]
        );

        await connection.commit();

        res.status(200).json({
          success: true,
          message: 'Empleado desactivado exitosamente',
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
      next(error);
    }
  },

  obtenerCatalogos: async (req, res, next) => {
    try {
      const [puestos, departamentos, empleados] = await Promise.all([
        Catalogo.getPuestos(),
        Catalogo.getDepartamentos(),
        Catalogo.getEmpleadosSelect()
      ]);

      const puestosFormateados = formatArrayDates(puestos, [], ['createdAt', 'updatedAt']);
      const departamentosFormateados = formatArrayDates(departamentos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: { 
          puestos: puestosFormateados, 
          departamentos: departamentosFormateados, 
          empleados 
        }
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = empleadoController;
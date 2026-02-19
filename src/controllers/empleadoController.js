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

      let query;
      let countQuery;
      const queryParams = [limit, (page - 1) * limit];

      if (usuarioRol === 'admin') {
        query = `
          SELECT e.*, p.Nombre AS PuestoNombre, u.Activo AS UsuarioActivo
          FROM empleados e
          LEFT JOIN puestos p ON e.PuestoID = p.ID
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          WHERE u.Activo = TRUE
          ORDER BY e.NombreCompleto
          LIMIT ? OFFSET ?
        `;
        countQuery = `
          SELECT COUNT(*) AS total
          FROM empleados e
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          WHERE u.Activo = TRUE
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
          WHERE u.Activo = TRUE
          ORDER BY e.NombreCompleto
          LIMIT ? OFFSET ?
        `;
        countQuery = `
          SELECT COUNT(*) AS total
          FROM empleados e
          LEFT JOIN usuarios u ON e.UsuarioID = u.ID
          WHERE u.Activo = TRUE
        `;
      }

      const [rows] = await req.app.locals.db.query(query, queryParams);
      const [countResult] = await req.app.locals.db.query(countQuery);

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
        empleado = await Empleado.findById(id);

        if (empleado) {
          delete empleado.NSS;
          delete empleado.RFC;
          delete empleado.CURP;
          delete empleado.Direccion;

          if (empleado.FechaNacimiento) {
            const fecha = new Date(empleado.FechaNacimiento);
            empleado.FechaNacimiento = `${fecha.getFullYear()}-${String(
              fecha.getMonth() + 1
            ).padStart(2, '0')}`;
          }
        }
      }

      if (!empleado) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const departamentos = await Empleado.getDepartamentos(id);
      const jefes = await Empleado.getJefes(id);

      res.status(200).json({
        success: true,
        data: {
          ...empleado,
          departamentos,
          jefes
        }
      });

    } catch (error) {
      next(error);
    }
  },

  // Actualizar empleado
  actualizarEmpleado: async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        nombreCompleto,
        celular,
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

      const empleadoExistente = await Empleado.findById(id);
      if (!empleadoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Empleado no encontrado'
        });
      }

      const empleadoData = {
        nombreCompleto: nombreCompleto || empleadoExistente.NombreCompleto,
        celular: celular || empleadoExistente.Celular,
        fechaNacimiento: fechaNacimiento || empleadoExistente.FechaNacimiento,
        direccion: direccion || empleadoExistente.Direccion,
        nss: nss || empleadoExistente.NSS,
        rfc: rfc || empleadoExistente.RFC,
        curp: curp || empleadoExistente.CURP,
        telefonoEmergencia: telefonoEmergencia || empleadoExistente.TelefonoEmergencia,
        puestoId: puestoId || empleadoExistente.PuestoID,
        rolApp: rolApp || empleadoExistente.RolApp
      };

      await Empleado.update(id, empleadoData);

      if (departamentos !== undefined) {
        await Empleado.updateDepartamentos(id, departamentos);
      }

      if (jefes !== undefined) {
        await Empleado.updateJefes(id, jefes);
      }

      const empleadoActualizado = await Empleado.findById(id);

      res.status(200).json({
        success: true,
        message: 'Empleado actualizado exitosamente',
        data: empleadoActualizado
      });

    } catch (error) {
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
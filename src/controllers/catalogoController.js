const Catalogo = require('../models/catalogoModel');
const Permiso = require('../models/permisoModel');
const { formatArrayDates } = require('../utils/dateFormatter');

const catalogoController = {
  obtenerCatalogos: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      const [puestos, departamentos, empleados] = await Promise.all([
        Catalogo.getPuestos(),
        Catalogo.getDepartamentos(),
        Catalogo.getEmpleadosSelect()
      ]);

      let empleadosFiltrados = empleados;
      if (usuarioRol !== 'admin') {
        empleadosFiltrados = empleados.map(emp => ({
          ID: emp.ID,
          NombreCompleto: emp.NombreCompleto,
          CorreoElectronico: usuarioRol === 'manager' ? emp.CorreoElectronico : '',
          RolApp: emp.RolApp
        }));
      }

      const puestosFormateados = formatArrayDates(puestos, [], ['createdAt', 'updatedAt']);
      const departamentosFormateados = formatArrayDates(departamentos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          puestos: puestosFormateados,
          departamentos: departamentosFormateados,
          empleados: empleadosFiltrados
        }
      });

    } catch (error) {
      next(error);
    }
  },

  obtenerRoles: async (req, res, next) => {
    try {
      if (req.user.rol !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo administradores pueden ver los roles'
        });
      }

      const roles = await Permiso.obtenerRoles();
      const permisos = await Permiso.obtenerPermisos();

      const rolesFormateados = formatArrayDates(roles, [], ['createdAt', 'updatedAt']);
      const permisosFormateados = formatArrayDates(permisos, [], ['createdAt', 'updatedAt']);

      res.status(200).json({
        success: true,
        data: {
          roles: rolesFormateados,
          permisos: permisosFormateados
        }
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = catalogoController;
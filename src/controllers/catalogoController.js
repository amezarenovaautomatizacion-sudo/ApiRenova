const Catalogo = require('../models/catalogoModel');
const Permiso = require('../models/permisoModel');

const catalogoController = {
  // Obtener catálogos (filtrado por permisos)
  obtenerCatalogos: async (req, res, next) => {
    try {
      const usuarioRol = req.user.rol;
      
      // Obtener puestos y departamentos
      const [puestos, departamentos, empleados] = await Promise.all([
        Catalogo.getPuestos(),
        Catalogo.getDepartamentos(),
        Catalogo.getEmpleadosSelect()
      ]);

      // Para no-admin, limitar información de empleados
      let empleadosFiltrados = empleados;
      if (usuarioRol !== 'admin') {
        empleadosFiltrados = empleados.map(emp => ({
          ID: emp.ID,
          NombreCompleto: emp.NombreCompleto,
          // No mostrar correo a empleados regulares
          CorreoElectronico: usuarioRol === 'manager' ? emp.CorreoElectronico : '',
          RolApp: emp.RolApp
        }));
      }

      res.status(200).json({
        success: true,
        data: {
          puestos,
          departamentos,
          empleados: empleadosFiltrados
        }
      });

    } catch (error) {
      next(error);
    }
  },

  // Obtener roles (solo admin)
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

      res.status(200).json({
        success: true,
        data: {
          roles,
          permisos
        }
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = catalogoController;
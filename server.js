require('dotenv').config();

const app = require('./src/app');
const { testConnection } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

// Función para imprimir endpoints organizados
const printEndpoints = () => {
  console.log('\nENDPOINTS DEL SISTEMA:');
  console.log('='.repeat(80));
  
  console.log('\nAUTENTICACIÓN:');
  console.log('├─ POST   /api/auth/login           - Iniciar sesión');
  console.log('├─ POST   /api/auth/register        - Registrar usuario');
  console.log('├─ GET    /api/auth/profile         - Obtener perfil');
  console.log('└─ PUT    /api/auth/change-password - Cambiar contraseña');

  console.log('\nEMPLEADOS:');
  console.log('├─ GET    /api/empleados            - Listar empleados (con paginación)');
  console.log('├─ GET    /api/empleados/:id        - Obtener empleado específico');
  console.log('├─ POST   /api/empleados            - Crear nuevo empleado');
  console.log('├─ PUT    /api/empleados/:id        - Actualizar empleado');
  console.log('├─ DELETE /api/empleados/:id        - Eliminar empleado (soft delete)');
  console.log('└─ GET    /api/empleados/estadisticas - Estadísticas de empleados');

  console.log('\nVACACIONES:');
  console.log('├─ GET    /api/vacaciones               - Todas las solicitudes (admin)');
  console.log('├─ GET    /api/vacaciones/mis-vacaciones - Mis vacaciones');
  console.log('├─ POST   /api/vacaciones               - Solicitar vacaciones');
  console.log('├─ PUT    /api/vacaciones/aprobar/:id   - Aprobar/rechazar (admin)');
  console.log('├─ PUT    /api/vacaciones/cancelar/:id  - Cancelar solicitud propia');
  console.log('└─ GET    /api/vacaciones/estadisticas  - Estadísticas de vacaciones');

  console.log('\nVIGENCIAS VACACIONALES:');
  console.log('└─ GET    /api/vigencias/mis-vigencias - Mis vigencias y cálculo automático');

  console.log('\nASISTENCIAS:');
  console.log('├─ POST   /api/asistencias/registrar       - Registrar entrada/salida');
  console.log('├─ GET    /api/asistencias/mis-asistencias - Mis asistencias');
  console.log('├─ GET    /api/asistencias                 - Todas las asistencias (admin)');
  console.log('└─ POST   /api/asistencias/manual          - Registrar asistencia manual (admin)');

  console.log('\nPERMISOS (Con/Sin Goce):');
  console.log('├─ GET    /api/permisos/mis-permisos - Mis permisos');
  console.log('├─ POST   /api/permisos/solicitar    - Solicitar permiso');
  console.log('├─ PUT    /api/permisos/aprobar/:id  - Aprobar/rechazar permiso (admin)');
  console.log('└─ GET    /api/permisos              - Todos los permisos (admin)');

  console.log('\nHORAS EXTRAS:');
  console.log('├─ GET    /api/horas-extras/mis-horas-extras - Mis horas extras');
  console.log('├─ POST   /api/horas-extras/solicitar       - Solicitar horas extras (gerente)');
  console.log('├─ PUT    /api/horas-extras/aprobar/:id     - Aprobar/rechazar (admin)');
  console.log('└─ GET    /api/horas-extras                 - Todas las horas extras (admin)');

  console.log('\nADMINISTRADORES APROBADORES:');
  console.log('├─ GET    /api/administradores');
  console.log('├─ POST   /api/administradores/asignar');
  console.log('├─ GET    /api/administradores/notificaciones/pendientes');
  console.log('└─ PUT    /api/administradores/notificaciones/vista/:id');

  console.log('\nJEFES Y JERARQUÍA:');
  console.log('├─ GET    /api/jefes/mis-empleados');
  console.log('├─ POST   /api/jefes/asignar');
  console.log('├─ GET    /api/jefes/jerarquia');
  console.log('└─ PUT    /api/jefes/cambiar/:id');

  console.log('\nDEPARTAMENTOS:');
  console.log('├─ GET    /api/departamentos');
  console.log('├─ POST   /api/departamentos');
  console.log('├─ PUT    /api/departamentos/:id');
  console.log('├─ DELETE /api/departamentos/:id');
  console.log('└─ POST   /api/departamentos/asignar-jefe');

  console.log('\nPROYECTOS:');
  console.log('├─ GET    /api/proyectos/mis-proyectos');
  console.log('├─ GET    /api/proyectos');
  console.log('├─ GET    /api/proyectos/:id');
  console.log('├─ POST   /api/proyectos');
  console.log('├─ PUT    /api/proyectos/:id');
  console.log('├─ POST   /api/proyectos/:id/asignar');
  console.log('└─ DELETE /api/proyectos/:id/remover/:id_empleado');

  console.log('\nREPORTES:');
  console.log('├─ GET    /api/reportes/empleados');
  console.log('├─ GET    /api/reportes/asistencias');
  console.log('├─ GET    /api/reportes/vacaciones');
  console.log('└─ GET    /api/reportes/nomina');

  console.log('\nDASHBOARD:');
  console.log('└─ GET    /api/dashboard');

  console.log('\nINFORMACIÓN:');
  console.log('├─ GET    /');
  console.log('├─ GET    /health');
  console.log('├─ GET    /api-docs');
  console.log('└─ GET    /*');

  console.log('\n' + '='.repeat(80));
  console.log('\nPARÁMETROS COMUNES DE QUERY:');
  console.log('├─ page=Número');
  console.log('├─ limit=Número');
  console.log('├─ search=Texto');
  console.log('├─ estado=Texto');
  console.log('├─ fecha_inicio=YYYY-MM-DD');
  console.log('└─ fecha_fin=YYYY-MM-DD');

  console.log('\nAUTENTICACIÓN REQUERIDA EN TODOS LOS ENDPOINTS EXCEPTO:');
  console.log('├─ POST /api/auth/login');
  console.log('├─ POST /api/auth/register');
  console.log('├─ GET  /');
  console.log('├─ GET  /health');
  console.log('└─ GET  /api-docs');

  console.log('\n' + '='.repeat(80));
};

// Iniciar servidor después de verificar conexión a BD
const startServer = async () => {
  try {
    console.log('Conectando a la base de datos...');
    await testConnection();

    app.listen(PORT, () => {
      console.log('='.repeat(80));
      console.log('SERVIDOR INICIADO CORRECTAMENTE');
      console.log('='.repeat(80));

      console.log(`\nURL Principal: http://localhost:${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Puerto: ${PORT}`);
      console.log(`Fecha: ${new Date().toLocaleString()}`);

      console.log('\n' + '='.repeat(80));
      console.log('USUARIOS DE PRUEBA:');
      console.log('='.repeat(80));
      console.log('Email: admin@renova.com');
      console.log('Contraseña: (verificar en base de datos)');
      console.log('Rol: Administrador');

      console.log('\n' + '='.repeat(80));
      console.log('HERRAMIENTAS DE PRUEBA:');
      console.log('='.repeat(80));
      console.log(`Documentación: http://localhost:${PORT}/api-docs`);
      console.log('Postman: Importar colección desde /postman_collection.json');
      console.log('cURL: Authorization: Bearer <token>');
      console.log('Adminer: http://localhost:8080');

      printEndpoints();

      console.log('\n' + '='.repeat(80));
      console.log('SISTEMA LISTO PARA USO');
      console.log('='.repeat(80));
    });

  } catch (error) {
    console.error('ERROR AL INICIAR SERVIDOR:', error);
    console.log('\nSOLUCIÓN DE PROBLEMAS:');
    console.log('1. Verifica que MySQL esté corriendo');
    console.log('2. Revisa las credenciales en .env');
    console.log('3. Asegúrate de que la base de datos exista');
    console.log('4. Verifica los permisos del usuario MySQL');

    process.exit(1);
  }
};

startServer();

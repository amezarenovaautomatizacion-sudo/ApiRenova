const { pool } = require('./database');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    console.log('🚀 Creando tablas de RENOVA API...');

    // 1. Crear tabla de Roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Roles (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Nombre VARCHAR(50) NOT NULL UNIQUE,
        Descripcion TEXT,
        Nivel INT NOT NULL DEFAULT 0,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla Roles creada/existe');

    // 2. Crear tabla de Usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Usuarios (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Usuario VARCHAR(255) NOT NULL UNIQUE,
        Contrasenia VARCHAR(255) NOT NULL,
        RolID INT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (RolID) REFERENCES Roles(ID) ON DELETE SET NULL
      )
    `);
    console.log('✅ Tabla Usuarios creada/existe');

    // 3. Crear tabla de Puestos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Puestos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Nombre VARCHAR(100) NOT NULL UNIQUE,
        Descripcion TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla Puestos creada/existe');

    // 4. Crear tabla de Departamentos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Departamentos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Nombre VARCHAR(100) NOT NULL UNIQUE,
        Descripcion TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla Departamentos creada/existe');

    // 5. Crear tabla de Empleados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Empleados (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        UsuarioID INT NOT NULL UNIQUE,
        NombreCompleto VARCHAR(200) NOT NULL,
        Celular VARCHAR(20),
        CorreoElectronico VARCHAR(255) NOT NULL UNIQUE,
        FechaIngreso DATE NOT NULL,
        FechaNacimiento DATE NOT NULL,
        Direccion TEXT,
        NSS VARCHAR(20) UNIQUE,
        RFC VARCHAR(13) UNIQUE,
        CURP VARCHAR(18) UNIQUE,
        TelefonoEmergencia VARCHAR(20),
        PuestoID INT,
        RolApp ENUM('admin', 'manager', 'employee') DEFAULT 'employee',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (UsuarioID) REFERENCES Usuarios(ID) ON DELETE CASCADE,
        FOREIGN KEY (PuestoID) REFERENCES Puestos(ID) ON DELETE SET NULL
      )
    `);
    console.log('✅ Tabla Empleados creada/existe');

    // 6. Crear tabla EmpleadoDepartamentos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS EmpleadoDepartamentos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        EmpleadoID INT NOT NULL,
        DepartamentoID INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_empleado_departamento (EmpleadoID, DepartamentoID),
        FOREIGN KEY (EmpleadoID) REFERENCES Empleados(ID) ON DELETE CASCADE,
        FOREIGN KEY (DepartamentoID) REFERENCES Departamentos(ID) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla EmpleadoDepartamentos creada/existe');

    // 7. Crear tabla EmpleadoJefes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS EmpleadoJefes (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        EmpleadoID INT NOT NULL,
        JefeID INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_empleado_jefe (EmpleadoID, JefeID),
        FOREIGN KEY (EmpleadoID) REFERENCES Empleados(ID) ON DELETE CASCADE,
        FOREIGN KEY (JefeID) REFERENCES Empleados(ID) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla EmpleadoJefes creada/existe');

    // 8. Crear tabla de Módulos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Modulos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Nombre VARCHAR(100) NOT NULL UNIQUE,
        Descripcion TEXT,
        Icono VARCHAR(50),
        Ruta VARCHAR(100),
        Orden INT DEFAULT 0,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla Modulos creada/existe');

    // 9. Crear tabla de Permisos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Permisos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        ModuloID INT,
        Nombre VARCHAR(100) NOT NULL,
        Endpoint VARCHAR(200) NOT NULL,
        Metodo VARCHAR(10) NOT NULL,
        Descripcion TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ModuloID) REFERENCES Modulos(ID) ON DELETE SET NULL,
        UNIQUE KEY unique_endpoint_metodo (Endpoint, Metodo)
      )
    `);
    console.log('✅ Tabla Permisos creada/existe');

    // 10. Crear tabla RolPermisos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS RolPermisos (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        RolID INT NOT NULL,
        PermisoID INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_rol_permiso (RolID, PermisoID),
        FOREIGN KEY (RolID) REFERENCES Roles(ID) ON DELETE CASCADE,
        FOREIGN KEY (PermisoID) REFERENCES Permisos(ID) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla RolPermisos creada/existe');

    // 11. Crear tabla de Aprobadores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Aprobadores (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        UsuarioID INT UNIQUE,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (UsuarioID) REFERENCES Usuarios(ID) ON DELETE CASCADE,
        CHECK (UsuarioID IS NOT NULL OR Activo = FALSE)
      )
    `);
    console.log('✅ Tabla Aprobadores creada/existe');

    // 12. Crear tabla de Tipos de Incidencia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS TiposIncidencia (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        Nombre VARCHAR(100) NOT NULL UNIQUE,
        Descripcion TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla TiposIncidencia creada/existe');

    // 13. Crear tabla de Incidencias (MODIFICADA con SolicitudID)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Incidencias (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        EmpleadoID INT NOT NULL,
        TipoIncidenciaID INT NOT NULL,
        Descripcion TEXT NOT NULL,
        FechaIncidencia DATE NOT NULL,
        HoraIncidencia TIME,
        Observaciones TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        CreadoPor INT NOT NULL,
        SolicitudID INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (EmpleadoID) REFERENCES Empleados(ID) ON DELETE CASCADE,
        FOREIGN KEY (TipoIncidenciaID) REFERENCES TiposIncidencia(ID),
        FOREIGN KEY (CreadoPor) REFERENCES Usuarios(ID),
        FOREIGN KEY (SolicitudID) REFERENCES Solicitudes(ID) ON DELETE SET NULL,
        UNIQUE KEY unique_solicitud_incidencia (SolicitudID)
      )
    `);
    console.log('✅ Tabla Incidencias creada/existe');

    // 14. Crear tabla de ConfigVacaciones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ConfigVacaciones (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        AniosMin INT NOT NULL,
        AniosMax INT NOT NULL,
        DiasDerecho INT NOT NULL,
        Descripcion VARCHAR(255),
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_rango (AniosMin, AniosMax)
      )
    `);
    console.log('✅ Tabla ConfigVacaciones creada/existe');

    // 15. Crear tabla de VacacionesEmpleado
    await pool.query(`
      CREATE TABLE IF NOT EXISTS VacacionesEmpleado (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        EmpleadoID INT NOT NULL UNIQUE,
        DiasDisponibles INT DEFAULT 0,
        DiasTomados INT DEFAULT 0,
        DiasPendientes INT DEFAULT 0,
        ProximoPeriodo DATE,
        VigenciaHasta DATE,
        UltimaActualizacion DATE,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (EmpleadoID) REFERENCES Empleados(ID) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla VacacionesEmpleado creada/existe');

    // 16. Crear tabla de Solicitudes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Solicitudes (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        EmpleadoID INT NOT NULL,
        Tipo ENUM('vacaciones', 'permiso', 'horas_extras') NOT NULL,
        Estado ENUM('pendiente', 'aprobada', 'rechazada', 'cancelada') DEFAULT 'pendiente',
        Motivo TEXT,
        FechaSolicitud DATE NOT NULL,
        FechaInicio DATE NOT NULL,
        FechaFin DATE,
        Periodo VARCHAR(50),
        DiasSolicitados INT,
        HorasSolicitadas DECIMAL(5,2),
        ConGoce BOOLEAN DEFAULT TRUE,
        Observaciones TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (EmpleadoID) REFERENCES Empleados(ID) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla Solicitudes creada/existe');

    // 17. Crear tabla de AprobacionesSolicitud
    await pool.query(`
      CREATE TABLE IF NOT EXISTS AprobacionesSolicitud (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        SolicitudID INT NOT NULL,
        AprobadorID INT NOT NULL,
        OrdenAprobacion INT NOT NULL,
        Estado ENUM('pendiente', 'aprobado', 'rechazado') DEFAULT 'pendiente',
        FechaAprobacion DATETIME,
        Comentarios TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_aprobacion (SolicitudID, AprobadorID),
        FOREIGN KEY (SolicitudID) REFERENCES Solicitudes(ID) ON DELETE CASCADE,
        FOREIGN KEY (AprobadorID) REFERENCES Usuarios(ID)
      )
    `);
    console.log('✅ Tabla AprobacionesSolicitud creada/existe');

    // 18. Crear tabla de HistorialSolicitud
    await pool.query(`
      CREATE TABLE IF NOT EXISTS HistorialSolicitud (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        SolicitudID INT NOT NULL,
        UsuarioID INT NOT NULL,
        Accion VARCHAR(100) NOT NULL,
        EstadoAnterior VARCHAR(50),
        EstadoNuevo VARCHAR(50),
        Comentarios TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (SolicitudID) REFERENCES Solicitudes(ID) ON DELETE CASCADE,
        FOREIGN KEY (UsuarioID) REFERENCES Usuarios(ID)
      )
    `);
    console.log('✅ Tabla HistorialSolicitud creada/existe');

    // 19. Crear tabla de PeriodosVacacionales
    await pool.query(`
      CREATE TABLE IF NOT EXISTS PeriodosVacacionales (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        VacacionesEmpleadoID INT NOT NULL,
        SolicitudID INT,
        FechaInicio DATE NOT NULL,
        FechaFin DATE NOT NULL,
        DiasTomados INT NOT NULL,
        Estado ENUM('programado', 'en_proceso', 'completado', 'cancelado') DEFAULT 'programado',
        EsAutomatico BOOLEAN DEFAULT FALSE,
        MotivoCancelacion TEXT,
        Activo BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (VacacionesEmpleadoID) REFERENCES VacacionesEmpleado(ID) ON DELETE CASCADE,
        FOREIGN KEY (SolicitudID) REFERENCES Solicitudes(ID) ON DELETE SET NULL
      )
    `);
    console.log('✅ Tabla PeriodosVacacionales creada/existe');

    // Insertar datos iniciales
    await insertInitialData();

  } catch (error) {
    console.error('❌ Error creando tablas:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit();
  }
};

const insertInitialData = async () => {
  try {
    console.log('📝 Insertando datos iniciales...');

    // 1. Insertar roles
    const roles = [
      { nombre: 'admin', descripcion: 'Administrador del sistema', nivel: 100 },
      { nombre: 'manager', descripcion: 'Gerente/Coordinador', nivel: 50 },
      { nombre: 'employee', descripcion: 'Empleado regular', nivel: 10 }
    ];

    for (const rol of roles) {
      await pool.query(
        `INSERT IGNORE INTO Roles (Nombre, Descripcion, Nivel) VALUES (?, ?, ?)`,
        [rol.nombre, rol.descripcion, rol.nivel]
      );
    }
    console.log('✅ Roles insertados');

    // Obtener IDs de roles
    const [adminRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['admin']);
    const [managerRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['manager']);
    const [employeeRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['employee']);

    const adminRolId = adminRol[0]?.ID;
    const managerRolId = managerRol[0]?.ID;
    const employeeRolId = employeeRol[0]?.ID;

    // 2. Insertar usuarios iniciales
    const users = [
      {
        usuario: 'admin@renova.com',
        contrasenia: await bcrypt.hash('password123', 10),
        rolId: adminRolId
      },
      {
        usuario: 'manager@renova.com',
        contrasenia: await bcrypt.hash('password123', 10),
        rolId: managerRolId
      },
      {
        usuario: 'empleado@renova.com',
        contrasenia: await bcrypt.hash('password123', 10),
        rolId: employeeRolId
      },
      {
        usuario: 'becario@renova.com',
        contrasenia: await bcrypt.hash('password123', 10),
        rolId: employeeRolId
      }
    ];

    for (const user of users) {
      await pool.query(
        `INSERT IGNORE INTO Usuarios (Usuario, Contrasenia, RolID) VALUES (?, ?, ?)`,
        [user.usuario, user.contrasenia, user.rolId]
      );
    }
    console.log('✅ Usuarios insertados');

    // 3. Insertar puestos iniciales
    const puestos = [
      { nombre: 'Gerente de Sistemas', descripcion: 'Responsable del área de TI' },
      { nombre: 'Recursos Humanos', descripcion: 'Gestión del capital humano' },
      { nombre: 'Asistente Administrativo', descripcion: 'Apoyo en labores administrativas' },
      { nombre: 'CEO', descripcion: 'Director Ejecutivo' },
      { nombre: 'Desarrollador JR', descripcion: 'Desarrollador recién graduado' }
    ];

    for (const puesto of puestos) {
      await pool.query(
        `INSERT IGNORE INTO Puestos (Nombre, Descripcion) VALUES (?, ?)`,
        [puesto.nombre, puesto.descripcion]
      );
    }
    console.log('✅ Puestos insertados');

    // 4. Insertar departamentos iniciales
    const departamentos = [
      { nombre: 'Sistemas y TI', descripcion: 'Departamento de Tecnologías de la Información' },
      { nombre: 'Recursos Humanos', descripcion: 'Departamento de Gestión Humana' },
      { nombre: 'Administración', descripcion: 'Departamento Administrativo' },
      { nombre: 'Dirección General', descripcion: 'Dirección de la empresa' }
    ];

    for (const depto of departamentos) {
      await pool.query(
        `INSERT IGNORE INTO Departamentos (Nombre, Descripcion) VALUES (?, ?)`,
        [depto.nombre, depto.descripcion]
      );
    }
    console.log('✅ Departamentos insertados');

    // 5. Obtener IDs de usuarios creados
    const [adminUser] = await pool.query(
      'SELECT ID FROM Usuarios WHERE Usuario = ?', 
      ['admin@renova.com']
    );
    const [managerUser] = await pool.query(
      'SELECT ID FROM Usuarios WHERE Usuario = ?', 
      ['manager@renova.com']
    );
    const [empleadoUser] = await pool.query(
      'SELECT ID FROM Usuarios WHERE Usuario = ?', 
      ['empleado@renova.com']
    );
    const [becarioUser] = await pool.query(
      'SELECT ID FROM Usuarios WHERE Usuario = ?', 
      ['becario@renova.com']
    );

    const adminUserId = adminUser[0]?.ID;
    const managerUserId = managerUser[0]?.ID;
    const empleadoUserId = empleadoUser[0]?.ID;
    const becarioUserId = becarioUser[0]?.ID;

    // 6. Obtener IDs de puestos
    const [puestoGerenteSistemas] = await pool.query(
      'SELECT ID FROM Puestos WHERE Nombre = ?', 
      ['Gerente de Sistemas']
    );
    const [puestoRRHH] = await pool.query(
      'SELECT ID FROM Puestos WHERE Nombre = ?', 
      ['Recursos Humanos']
    );
    const [puestoAsistente] = await pool.query(
      'SELECT ID FROM Puestos WHERE Nombre = ?', 
      ['Asistente Administrativo']
    );
    const [puestoDesarrolladorJR] = await pool.query(
      'SELECT ID FROM Puestos WHERE Nombre = ?', 
      ['Desarrollador JR']
    );

    const puestoGerenteId = puestoGerenteSistemas[0]?.ID;
    const puestoRRHHId = puestoRRHH[0]?.ID;
    const puestoAsistenteId = puestoAsistente[0]?.ID;
    const puestoJRId = puestoDesarrolladorJR[0]?.ID;

    // 7. Crear empleados
    const empleados = [
      {
        usuarioId: adminUserId,
        nombreCompleto: 'Administrador del Sistema',
        correo: 'admin@renova.com',
        rolApp: 'admin',
        puestoId: puestoGerenteId,
        fechaIngreso: '2023-01-15',
        fechaNacimiento: '1990-05-20'
      },
      {
        usuarioId: managerUserId,
        nombreCompleto: 'Manager de RRHH',
        correo: 'manager@renova.com',
        rolApp: 'manager',
        puestoId: puestoRRHHId,
        fechaIngreso: '2023-02-10',
        fechaNacimiento: '1985-08-15'
      },
      {
        usuarioId: empleadoUserId,
        nombreCompleto: 'Empleado Ejemplo',
        correo: 'empleado@renova.com',
        rolApp: 'employee',
        puestoId: puestoAsistenteId,
        fechaIngreso: '2023-03-01',
        fechaNacimiento: '1995-11-30'
      },
      {
        usuarioId: becarioUserId,
        nombreCompleto: 'Becario RENOVA',
        correo: 'becario@renova.com',
        rolApp: 'employee',
        puestoId: puestoJRId,
        fechaIngreso: '2023-10-15',
        fechaNacimiento: '2000-03-25'
      }
    ];

    for (const emp of empleados) {
      if (emp.usuarioId) {
        await pool.query(
          `INSERT IGNORE INTO Empleados 
           (UsuarioID, NombreCompleto, CorreoElectronico, RolApp, PuestoID, 
            FechaIngreso, FechaNacimiento, NSS, RFC, CURP, Celular, TelefonoEmergencia) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            emp.usuarioId,
            emp.nombreCompleto,
            emp.correo,
            emp.rolApp,
            emp.puestoId,
            emp.fechaIngreso,
            emp.fechaNacimiento,
            `NSS${emp.usuarioId}${Date.now().toString().slice(-6)}`,
            `RFC${emp.usuarioId}${Date.now().toString().slice(-6)}`,
            `CURP${emp.usuarioId}${Date.now().toString().slice(-6)}`,
            '5551234567',
            '5559876543'
          ]
        );
      }
    }
    console.log('✅ Empleados insertados');

    // 8. Obtener IDs de empleados creados
    const [adminEmpleado] = await pool.query(
      'SELECT ID FROM Empleados WHERE CorreoElectronico = ?',
      ['admin@renova.com']
    );
    const [managerEmpleado] = await pool.query(
      'SELECT ID FROM Empleados WHERE CorreoElectronico = ?',
      ['manager@renova.com']
    );
    const [empleadoEmpleado] = await pool.query(
      'SELECT ID FROM Empleados WHERE CorreoElectronico = ?',
      ['empleado@renova.com']
    );
    const [becarioEmpleado] = await pool.query(
      'SELECT ID FROM Empleados WHERE CorreoElectronico = ?',
      ['becario@renova.com']
    );

    const adminEmpleadoId = adminEmpleado[0]?.ID;
    const managerEmpleadoId = managerEmpleado[0]?.ID;
    const empleadoEmpleadoId = empleadoEmpleado[0]?.ID;
    const becarioEmpleadoId = becarioEmpleado[0]?.ID;

    // 9. Obtener IDs de departamentos
    const [deptoSistemas] = await pool.query(
      'SELECT ID FROM Departamentos WHERE Nombre = ?',
      ['Sistemas y TI']
    );
    const [deptoRRHH] = await pool.query(
      'SELECT ID FROM Departamentos WHERE Nombre = ?',
      ['Recursos Humanos']
    );
    const [deptoAdmin] = await pool.query(
      'SELECT ID FROM Departamentos WHERE Nombre = ?',
      ['Administración']
    );

    const deptoSistemasId = deptoSistemas[0]?.ID;
    const deptoRRHHId = deptoRRHH[0]?.ID;
    const deptoAdminId = deptoAdmin[0]?.ID;

    // 10. Asignar departamentos a empleados
    const asignacionesDepartamentos = [
      { empleadoId: adminEmpleadoId, deptoId: deptoSistemasId },
      { empleadoId: managerEmpleadoId, deptoId: deptoRRHHId },
      { empleadoId: empleadoEmpleadoId, deptoId: deptoAdminId },
      { empleadoId: becarioEmpleadoId, deptoId: deptoSistemasId }
    ];

    for (const asignacion of asignacionesDepartamentos) {
      if (asignacion.empleadoId && asignacion.deptoId) {
        await pool.query(
          `INSERT IGNORE INTO EmpleadoDepartamentos (EmpleadoID, DepartamentoID) VALUES (?, ?)`,
          [asignacion.empleadoId, asignacion.deptoId]
        );
      }
    }
    console.log('✅ Departamentos asignados');

    // 11. Asignar jefes
    const asignacionesJefes = [
      { empleadoId: empleadoEmpleadoId, jefeId: managerEmpleadoId },
      { empleadoId: becarioEmpleadoId, jefeId: adminEmpleadoId }
    ];

    for (const asignacion of asignacionesJefes) {
      if (asignacion.empleadoId && asignacion.jefeId) {
        await pool.query(
          `INSERT IGNORE INTO EmpleadoJefes (EmpleadoID, JefeID) VALUES (?, ?)`,
          [asignacion.empleadoId, asignacion.jefeId]
        );
      }
    }
    console.log('✅ Jefes asignados');

    // 12. Insertar tipos de incidencia iniciales (ACTUALIZADO)
    const tiposIncidencia = [
      { nombre: 'Retardo', descripcion: 'Llegada tarde al trabajo' },
      { nombre: 'Falta', descripcion: 'Ausencia completa del día' },
      { nombre: 'Salida temprano', descripcion: 'Salida antes del horario establecido' },
      { nombre: 'Omisión de actividades', descripcion: 'No realizar actividades asignadas' },
      { nombre: 'Incumplimiento de políticas', descripcion: 'Violación de políticas internas' },
      { nombre: 'Amonestación verbal', descripcion: 'Llamada de atención verbal' },
      { nombre: 'Amonestación escrita', descripcion: 'Llamada de atención por escrito' },
      { nombre: 'Suspensión', descripcion: 'Suspensión temporal de labores' },
      // Nuevos tipos para solicitudes
      { nombre: 'Vacaciones aprobadas', descripcion: 'Periodo vacacional autorizado' },
      { nombre: 'Permiso con goce', descripcion: 'Permiso autorizado con goce de sueldo' },
      { nombre: 'Permiso sin goce', descripcion: 'Permiso autorizado sin goce de sueldo' },
      { nombre: 'Horas extras', descripcion: 'Horas extras autorizadas' }
    ];

    for (const tipo of tiposIncidencia) {
      await pool.query(
        `INSERT IGNORE INTO TiposIncidencia (Nombre, Descripcion) VALUES (?, ?)`,
        [tipo.nombre, tipo.descripcion]
      );
    }
    console.log('✅ Tipos de incidencia iniciales creados (incluyendo tipos para solicitudes)');

    // 13. Insertar configuración de vacaciones según LFT
    const configVacaciones = [
      { aniosMin: 1, aniosMax: 1, dias: 12, descripcion: 'Primer año' },
      { aniosMin: 2, aniosMax: 2, dias: 14, descripcion: 'Segundo año' },
      { aniosMin: 3, aniosMax: 3, dias: 16, descripcion: 'Tercer año' },
      { aniosMin: 4, aniosMax: 4, dias: 18, descripcion: 'Cuarto año' },
      { aniosMin: 5, aniosMax: 5, dias: 20, descripcion: 'Quinto año' },
      { aniosMin: 6, aniosMax: 10, dias: 22, descripcion: 'De 6 a 10 años' },
      { aniosMin: 11, aniosMax: 15, dias: 24, descripcion: 'De 11 a 15 años' },
      { aniosMin: 16, aniosMax: 20, dias: 26, descripcion: 'De 16 a 20 años' },
      { aniosMin: 21, aniosMax: 25, dias: 28, descripcion: 'De 21 a 25 años' },
      { aniosMin: 26, aniosMax: 30, dias: 30, descripcion: 'De 26 a 30 años' },
      { aniosMin: 31, aniosMax: 35, dias: 32, descripcion: 'De 31 a 35 años' }
    ];

    for (const config of configVacaciones) {
      await pool.query(
        `INSERT IGNORE INTO ConfigVacaciones (AniosMin, AniosMax, DiasDerecho, Descripcion) 
         VALUES (?, ?, ?, ?)`,
        [config.aniosMin, config.aniosMax, config.dias, config.descripcion]
      );
    }
    console.log('✅ Configuración de vacaciones (LFT) insertada');

    // 14. Calcular y crear derechos vacacionales iniciales para empleados
    const [todosEmpleados] = await pool.query('SELECT ID, FechaIngreso FROM Empleados');

    for (const empleado of todosEmpleados) {
      // Calcular antigüedad
      const fechaIngreso = new Date(empleado.FechaIngreso);
      const hoy = new Date();
      const diffTime = Math.abs(hoy - fechaIngreso);
      const diffAnios = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
      
      // Obtener días correspondientes según antigüedad
      const [config] = await pool.query(
        `SELECT DiasDerecho 
         FROM ConfigVacaciones 
         WHERE ? BETWEEN AniosMin AND AniosMax 
         AND Activo = TRUE 
         ORDER BY AniosMin LIMIT 1`,
        [diffAnios]
      );
      
      const diasDerecho = config.length > 0 ? config[0].DiasDerecho : 12;
      
      // Calcular fechas para vigencia (6 meses después del primer año)
      const primerAniversario = new Date(fechaIngreso);
      primerAniversario.setFullYear(primerAniversario.getFullYear() + 1);
      
      const vigenciaHasta = new Date(primerAniversario);
      vigenciaHasta.setMonth(vigenciaHasta.getMonth() + 6);
      
      const proximoPeriodo = new Date(primerAniversario);
      proximoPeriodo.setMonth(proximoPeriodo.getMonth() + 5); // 1 mes antes de vencer
      
      // Insertar derechos vacacionales
      await pool.query(
        `INSERT IGNORE INTO VacacionesEmpleado 
         (EmpleadoID, DiasDisponibles, DiasTomados, DiasPendientes, 
          ProximoPeriodo, VigenciaHasta, UltimaActualizacion) 
         VALUES (?, ?, 0, 0, ?, ?, ?)`,
        [
          empleado.ID,
          diasDerecho,
          proximoPeriodo.toISOString().split('T')[0],
          vigenciaHasta.toISOString().split('T')[0],
          hoy.toISOString().split('T')[0]
        ]
      );
    }
    console.log('✅ Derechos vacacionales iniciales calculados');

    // 15. Insertar permisos del sistema
    await insertPermisos();

    // 16. Tabla Aprobadores se crea vacía (sin datos iniciales)
    console.log('✅ Tabla Aprobadores creada vacía');

    console.log('\n🎉 ¡Base de datos inicializada exitosamente!');
    console.log('\n📋 RESUMEN DE DATOS CREADOS:');
    console.log('============================');
    console.log('\n👥 USUARIOS (4):');
    console.log('1. admin@renova.com / password123 (Rol: Admin)');
    console.log('2. manager@renova.com / password123 (Rol: Manager)');
    console.log('3. empleado@renova.com / password123 (Rol: Employee)');
    console.log('4. becario@renova.com / password123 (Rol: Employee)');
    
    console.log('\n💼 EMPLEADOS:');
    console.log('- Admin: Administrador del Sistema (Gerente de Sistemas)');
    console.log('- Manager: Manager de RRHH (Recursos Humanos)');
    console.log('- Empleado: Empleado Ejemplo (Asistente Administrativo)');
    console.log('- Becario: Becario RENOVA (Desarrollador JR)');
    
    console.log('\n🏢 DEPARTAMENTOS:');
    console.log('- Admin → Sistemas y TI');
    console.log('- Manager → Recursos Humanos');
    console.log('- Empleado → Administración');
    console.log('- Becario → Sistemas y TI');
    
    console.log('\n👨‍💼 JEFES:');
    console.log('- Empleado → Manager');
    console.log('- Becario → Admin');
    
    console.log('\n⚠️  TIPOS DE INCIDENCIA (12):');
    console.log('1. Retardo');
    console.log('2. Falta');
    console.log('3. Salida temprano');
    console.log('4. Omisión de actividades');
    console.log('5. Incumplimiento de políticas');
    console.log('6. Amonestación verbal');
    console.log('7. Amonestación escrita');
    console.log('8. Suspensión');
    console.log('9. Vacaciones aprobadas');
    console.log('10. Permiso con goce');
    console.log('11. Permiso sin goce');
    console.log('12. Horas extras');
    
    console.log('\n🏖️  CONFIGURACIÓN VACACIONES (LFT):');
    console.log('- Año 1: 12 días');
    console.log('- Año 2: 14 días');
    console.log('- Año 3: 16 días');
    console.log('- Año 4: 18 días');
    console.log('- Año 5: 20 días');
    console.log('- 6-10 años: 22 días');
    console.log('- 11-15 años: 24 días');
    console.log('- 16-20 años: 26 días');
    console.log('- 21-25 años: 28 días');
    console.log('- 26-30 años: 30 días');
    console.log('- 31-35 años: 32 días');
    
    console.log('\n🔐 TABLAS CREADAS (19):');
    console.log('1. Roles                11. TiposIncidencia');
    console.log('2. Usuarios             12. Incidencias');
    console.log('3. Puestos              13. ConfigVacaciones');
    console.log('4. Departamentos        14. VacacionesEmpleado');
    console.log('5. Empleados            15. Solicitudes');
    console.log('6. EmpleadoDepartamentos 16. AprobacionesSolicitud');
    console.log('7. EmpleadoJefes        17. HistorialSolicitud');
    console.log('8. Modulos              18. PeriodosVacacionales');
    console.log('9. Permisos             19. Aprobadores');
    console.log('10. RolPermisos');
    
    console.log('\n🚀 SERVIDOR: http://localhost:3000');
    console.log('📖 DOCUMENTACIÓN: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error insertando datos iniciales:', error.message);
    console.error('Stack:', error.stack);
  }
};

const insertPermisos = async () => {
  try {
    console.log('🔐 Insertando permisos del sistema...');

    // Definir permisos por endpoint
    const permisos = [
      // Auth endpoints
      { modulo: null, nombre: 'Login', endpoint: '/api/auth/login', metodo: 'POST', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Register', endpoint: '/api/auth/register', metodo: 'POST', roles: ['admin'] },
      { modulo: null, nombre: 'Ver perfil', endpoint: '/api/auth/profile', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Verificar token', endpoint: '/api/auth/verify', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Empleados - Catálogos
      { modulo: null, nombre: 'Ver catálogos', endpoint: '/api/empleados/catalogos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Empleados - Listar
      { modulo: null, nombre: 'Listar empleados', endpoint: '/api/empleados/empleados', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Empleados - Ver detalle
      { modulo: null, nombre: 'Ver empleado específico', endpoint: '/api/empleados/empleados/:id', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Empleados - Crear
      { modulo: null, nombre: 'Crear empleado', endpoint: '/api/empleados/empleados', metodo: 'POST', roles: ['admin', 'manager'] },

      // Empleados - Actualizar
      { modulo: null, nombre: 'Actualizar empleado', endpoint: '/api/empleados/empleados/:id', metodo: 'PUT', roles: ['admin', 'manager'] },

      // Empleados - Información sensible (solo admin)
      { modulo: null, nombre: 'Ver NSS/RFC/CURP', endpoint: '/api/empleados/empleados/:id/sensible', metodo: 'GET', roles: ['admin'] },
      { modulo: null, nombre: 'Ver todos datos sensibles', endpoint: '/api/empleados/sensibles', metodo: 'GET', roles: ['admin'] },

      // Empleados - Permisos
      { modulo: null, nombre: 'Ver mis permisos', endpoint: '/api/empleados/mis-permisos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Ver roles y permisos', endpoint: '/api/empleados/roles', metodo: 'GET', roles: ['admin'] },

      // Aprobadores endpoints
      { modulo: null, nombre: 'Agregar aprobador', endpoint: '/api/aprobadores/agregar', metodo: 'POST', roles: ['admin'] },
      { modulo: null, nombre: 'Quitar aprobador', endpoint: '/api/aprobadores/quitar/:usuarioId', metodo: 'DELETE', roles: ['admin'] },
      { modulo: null, nombre: 'Ver aprobadores activos', endpoint: '/api/aprobadores/activos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Verificar aprobador', endpoint: '/api/aprobadores/verificar/:usuarioId', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Incidencias - Tipos
      { modulo: null, nombre: 'Ver tipos incidencia', endpoint: '/api/incidencias/tipos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Ver todos tipos', endpoint: '/api/incidencias/tipos/todos', metodo: 'GET', roles: ['admin'] },
      { modulo: null, nombre: 'Ver tipo específico', endpoint: '/api/incidencias/tipos/:id', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Crear tipo incidencia', endpoint: '/api/incidencias/tipos', metodo: 'POST', roles: ['admin'] },
      { modulo: null, nombre: 'Actualizar tipo incidencia', endpoint: '/api/incidencias/tipos/:id', metodo: 'PUT', roles: ['admin'] },
      { modulo: null, nombre: 'Cambiar estado tipo', endpoint: '/api/incidencias/tipos/:id/estado', metodo: 'PATCH', roles: ['admin'] },

      // Incidencias - Incidencias
      { modulo: null, nombre: 'Crear incidencia', endpoint: '/api/incidencias', metodo: 'POST', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Listar incidencias', endpoint: '/api/incidencias', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Ver incidencia específica', endpoint: '/api/incidencias/:id', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Actualizar incidencia', endpoint: '/api/incidencias/:id', metodo: 'PUT', roles: ['admin'] },
      { modulo: null, nombre: 'Cambiar estado incidencia', endpoint: '/api/incidencias/:id/estado', metodo: 'PATCH', roles: ['admin'] },
      { modulo: null, nombre: 'Ver empleados supervisados', endpoint: '/api/incidencias/empleados/supervisados', metodo: 'GET', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Ver mis incidencias', endpoint: '/api/incidencias/mis-incidencias', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },

      // Solicitudes endpoints
      { modulo: null, nombre: 'Ver derechos vacacionales', endpoint: '/api/solicitudes/vacaciones/derechos', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Solicitar vacaciones', endpoint: '/api/solicitudes/vacaciones/solicitar', metodo: 'POST', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Solicitar permiso', endpoint: '/api/solicitudes/permisos/solicitar', metodo: 'POST', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Ver permisos pendientes', endpoint: '/api/solicitudes/permisos/pendientes', metodo: 'GET', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Solicitar horas extras', endpoint: '/api/solicitudes/horas-extras/solicitar', metodo: 'POST', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Ver reporte horas extras', endpoint: '/api/solicitudes/horas-extras/reporte', metodo: 'GET', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Ver aprobaciones pendientes', endpoint: '/api/solicitudes/aprobaciones/pendientes', metodo: 'GET', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Procesar aprobación', endpoint: '/api/solicitudes/aprobaciones/:aprobacionId/procesar', metodo: 'PATCH', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Editar aprobación', endpoint: '/api/solicitudes/aprobaciones/:aprobacionId/editar', metodo: 'PATCH', roles: ['admin', 'manager'] },
      { modulo: null, nombre: 'Ver mis solicitudes', endpoint: '/api/solicitudes/mis-solicitudes', metodo: 'GET', roles: ['admin', 'manager', 'employee'] },
      { modulo: null, nombre: 'Cancelar solicitud', endpoint: '/api/solicitudes/:solicitudId/cancelar', metodo: 'PATCH', roles: ['admin', 'manager', 'employee'] }
    ];

    // Obtener IDs de roles
    const [adminRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['admin']);
    const [managerRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['manager']);
    const [employeeRol] = await pool.query('SELECT ID FROM Roles WHERE Nombre = ?', ['employee']);

    const rolesMap = {
      'admin': adminRol[0]?.ID,
      'manager': managerRol[0]?.ID,
      'employee': employeeRol[0]?.ID
    };

    let permisosInsertados = 0;
    let asignacionesInsertadas = 0;

    // Insertar permisos y asignar a roles
    for (const permiso of permisos) {
      // Insertar permiso
      const [permisoResult] = await pool.query(
        `INSERT IGNORE INTO Permisos (ModuloID, Nombre, Endpoint, Metodo, Descripcion) 
         VALUES (?, ?, ?, ?, ?)`,
        [null, permiso.nombre, permiso.endpoint, permiso.metodo, `Permiso para ${permiso.nombre}`]
      );

      // Si se insertó el permiso, asignar a roles
      if (permisoResult.insertId || permisoResult.affectedRows > 0) {
        const permisoId = permisoResult.insertId;
        
        // Si no hay insertId, buscar el permiso existente
        let finalPermisoId = permisoId;
        if (!finalPermisoId) {
          const [existingPermiso] = await pool.query(
            'SELECT ID FROM Permisos WHERE Endpoint = ? AND Metodo = ?',
            [permiso.endpoint, permiso.metodo]
          );
          finalPermisoId = existingPermiso[0]?.ID;
        }

        if (finalPermisoId) {
          permisosInsertados++;
          
          // Asignar permiso a roles
          for (const rolNombre of permiso.roles) {
            const rolId = rolesMap[rolNombre];
            if (rolId && finalPermisoId) {
              await pool.query(
                `INSERT IGNORE INTO RolPermisos (RolID, PermisoID) VALUES (?, ?)`,
                [rolId, finalPermisoId]
              );
              asignacionesInsertadas++;
            }
          }
        }
      }
    }

    console.log(`✅ Permisos insertados: ${permisosInsertados}`);
    console.log(`✅ Asignaciones a roles: ${asignacionesInsertadas}`);

  } catch (error) {
    console.error('❌ Error insertando permisos:', error.message);
  }
};

// Ejecutar la creación de tablas
createTables();
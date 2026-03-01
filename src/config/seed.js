const { pool } = require('./database');
const bcrypt = require('bcryptjs');

const seedEmpleados = async () => {
  try {
    console.log('🚀 Iniciando inserción de empleados...');

    // Obtener IDs de roles
    const [employeeRol] = await pool.query('select id from roles where nombre = ?', ['employee']);
    const employeeRolId = employeeRol[0]?.id;

    if (!employeeRolId) {
      throw new Error('No se encontró el rol de employee. Ejecuta primero createTables.js');
    }

    // Obtener IDs de departamentos
    const [deptoAutomatizacion] = await pool.query('select id from departamentos where nombre = ?', ['Automatización']);
    const [deptoEnsamble] = await pool.query('select id from departamentos where nombre = ?', ['Ensamble']);
    
    const deptoAutomatizacionId = deptoAutomatizacion[0]?.id;
    const deptoEnsambleId = deptoEnsamble[0]?.id;

    if (!deptoAutomatizacionId || !deptoEnsambleId) {
      console.warn('⚠️  Algunos departamentos no fueron encontrados. Verifica que existan: Automatización e Ensamble');
    }

    // Obtener IDs de puestos
    const [puestoAutomatizacion] = await pool.query('select id from puestos where nombre = ?', ['AUTOMATIZACION']);
    const [puestoAuxEnsamble] = await pool.query('select id from puestos where nombre = ?', ['AUX. ENSAMBLE']);
    
    const puestoAutomatizacionId = puestoAutomatizacion[0]?.id;
    const puestoAuxEnsambleId = puestoAuxEnsamble[0]?.id;

    if (!puestoAutomatizacionId || !puestoAuxEnsambleId) {
      console.warn('⚠️  Algunos puestos no fueron encontrados. Verifica que existan: AUTOMATIZACION y AUX. ENSAMBLE');
    }

    // Datos de empleados
    const empleados = [
      {
        nombreCompleto: 'SAUL MAGALLANES RAMIREZ',
        correo: 'smrenova01@gmail.com',
        fechaIngreso: '2025-09-22',
        fechaNacimiento: '2003-08-03',
        celular: '3335045238',
        direccion: 'SALVADOR LOPEZ CHAVEZ #1750 GUADALAJARA',
        rfc: 'MARS000308HJCGMLA4',
        nss: '03250044447',
        curp: 'MARS000308CA1',
        puestoId: puestoAutomatizacionId,
        rolApp: 'employee',
        departamentoId: deptoAutomatizacionId
      },
      {
        nombreCompleto: 'JESUS ENRIQUE RAMOS MIRAMONTES',
        correo: 'errenova02@gmail.com',
        fechaIngreso: '2025-11-20',
        fechaNacimiento: '1985-11-06',
        celular: '3334764131',
        direccion: 'B. BARTOK 4059 COL. MIRAVALLE',
        rfc: 'RAMJ851106HJCMRS05',
        nss: '04048567608',
        curp: 'RAMJ851106IW3',
        puestoId: puestoAutomatizacionId,
        rolApp: 'employee',
        departamentoId: deptoAutomatizacionId
      },
      {
        nombreCompleto: 'EDGAR ALEJANDRO ROSALES ALFARO',
        correo: 'rosalesedgar189@gmail.com',
        fechaIngreso: '2026-01-09',
        fechaNacimiento: '2005-01-25',
        celular: '3326326009',
        direccion: 'FCO. VILLA #29 MANUEL MENA L. MELENDEZ',
        rfc: 'ROAE050125HJCSLDA1',
        nss: '05200598018',
        curp: 'ROAE0501258D5',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'JOEL GAETA MALDONADO',
        correo: 'joelgaeta1853@gmail.com',
        fechaIngreso: '2026-01-09',
        fechaNacimiento: '2003-12-18',
        celular: '3317875507',
        direccion: 'FELIPE BARRIOZABAL #4520 COL. 5 DE MAYO',
        rfc: 'GAMJ031218HJCTLLA2',
        nss: '57170395552',
        curp: 'GAMJ0312189L4',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'JUAN FELIPE DE JESUS ANDRADE CARBAJAL',
        correo: 'juan.carbajal18@hotmail.com',
        fechaIngreso: '2026-01-08',
        fechaNacimiento: '2001-12-18',
        celular: '3325482323',
        direccion: 'CALLE D5 A REVOLUCION CORREGIDORA',
        rfc: 'AACJ011218HJCNRNA7',
        nss: '26170195676',
        curp: 'AACJ011218169',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'ALEJANDRO GUADALUPE ARROYO CERVANTES',
        correo: 'alejandroguadalupearroyocervan@gmail.com',
        fechaIngreso: '2026-01-12',
        fechaNacimiento: '2005-08-31',
        celular: '3329578365',
        direccion: 'MANUEL VARELA #4220 COL. 5 DE MAYO',
        rfc: 'AOCA050831HJCRRLA5',
        nss: '03210501551',
        curp: '',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'CRISTIAN ARIEL HERNANDEZ CUEVAS',
        correo: 'hdez.cuevas1995@gmail.com',
        fechaIngreso: '2026-01-15',
        fechaNacimiento: '2005-12-11',
        celular: '3334834323',
        direccion: 'CTO JOEL 330 COL. JARDINES DEL EDEN',
        rfc: 'HECC051211HJCRVRA3',
        nss: '88200528987',
        curp: 'HECC051211959',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'JOSE LUIS ABASCAL TELLEZ',
        correo: 'joseluisabaacaltellez@gmail.com',
        fechaIngreso: '2026-01-12',
        fechaNacimiento: '2005-07-11',
        celular: '3328679730',
        direccion: 'CALLE CHOCOLATE #44 FRACC. HACIENDAS DEL REAL',
        rfc: 'AATL050711HJCBLSA7',
        nss: '05210562814',
        curp: 'AATL050711TD4',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      },
      {
        nombreCompleto: 'JOSE ANGEL HERNANDEZ PEREZ',
        correo: 'angelhernandezperezv3@gmail.com',
        fechaIngreso: '2026-01-12',
        fechaNacimiento: '2001-07-14',
        celular: '5610320130',
        direccion: 'AV. DE LAS TORRES VALLE DE LOS MOLINOS',
        rfc: 'HEPA010714HMCRRNA1',
        nss: '73160169212',
        curp: 'HEPA010714FT6',
        puestoId: puestoAuxEnsambleId,
        rolApp: 'employee',
        departamentoId: deptoEnsambleId
      }
    ];

    console.log(`📝 Procesando ${empleados.length} empleados...`);

    let usuariosEncontrados = 0;
    let empleadosCreados = 0;

    for (const emp of empleados) {
      try {
        // 1. Buscar el usuario existente por su correo
        const [usuario] = await pool.query(
          'select id from usuarios where usuario = ?',
          [emp.correo]
        );
        
        const usuarioId = usuario[0]?.id;
        
        if (!usuarioId) {
          console.log(`  ⚠️ No se encontró usuario para ${emp.correo}. Creando uno nuevo...`);
          
          // Crear usuario si no existe
          const contrasenia = await bcrypt.hash('Password123', 10);
          const [usuarioResult] = await pool.query(
            `insert into usuarios (usuario, contrasenia, rolid, activo) 
             values (?, ?, ?, ?)`,
            [emp.correo, contrasenia, employeeRolId, true]
          );
          
          if (!usuarioResult.insertId) {
            console.log(`  ❌ No se pudo crear usuario para ${emp.correo}`);
            continue;
          }
          
          usuarioId = usuarioResult.insertId;
          console.log(`  ✅ Usuario creado: ${emp.correo} (ID: ${usuarioId})`);
        } else {
          console.log(`  ✅ Usuario encontrado: ${emp.correo} (ID: ${usuarioId})`);
        }
        
        usuariosEncontrados++;

        // 2. Verificar si el empleado ya existe
        const [empleadoExistente] = await pool.query(
          'select id from empleados where usuarioid = ? or correoelectronico = ?',
          [usuarioId, emp.correo]
        );

        if (empleadoExistente.length > 0) {
          console.log(`  ⚠️ El empleado ${emp.nombreCompleto} ya existe (ID: ${empleadoExistente[0].id})`);
          empleadosCreados++;
          continue;
        }

        // 3. Crear empleado (SIN la columna 'activo')
        const [empleadoResult] = await pool.query(
          `insert into empleados 
           (usuarioid, nombrecompleto, correoelectronico, celular, direccion, 
            fechaingreso, fechanacimiento, nss, rfc, curp, puestoid, rolapp) 
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            usuarioId,
            emp.nombreCompleto,
            emp.correo,
            emp.celular,
            emp.direccion || '',
            emp.fechaIngreso,
            emp.fechaNacimiento,
            emp.nss,
            emp.rfc,
            emp.curp || null,
            emp.puestoId,
            emp.rolApp
          ]
        );

        if (empleadoResult.insertId) {
          empleadosCreados++;
          const empleadoId = empleadoResult.insertId;
          console.log(`  ✅ Empleado creado: ${emp.nombreCompleto} (ID: ${empleadoId})`);

          // 4. Asignar departamento si existe
          if (emp.departamentoId) {
            await pool.query(
              `insert ignore into empleadodepartamentos (empleadoid, departamentoid) 
               values (?, ?)`,
              [empleadoId, emp.departamentoId]
            );
            console.log(`     📍 Departamento asignado`);
          }

          // 5. Crear registro en VacacionesEmpleado
          // Calcular antigüedad para días de vacaciones
          const fechaIngreso = new Date(emp.fechaIngreso);
          const hoy = new Date();
          const diffTime = Math.abs(hoy - fechaIngreso);
          const diffAnios = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
          
          // Obtener días de vacaciones según antigüedad
          const [config] = await pool.query(
            `select diasderecho 
             from configvacaciones 
             where ? between aniosmin and aniosmax 
             and activo = true 
             order by aniosmin limit 1`,
            [diffAnios]
          );
          
          const diasDerecho = config.length > 0 ? config[0].diasderecho : 12;
          
          // Calcular fechas de vigencia
          const primerAniversario = new Date(fechaIngreso);
          primerAniversario.setFullYear(primerAniversario.getFullYear() + 1);
          
          const vigenciaHasta = new Date(primerAniversario);
          vigenciaHasta.setMonth(vigenciaHasta.getMonth() + 6);
          
          const proximoPeriodo = new Date(primerAniversario);
          proximoPeriodo.setMonth(proximoPeriodo.getMonth() + 5);

          await pool.query(
            `insert ignore into vacacionesempleado 
             (empleadoid, diasdisponibles, diastomados, diaspendientes, 
              proximoperiodo, vigenciahasta, ultimaactualizacion) 
             values (?, ?, 0, 0, ?, ?, ?)`,
            [
              empleadoId,
              diasDerecho,
              proximoPeriodo.toISOString().split('T')[0],
              vigenciaHasta.toISOString().split('T')[0],
              hoy.toISOString().split('T')[0]
            ]
          );
          console.log(`     🏖️ Registro de vacaciones creado (${diasDerecho} días)`);
        }
      } catch (error) {
        console.error(`  ❌ Error procesando ${emp.nombreCompleto}:`, error.message);
      }
    }

    console.log('\n📊 RESUMEN:');
    console.log('============================');
    console.log(`✅ Usuarios procesados: ${usuariosEncontrados}`);
    console.log(`✅ Empleados creados: ${empleadosCreados}`);
    console.log(`🔑 Contraseña para todos: Password123`);

    // Mostrar lista de empleados
    console.log('\n👥 EMPLEADOS PROCESADOS:');
    console.log('============================');
    for (const emp of empleados) {
      console.log(`📧 ${emp.correo} | ${emp.nombreCompleto}`);
    }

    console.log('\n🎉 ¡Inserción de empleados completada exitosamente!');

  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    process.exit();
  }
};

// Ejecutar el script
seedEmpleados();
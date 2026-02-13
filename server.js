require('dotenv').config();
const app = require('./src/app');
const { testConnection } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// Probar conexión a la base de datos
testConnection();

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`   Servidor RENOVA API corriendo en: http://localhost:${PORT}`);
  console.log(`   Documentación API disponible en: http://localhost:${PORT}`);
  console.log(`   Usuarios disponibles:`);
  console.log(`   admin@renova.com / password123`);
  console.log(`   manager@renova.com / password123`);
  console.log(`   empleado@renova.com / password123`);
  console.log(`   becario@renova.com / password123`);
  
  // Iniciar jobs programados
  if (process.env.NODE_ENV !== 'test') {
    const vacacionesJob = require('./src/jobs/vacacionesJob');
    vacacionesJob.iniciarJobs();
  }
});
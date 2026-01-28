require('dotenv').config();

const app = require('./src/app');
const { testConnection } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

// Iniciar servidor después de verificar conexión a BD
const startServer = async () => {
  try {
    // Verificar conexión a base de datos
    await testConnection();
    
    app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`Servidor corriendo en: http://localhost:${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
      console.log('\nEndpoints principales:');
      console.log(`http://localhost:${PORT}/api-docs`);
      console.log(`http://localhost:${PORT}/api/auth/login`);
      console.log(`http://localhost:${PORT}/api/auth/register`);
      console.log(`http://localhost:${PORT}/api/dashboard`);
      console.log(`http://localhost:${PORT}/api/empleados`);
      console.log(`http://localhost:${PORT}/api/vacaciones`);
      console.log(`http://localhost:${PORT}/api/asistencias`);
      console.log(`http://localhost:${PORT}/api/reportes/empleados`);
      console.log('='.repeat(50));
      console.log('\nUsa POSTMAN o cURL para probar los endpoints.');
      console.log('Usuario de prueba: nuevo@empresa.com / contraseña en BD');
      console.log('='.repeat(50));
    });

  } catch (error) {
    console.error('Error al iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();
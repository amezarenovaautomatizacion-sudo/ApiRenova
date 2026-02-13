require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { testConnection } = require('./src/config/database');
const { initSocket } = require('./src/sockets/notificacionSocket');

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const server = http.createServer(app);

// Inicializar Socket.IO
const io = initSocket(server);

// Guardar io en app para usarlo en controllers
app.set('io', io);

// Probar conexión a la base de datos
testConnection();

// Iniciar servidor
server.listen(PORT, () => { // 👈 CAMBIO: app.listen → server.listen
  console.log(`   Servidor RENOVA API corriendo en: http://localhost:${PORT}`);
  console.log(`   Documentación API disponible en: http://localhost:${PORT}`);
  console.log(`   WebSocket disponible en: ws://localhost:${PORT}`);
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

// Exportar io para usar en otros archivos
module.exports = { server, io };
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

let io;

function initSocket(server) {
  io = socketIo(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
  });


  // Middleware de autenticación
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Token no proporcionado'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'renova-secret-key');
      
      // Verificar que el usuario existe
      const [users] = await pool.query(
        'SELECT ID, Usuario, Rol, Activo FROM usuarios WHERE ID = ? AND Activo = 1',
        [decoded.id]
      );

      if (users.length === 0) {
        return next(new Error('Usuario no encontrado'));
      }

      socket.user = users[0];
      next();
    } catch (error) {
      console.error('❌ Error de autenticación WebSocket:', error);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Usuario conectado a WebSocket: ${socket.user.Usuario} (${socket.user.ID})`);

    // Unir a sala personal
    socket.join(`user:${socket.user.ID}`);
    
    // Si es admin, unir a sala de administradores
    if (socket.user.Rol === 'admin') {
      socket.join('admins');
    }

    // Enviar última notificación no vista al conectar
    enviarUltimaNotificacion(socket.user.ID, socket);

    // Evento para solicitar última notificación manualmente
    socket.on('notificacion:solicitar-ultima', async () => {
      await enviarUltimaNotificacion(socket.user.ID, socket);
    });

    // Evento para marcar como vista desde WebSocket
    socket.on('notificacion:marcar-vista', async (notificacionId) => {
      try {
        await pool.query(`
          UPDATE notificaciones_personales 
          SET Estado = 'vista', FechaVista = NOW(), updatedAt = NOW()
          WHERE ID = ? AND UsuarioID = ? AND Activo = 1
        `, [notificacionId, socket.user.ID]);
        
        socket.emit('notificacion:marcada', { 
          success: true, 
          notificacionId 
        });
      } catch (error) {
        console.error('Error marcando notificación:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Usuario desconectado: ${socket.user.Usuario}`);
    });
  });

  return io;
}

// Función para enviar última notificación no vista
async function enviarUltimaNotificacion(usuarioId, socket) {
  try {
    const [notificaciones] = await pool.query(`
      SELECT 
        np.ID,
        np.Titulo,
        np.Mensaje,
        np.DatosExtra,
        np.Estado,
        np.createdAt,
        tn.Nombre as Tipo,
        tn.Prioridad,
        tn.Icono,
        tn.Color
      FROM notificaciones_personales np
      JOIN tipos_notificacion tn ON np.TipoNotificacionID = tn.ID
      WHERE np.UsuarioID = ? 
        AND np.Estado = 'no_vista'
        AND np.Activo = 1
        AND np.FechaExpiracion > NOW()
      ORDER BY np.createdAt DESC
      LIMIT 1
    `, [usuarioId]);

    if (notificaciones.length > 0) {
      socket.emit('notificacion:ultima', {
        success: true,
        data: notificaciones[0]
      });
    }
  } catch (error) {
    console.error('Error enviando última notificación:', error);
  }
}

// Función para emitir notificación a un usuario específico
async function emitirNotificacionPersonal(usuarioId, notificacion) {
  if (!io) return;
  io.to(`user:${usuarioId}`).emit('notificacion:nueva', {
    success: true,
    data: notificacion
  });
}

// Función para emitir notificación general a TODOS los usuarios conectados
async function emitirNotificacionGeneral(notificacion) {
  if (!io) return;
  io.emit('notificacion:general', {
    success: true,
    data: notificacion
  });
}

// Función para emitir notificación importante a TODOS
async function emitirNotificacionImportante(notificacion) {
  if (!io) return;
  io.emit('notificacion:importante', {
    success: true,
    data: notificacion
  });
}

// Función para emitir solo a administradores
async function emitirNotificacionAdmin(notificacion) {
  if (!io) return;
  io.to('admins').emit('notificacion:admin', {
    success: true,
    data: notificacion
  });
}

module.exports = {
  initSocket,
  emitirNotificacionPersonal,
  emitirNotificacionGeneral,
  emitirNotificacionImportante,
  emitirNotificacionAdmin,
  getIo: () => io
};
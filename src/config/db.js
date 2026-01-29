const mysql = require('mysql2/promise');

// Configuración de pool de conexiones
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'api_node',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Función para obtener una conexión del pool
const getConnection = async () => {
  return await pool.getConnection();
};

// Función query mejorada con manejo de errores
const query = async (sql, params = []) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Error en consulta SQL:', {
      sql,
      params,
      error: error.message,
      code: error.code
    });
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// Función para transacciones
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Verificar conexión al inicio
const testConnection = async () => {
  try {
    const [result] = await query('SELECT 1 as test');
    console.log('Conectado a MySQL correctamente');
    console.log(`Base de datos: ${process.env.DB_NAME || 'api_node'}`);
    return true;
  } catch (error) {
    console.error('Error conectando a MySQL:', error.message);
    console.log('\nVerifica que:');
    console.log('   1. MySQL esté corriendo');
    console.log('   2. Las credenciales en .env sean correctas');
    console.log('   3. La base de datos exista');
    console.log('   4. El usuario tenga permisos');
    process.exit(1);
  }
};

module.exports = {
  pool,
  getConnection,
  query,
  transaction,
  testConnection
};
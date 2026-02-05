const { query } = require('../config/db');

// Obtener todos los puestos
exports.getAllPuestos = async (req, res) => {
  try {
    console.log('Obteniendo todos los puestos...');
    
    const puestos = await query(`
      SELECT * FROM puestos 
      ORDER BY nombre_puesto
    `);
    
    console.log(`Se encontraron ${puestos.length} puestos`);
    
    res.json({
      success: true,
      data: puestos
    });
  } catch (error) {
    console.error('Error obteniendo puestos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener puestos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener puesto por ID
exports.getPuestoById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Obteniendo puesto con ID: ${id}`);
    
    const [puesto] = await query(
      'SELECT * FROM puestos WHERE id_puesto = ?',
      [id]
    );
    
    if (!puesto) {
      return res.status(404).json({
        success: false,
        message: 'Puesto no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: puesto
    });
  } catch (error) {
    console.error(`Error obteniendo puesto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear nuevo puesto
exports.createPuesto = async (req, res) => {
  try {
    const { nombre_puesto, descripcion, nivel } = req.body;
    
    if (!nombre_puesto) {
      return res.status(400).json({
        success: false,
        message: 'Nombre del puesto es requerido'
      });
    }
    
    // Verificar que no exista un puesto con el mismo nombre
    const [existente] = await query(
      'SELECT id_puesto FROM puestos WHERE nombre_puesto = ?',
      [nombre_puesto]
    );
    
    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un puesto con ese nombre'
      });
    }
    
    const result = await query(
      `INSERT INTO puestos (nombre_puesto, descripcion, nivel)
       VALUES (?, ?, ?)`,
      [nombre_puesto, descripcion || null, nivel || null]
    );
    
    console.log(`Puesto creado con ID: ${result.insertId}`);
    
    res.status(201).json({
      success: true,
      message: 'Puesto creado exitosamente',
      data: {
        id_puesto: result.insertId
      }
    });
  } catch (error) {
    console.error('Error creando puesto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear puesto'
    });
  }
};

// Actualizar puesto
exports.updatePuesto = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar si el puesto existe
    const [puesto] = await query(
      'SELECT id_puesto FROM puestos WHERE id_puesto = ?',
      [id]
    );
    
    if (!puesto) {
      return res.status(404).json({
        success: false,
        message: 'Puesto no encontrado'
      });
    }
    
    const allowedFields = ['nombre_puesto', 'descripcion', 'nivel'];
    const setClauses = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updateData[field]);
      }
    }
    
    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }
    
    values.push(id);
    const sql = `UPDATE puestos SET ${setClauses.join(', ')} WHERE id_puesto = ?`;
    
    await query(sql, values);
    
    console.log(`Puesto ${id} actualizado`);
    
    res.json({
      success: true,
      message: 'Puesto actualizado exitosamente'
    });
  } catch (error) {
    console.error(`Error actualizando puesto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al actualizar puesto'
    });
  }
};

// Eliminar puesto
exports.deletePuesto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el puesto existe
    const [puesto] = await query(
      'SELECT id_puesto FROM puestos WHERE id_puesto = ?',
      [id]
    );
    
    if (!puesto) {
      return res.status(404).json({
        success: false,
        message: 'Puesto no encontrado'
      });
    }
    
    // Verificar que no tenga empleados asignados
    const [empleados] = await query(
      'SELECT COUNT(*) as total FROM empleados WHERE id_puesto = ? AND activo = 1',
      [id]
    );
    
    if (empleados.total > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el puesto porque tiene empleados asignados'
      });
    }
    
    await query('DELETE FROM puestos WHERE id_puesto = ?', [id]);
    
    console.log(`Puesto ${id} eliminado`);
    
    res.json({
      success: true,
      message: 'Puesto eliminado exitosamente'
    });
  } catch (error) {
    console.error(`Error eliminando puesto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar puesto'
    });
  }
};

// Obtener empleados por puesto
exports.getEmpleadosByPuesto = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Obteniendo empleados para puesto ID: ${id}`);
    
    // Primero verificar si el puesto existe
    const [puesto] = await query(
      'SELECT id_puesto, nombre_puesto FROM puestos WHERE id_puesto = ?',
      [id]
    );
    
    if (!puesto) {
      return res.status(404).json({
        success: false,
        message: 'Puesto no encontrado'
      });
    }
    
    // Obtener empleados para este puesto
    const empleados = await query(`
      SELECT 
        e.*,
        d.nombre_departamento,
        CONCAT(j.nombre, ' ', j.apellido) as nombre_jefe
      FROM empleados e
      LEFT JOIN departamentos d ON e.id_departamento = d.id_departamento
      LEFT JOIN empleados j ON e.id_jefe = j.id_empleado
      WHERE e.id_puesto = ? AND e.activo = 1
      ORDER BY e.nombre, e.apellido
    `, [id]);
    
    console.log(`Se encontraron ${empleados.length} empleados para puesto ${id}`);
    
    res.json({
      success: true,
      data: {
        puesto,
        empleados,
        total: empleados.length
      }
    });
  } catch (error) {
    console.error(`Error obteniendo empleados por puesto ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
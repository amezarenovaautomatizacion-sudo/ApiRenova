const { query } = require('../config/db');

// Obtener todos los departamentos
exports.getAllDepartamentos = async (req, res) => {
  try {
    const departamentos = await query(`
      SELECT 
        d.*,
        CONCAT(e.nombre, ' ', e.apellido) as nombre_jefe,
        e.id_empleado as id_jefe_departamento,
        (SELECT COUNT(*) FROM empleados emp 
         WHERE emp.id_departamento = d.id_departamento AND emp.activo = 1) as total_empleados
      FROM departamentos d
      LEFT JOIN empleados e ON d.id_jefe_departamento = e.id_empleado
      ORDER BY d.nombre_departamento
    `);

    res.json({
      success: true,
      data: departamentos
    });
  } catch (error) {
    console.error('Error obteniendo departamentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear departamento
exports.createDepartamento = async (req, res) => {
  try {
    const { nombre_departamento, descripcion, id_jefe_departamento } = req.body;

    if (!nombre_departamento) {
      return res.status(400).json({
        success: false,
        message: 'Nombre del departamento es requerido'
      });
    }

    // Verificar que no exista un departamento con el mismo nombre
    const [existente] = await query(
      'SELECT id_departamento FROM departamentos WHERE nombre_departamento = ?',
      [nombre_departamento]
    );

    if (existente) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un departamento con ese nombre'
      });
    }

    // Insertar departamento
    const result = await query(
      `INSERT INTO departamentos (nombre_departamento, descripcion, id_jefe_departamento)
       VALUES (?, ?, ?)`,
      [nombre_departamento, descripcion || null, id_jefe_departamento || null]
    );

    res.status(201).json({
      success: true,
      message: 'Departamento creado exitosamente',
      data: {
        id_departamento: result.insertId
      }
    });
  } catch (error) {
    console.error('Error creando departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar departamento
exports.updateDepartamento = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Verificar que el departamento existe
    const [departamento] = await query(
      'SELECT id_departamento FROM departamentos WHERE id_departamento = ?',
      [id]
    );

    if (!departamento) {
      return res.status(404).json({
        success: false,
        message: 'Departamento no encontrado'
      });
    }

    // Construir SET dinámico
    const allowedFields = ['nombre_departamento', 'descripcion', 'id_jefe_departamento'];
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
    const sql = `UPDATE departamentos SET ${setClauses.join(', ')} WHERE id_departamento = ?`;

    await query(sql, values);

    res.json({
      success: true,
      message: 'Departamento actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error actualizando departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar departamento
exports.deleteDepartamento = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el departamento existe
    const [departamento] = await query(
      'SELECT id_departamento FROM departamentos WHERE id_departamento = ?',
      [id]
    );

    if (!departamento) {
      return res.status(404).json({
        success: false,
        message: 'Departamento no encontrado'
      });
    }

    // Verificar que no tenga empleados asignados
    const [empleados] = await query(
      'SELECT COUNT(*) as total FROM empleados WHERE id_departamento = ? AND activo = 1',
      [id]
    );

    if (empleados.total > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el departamento porque tiene empleados asignados'
      });
    }

    // Eliminar departamento
    await query('DELETE FROM departamentos WHERE id_departamento = ?', [id]);

    res.json({
      success: true,
      message: 'Departamento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Asignar jefe de departamento
exports.asignarJefeDepartamento = async (req, res) => {
  try {
    const { id_departamento, id_empleado } = req.body;

    if (!id_departamento || !id_empleado) {
      return res.status(400).json({
        success: false,
        message: 'ID de departamento y empleado son requeridos'
      });
    }

    // Verificar que ambos existen
    const [departamento] = await query(
      'SELECT id_departamento FROM departamentos WHERE id_departamento = ?',
      [id_departamento]
    );

    const [empleado] = await query(
      'SELECT id_empleado FROM empleados WHERE id_empleado = ? AND activo = 1',
      [id_empleado]
    );

    if (!departamento || !empleado) {
      return res.status(404).json({
        success: false,
        message: 'Departamento o empleado no encontrado'
      });
    }

    // Actualizar jefe de departamento
    await query(
      'UPDATE departamentos SET id_jefe_departamento = ? WHERE id_departamento = ?',
      [id_empleado, id_departamento]
    );

    // Actualizar el departamento del empleado si es diferente
    await query(
      'UPDATE empleados SET id_departamento = ? WHERE id_empleado = ?',
      [id_departamento, id_empleado]
    );

    res.json({
      success: true,
      message: 'Jefe de departamento asignado exitosamente'
    });
  } catch (error) {
    console.error('Error asignando jefe de departamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
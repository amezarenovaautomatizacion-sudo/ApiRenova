const formatDateToYMD = (date) => {
  if (!date) return null;
  try {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string' && date.includes('T')) {
      return date.split('T')[0];
    }
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
    return date;
  } catch (error) {
    return date;
  }
};

const removeZFromISO = (dateString) => {
  if (!dateString) return null;
  if (typeof dateString !== 'string') return dateString;
  
  if (dateString.endsWith('Z')) {
    return dateString.slice(0, -1);
  }
  
  return dateString;
};

const formatDateFields = (obj, dateFields = ['FechaIngreso', 'FechaNacimiento'], timestampFields = ['createdAt', 'updatedAt']) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const formatted = { ...obj };
  
  dateFields.forEach(field => {
    if (formatted[field]) {
      formatted[field] = formatDateToYMD(formatted[field]);
    }
  });
  
  timestampFields.forEach(field => {
    if (formatted[field]) {
      formatted[field] = removeZFromISO(formatted[field]);
    }
  });
  
  return formatted;
};

const formatArrayDates = (arr, dateFields = ['FechaIngreso', 'FechaNacimiento'], timestampFields = ['createdAt', 'updatedAt']) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => formatDateFields(item, dateFields, timestampFields));
};

module.exports = {
  formatDateToYMD,
  removeZFromISO,
  formatDateFields,
  formatArrayDates
};
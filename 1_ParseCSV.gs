/**
 * ============================================================
 * FASE 1: Parsear CSV de When2Meet y generar tabla de disponibilidad
 * ============================================================
 *
 * Formato esperado del CSV (pegado en la hoja "When2Meet_CSV"):
 *   Fila 1 (headers): Time, Persona1, Persona2, Persona3, ...
 *   Fila N (datos):    01/15/2025 09:00:00, 1, 0, 1, ...
 *
 * Donde 1 = disponible, 0 = no disponible
 */

/**
 * Función principal: lee el CSV, genera la tabla de disponibilidad
 * y aplica formato. Ejecutar desde el menú o manualmente.
 */
function parseWhen2MeetAndTabulate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Leer datos crudos
  const sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert(
      'No se encontró la hoja "' + CONFIG.SOURCE_SHEET + '".\n' +
      "Crea una hoja con ese nombre y pega ahí el CSV de When2Meet."
    );
    return;
  }

  const data = sourceSheet.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert("La hoja del CSV está vacía o solo tiene headers.");
    return;
  }

  // Parsear headers: ["Time", "Persona1", "Persona2", ...]
  const headers = data[0];
  const interviewers = headers.slice(1).map(function(name) {
    return String(name).trim();
  });

  // Construir matriz de disponibilidad
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var timeRaw = row[0];

    // Parsear el timestamp
    var dt = parseTimeSlot_(timeRaw);
    if (!dt) continue;

    var formattedTime = Utilities.formatDate(dt, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
    var dayOfWeek = Utilities.formatDate(dt, CONFIG.TIMEZONE, "EEEE");

    var availableCount = 0;
    var statuses = [];

    for (var j = 1; j < row.length && j <= interviewers.length; j++) {
      var val = String(row[j]).trim();
      var isAvailable = (val === "1" || val.toLowerCase() === "true" || val.toLowerCase() === "yes");
      statuses.push(isAvailable ? "Libre" : "Ocupado");
      if (isAvailable) availableCount++;
    }

    rows.push({
      datetime: formattedTime,
      day: dayOfWeek,
      date: dt,
      statuses: statuses,
      availableCount: availableCount,
    });
  }

  // Escribir hoja de disponibilidad
  writeAvailabilitySheet_(ss, interviewers, rows);

  SpreadsheetApp.getUi().alert(
    "Tabla de disponibilidad generada.\n" +
    interviewers.length + " entrevistadores, " + rows.length + " slots de tiempo."
  );
}


/**
 * Parsea un valor de celda de tiempo a Date.
 * Soporta: Date objects, strings ISO, strings "MM/DD/YYYY HH:mm:ss", "Day HH:mm:ss AM/PM"
 */
function parseTimeSlot_(timeValue) {
  if (timeValue instanceof Date) {
    return timeValue;
  }

  var str = String(timeValue).trim();
  if (!str) return null;

  // Intentar parseo directo
  var d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d;
  }

  // Intentar formato "Monday 09:00:00 AM" (formato When2Meet alternativo)
  var dayTimeMatch = str.match(/^(\w+)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (dayTimeMatch) {
    var hours = parseInt(dayTimeMatch[2]);
    var minutes = parseInt(dayTimeMatch[3]);
    var ampm = dayTimeMatch[5];

    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
    }

    // Sin fecha específica, usar próxima ocurrencia de ese día
    var today = new Date();
    today.setHours(hours, minutes, 0, 0);
    return today;
  }

  return null;
}


/**
 * Escribe la hoja de disponibilidad con formato.
 */
function writeAvailabilitySheet_(ss, interviewers, rows) {
  // Crear o limpiar hoja
  var sheet = ss.getSheetByName(CONFIG.AVAILABILITY_SHEET);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(CONFIG.AVAILABILITY_SHEET);
  }

  // Headers
  var headerRow = ["Fecha/Hora", "Día"].concat(interviewers).concat(["Total Disponibles", "¿Viable? (≥" + CONFIG.MIN_INTERVIEWERS + ")"]);
  sheet.appendRow(headerRow);

  // Datos
  var outputData = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var viable = r.availableCount >= CONFIG.MIN_INTERVIEWERS ? "✅ Sí" : "❌ No";
    var rowData = [r.datetime, r.day].concat(r.statuses).concat([r.availableCount, viable]);
    outputData.push(rowData);
  }

  if (outputData.length > 0) {
    sheet.getRange(2, 1, outputData.length, outputData[0].length).setValues(outputData);
  }

  // Formato
  applyFormatting_(sheet, interviewers.length, outputData.length);
}


/**
 * Aplica conditional formatting y estilos a la hoja.
 */
function applyFormatting_(sheet, numInterviewers, numDataRows) {
  if (numDataRows === 0) return;

  var numCols = 2 + numInterviewers + 2; // Fecha + Día + entrevistadores + Total + Viable

  // Header: negrita, fondo gris, centrado
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange
    .setFontWeight("bold")
    .setBackground("#d9d9d9")
    .setHorizontalAlignment("center");

  // Rango de celdas de disponibilidad (sin Fecha, Día, Total, Viable)
  var availRange = sheet.getRange(2, 3, numDataRows, numInterviewers);

  // Limpiar reglas anteriores
  sheet.clearConditionalFormatRules();

  // Regla: "Libre" → verde
  var greenRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Libre")
    .setBackground("#b7e1cd")
    .setFontColor("#0d652d")
    .setRanges([availRange])
    .build();

  // Regla: "Ocupado" → rojo
  var redRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Ocupado")
    .setBackground("#f4c7c3")
    .setFontColor("#a94442")
    .setRanges([availRange])
    .build();

  // Regla: columna Viable "✅ Sí" → verde claro
  var viableRange = sheet.getRange(2, numCols, numDataRows, 1);
  var viableRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Sí")
    .setBackground("#d9ead3")
    .setRanges([viableRange])
    .build();

  // Regla: columna Viable "❌ No" → rojo claro
  var notViableRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("No")
    .setBackground("#fce5cd")
    .setRanges([viableRange])
    .build();

  sheet.setConditionalFormatRules([greenRule, redRule, viableRule, notViableRule]);

  // Freeze header + primera columna
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // Auto-resize
  for (var c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
  }
}

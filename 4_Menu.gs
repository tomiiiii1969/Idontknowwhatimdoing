/**
 * ============================================================
 * MENÚ Y UTILIDADES
 * ============================================================
 *
 * Agrega un menú personalizado al Google Sheet para ejecutar
 * funciones sin entrar al editor de scripts.
 */

/**
 * Se ejecuta al abrir el spreadsheet. Crea el menú.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🎯 Entrevistas")
    .addItem("📊 Parsear When2Meet CSV", "parseWhen2MeetAndTabulate")
    .addSeparator()
    .addItem("🔗 Ver URL del webhook", "showWebhookUrl")
    .addItem("🧪 Test: simular webhook Calendly", "testCalendlyWebhook")
    .addSeparator()
    .addItem("📋 Ver resumen de disponibilidad", "showAvailabilitySummary")
    .addItem("🔄 Recargar disponibilidad", "parseWhen2MeetAndTabulate")
    .addToUi();
}


/**
 * Muestra la URL del webhook desplegado.
 */
function showWebhookUrl() {
  var url = ScriptApp.getService().getUrl();

  if (url) {
    SpreadsheetApp.getUi().alert(
      "URL del Webhook\n\n" +
      url + "\n\n" +
      "Configura esta URL en Calendly:\n" +
      "Calendly → Integrations → Webhooks → Add Webhook\n" +
      "Event: invitee.created"
    );
  } else {
    SpreadsheetApp.getUi().alert(
      "El script no está desplegado como Web App.\n\n" +
      "Ve a: Deploy → New deployment → Web app\n" +
      "Execute as: Me\n" +
      "Who has access: Anyone"
    );
  }
}


/**
 * Simula un webhook de Calendly para testing.
 * Usa la próxima franja disponible que tenga suficientes entrevistadores.
 */
function testCalendlyWebhook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.AVAILABILITY_SHEET);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      "Primero ejecuta 'Parsear When2Meet CSV' para generar la tabla de disponibilidad."
    );
    return;
  }

  // Buscar primera franja viable
  var data = sheet.getDataRange().getValues();
  var testTime = null;

  for (var i = 1; i < data.length; i++) {
    var totalAvailable = data[i][data[i].length - 2]; // Penúltima columna = Total
    if (totalAvailable >= CONFIG.MIN_INTERVIEWERS) {
      testTime = String(data[i][0]);
      break;
    }
  }

  if (!testTime) {
    SpreadsheetApp.getUi().alert(
      "No se encontró ninguna franja con " + CONFIG.MIN_INTERVIEWERS + "+ entrevistadores disponibles."
    );
    return;
  }

  // Construir payload simulado
  var testPayload = {
    event: "invitee.created",
    payload: {
      scheduled_event: {
        start_time: new Date(testTime).toISOString(),
        end_time: new Date(new Date(testTime).getTime() + CONFIG.INTERVIEW_DURATION_MINUTES * 60000).toISOString(),
        name: "Entrevista de prueba",
        uri: "https://api.calendly.com/scheduled_events/TEST123",
      },
      name: "Candidato de Prueba",
      email: "test@example.com",
      cancel_url: "https://calendly.com/cancellations/TEST123",
      reschedule_url: "https://calendly.com/reschedulings/TEST123",
    },
  };

  // Simular el webhook (sin crear evento de calendar en test)
  var eventData = extractCalendlyEventData_(testPayload);
  var available = findAvailableInterviewers_(eventData.startTime, eventData.endTime);
  var assigned = selectInterviewers_(available);

  var assignedNames = assigned.map(function(a) { return a.name; }).join(", ");
  var availableNames = available.map(function(a) { return a.name; }).join(", ");

  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    "Test del Webhook",
    "Franja: " + testTime + "\n\n" +
    "Disponibles (" + available.length + "): " + availableNames + "\n" +
    "Se asignarían (" + assigned.length + "): " + assignedNames + "\n\n" +
    "¿Crear evento real en Google Calendar?",
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    var calId = createCalendarEvent_(eventData, assigned);
    logAssignment_(eventData, assigned, "TEST OK - " + calId);
    ui.alert("Evento de prueba creado.\nRevisa tu Google Calendar.");
  } else {
    logAssignment_(eventData, assigned, "TEST (sin evento de calendar)");
    ui.alert("Test completado sin crear evento. Log actualizado.");
  }
}


/**
 * Muestra un resumen rápido de disponibilidad.
 */
function showAvailabilitySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.AVAILABILITY_SHEET);

  if (!sheet) {
    SpreadsheetApp.getUi().alert("No hay datos de disponibilidad. Ejecuta el parser primero.");
    return;
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var totalSlots = data.length - 1;
  var viableSlots = 0;
  var interviewerCounts = {};

  // Inicializar conteo por entrevistador
  for (var c = 2; c < headers.length - 2; c++) {
    interviewerCounts[headers[c]] = 0;
  }

  for (var i = 1; i < data.length; i++) {
    var total = data[i][data[i].length - 2];
    if (total >= CONFIG.MIN_INTERVIEWERS) viableSlots++;

    for (var c = 2; c < headers.length - 2; c++) {
      if (String(data[i][c]) === "Libre") {
        interviewerCounts[headers[c]]++;
      }
    }
  }

  var summary = "RESUMEN DE DISPONIBILIDAD\n\n";
  summary += "Total de franjas: " + totalSlots + "\n";
  summary += "Franjas viables (≥" + CONFIG.MIN_INTERVIEWERS + " entrevistadores): " + viableSlots + "\n";
  summary += "Franjas sin cobertura: " + (totalSlots - viableSlots) + "\n\n";
  summary += "Disponibilidad por entrevistador:\n";

  for (var name in interviewerCounts) {
    var pct = totalSlots > 0 ? Math.round(interviewerCounts[name] / totalSlots * 100) : 0;
    summary += "  " + name + ": " + interviewerCounts[name] + "/" + totalSlots + " (" + pct + "%)\n";
  }

  SpreadsheetApp.getUi().alert(summary);
}

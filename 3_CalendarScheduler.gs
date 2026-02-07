/**
 * ============================================================
 * FASE 3: Crear eventos en Google Calendar
 * ============================================================
 *
 * Crea el evento de entrevista e invita a los entrevistadores asignados.
 */

/**
 * Crea un evento en Google Calendar con los entrevistadores asignados.
 * Retorna el ID del evento creado.
 */
function createCalendarEvent_(eventData, assignedInterviewers) {
  var calendar = CalendarApp.getDefaultCalendar();

  // Construir título
  var title = CONFIG.CALENDAR_EVENT_TITLE
    .replace("{candidato}", eventData.candidateName);

  // Construir descripción
  var description = CONFIG.CALENDAR_EVENT_DESCRIPTION
    .replace("{candidato}", eventData.candidateName)
    .replace("{email}", eventData.candidateEmail);

  // Agregar info de entrevistadores a la descripción
  description += "\n\nEntrevistadores asignados:\n";
  for (var i = 0; i < assignedInterviewers.length; i++) {
    description += "- " + assignedInterviewers[i].name;
    if (assignedInterviewers[i].email) {
      description += " (" + assignedInterviewers[i].email + ")";
    }
    description += "\n";
  }

  // Agregar links de Calendly si están disponibles
  if (eventData.cancelUrl) {
    description += "\nLink de cancelación: " + eventData.cancelUrl;
  }
  if (eventData.rescheduleUrl) {
    description += "\nLink de reagendamiento: " + eventData.rescheduleUrl;
  }

  // Crear evento
  var event = calendar.createEvent(
    title,
    eventData.startTime,
    eventData.endTime,
    {
      description: description,
      guests: buildGuestList_(assignedInterviewers, eventData.candidateEmail),
      sendInvites: true,
    }
  );

  // Configurar recordatorio 15 minutos antes
  event.removeAllReminders();
  event.addPopupReminder(15);
  event.addEmailReminder(30);

  Logger.log("Evento creado: " + event.getId() + " | " + title);
  return event.getId();
}


/**
 * Construye la lista de invitados (emails separados por coma).
 */
function buildGuestList_(interviewers, candidateEmail) {
  var emails = [];

  for (var i = 0; i < interviewers.length; i++) {
    if (interviewers[i].email) {
      emails.push(interviewers[i].email);
    }
  }

  // También invitar al candidato
  if (candidateEmail) {
    emails.push(candidateEmail);
  }

  return emails.join(",");
}


/**
 * Loguea la asignación en la hoja de log.
 */
function logAssignment_(eventData, assignedInterviewers, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);

  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.LOG_SHEET);
    logSheet.appendRow([
      "Timestamp",
      "Candidato",
      "Email Candidato",
      "Entrevistadores Asignados",
      "Hora Entrevista",
      "Estado",
      "Calendly Event URI",
    ]);

    // Formato header
    logSheet.getRange(1, 1, 1, 7)
      .setFontWeight("bold")
      .setBackground("#d9d9d9");
    logSheet.setFrozenRows(1);
  }

  var interviewerNames = assignedInterviewers.map(function(a) {
    return a.name;
  }).join(", ");

  var interviewTime = Utilities.formatDate(
    eventData.startTime,
    CONFIG.TIMEZONE,
    "yyyy-MM-dd HH:mm"
  );

  logSheet.appendRow([
    new Date(),
    eventData.candidateName,
    eventData.candidateEmail,
    interviewerNames,
    interviewTime,
    status,
    eventData.calendlyEventUri,
  ]);
}


/**
 * Loguea errores para debug.
 */
function logError_(error, rawPayload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);

  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.LOG_SHEET);
    logSheet.appendRow([
      "Timestamp", "Candidato", "Email Candidato",
      "Entrevistadores Asignados", "Hora Entrevista", "Estado", "Calendly Event URI",
    ]);
  }

  logSheet.appendRow([
    new Date(),
    "ERROR",
    "",
    "",
    "",
    "ERROR: " + error.toString(),
    rawPayload ? String(rawPayload).substring(0, 1000) : "",
  ]);
}

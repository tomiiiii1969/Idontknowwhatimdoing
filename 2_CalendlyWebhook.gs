/**
 * ============================================================
 * FASE 2: Webhook endpoint (Zapier bridge + Calendly directo)
 * ============================================================
 *
 * Este script expone un doPost() que recibe datos de entrevistas.
 * Soporta dos fuentes:
 *   - Zapier: Calendly trigger → Webhooks POST (no requiere Calendly Premium)
 *   - Calendly directo: webhook nativo invitee.created (requiere Premium)
 *
 * Cuando un candidato agenda una entrevista:
 *   1. Recibe el POST con los datos del evento
 *   2. Verifica el secreto compartido (si está configurado)
 *   3. Detecta la fuente (Zapier vs Calendly) y extrae datos
 *   4. Busca entrevistadores disponibles en esa franja
 *   5. Crea evento en Google Calendar con los entrevistadores
 *   6. Loguea la asignación en la hoja de log
 *
 * DEPLOY: Publicar como Web App (Execute as: Me, Access: Anyone)
 * La URL resultante se configura en Zapier como destino del Webhook POST.
 */

/**
 * Endpoint GET - responde con status (útil para verificar que el deploy funciona)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Webhook endpoint activo" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Endpoint POST - recibe datos de Zapier o Calendly directo
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Log del payload crudo para debug
    logWebhookPayload_(payload);

    // Verificar secreto compartido (si está configurado)
    if (CONFIG.ZAPIER_WEBHOOK_SECRET) {
      var incomingSecret = payload.secret ||
        (e.parameter && e.parameter.secret) || "";
      if (incomingSecret !== CONFIG.ZAPIER_WEBHOOK_SECRET) {
        return jsonResponse_({ status: "error", reason: "Unauthorized" });
      }
    }

    // Detectar fuente y extraer datos
    var eventData = null;
    var source = payload.source || "";

    if (source === "zapier" && CONFIG.ACCEPTED_SOURCE !== "calendly") {
      // Payload viene de Zapier (formato plano)
      eventData = extractZapierEventData_(payload);
    } else if (payload.event === "invitee.created" && CONFIG.ACCEPTED_SOURCE !== "zapier") {
      // Payload viene de Calendly directo (formato nativo)
      eventData = extractCalendlyEventData_(payload);
    } else if (CONFIG.ACCEPTED_SOURCE === "any") {
      // Fallback: intentar ambos formatos
      eventData = extractZapierEventData_(payload) || extractCalendlyEventData_(payload);
    }

    if (!eventData) {
      return jsonResponse_({ status: "error", reason: "No se pudieron extraer datos del evento" });
    }

    // Buscar entrevistadores disponibles
    var available = findAvailableInterviewers_(eventData.startTime, eventData.endTime);

    if (available.length < CONFIG.MIN_INTERVIEWERS) {
      // No hay suficientes entrevistadores, loguear el problema
      logAssignment_(eventData, available, "INSUFICIENTES - Solo " + available.length + " disponibles");
      return jsonResponse_({
        status: "warning",
        reason: "Solo " + available.length + " entrevistadores disponibles, se requieren " + CONFIG.MIN_INTERVIEWERS,
        assigned: available,
      });
    }

    // Seleccionar entrevistadores (tomar los primeros MIN_INTERVIEWERS disponibles)
    var assigned = selectInterviewers_(available);

    // Crear evento en Google Calendar
    var calendarEventId = createCalendarEvent_(eventData, assigned);

    // Loguear asignación
    logAssignment_(eventData, assigned, "OK - Evento creado: " + calendarEventId);

    return jsonResponse_({
      status: "ok",
      candidate: eventData.candidateName,
      assigned: assigned.map(function(a) { return a.name; }),
      calendarEventId: calendarEventId,
    });

  } catch (error) {
    Logger.log("Error en doPost: " + error.toString());
    logError_(error, e.postData ? e.postData.contents : "no payload");
    return jsonResponse_({ status: "error", reason: error.toString() });
  }
}


/**
 * Extrae datos relevantes del payload de Calendly v2
 */
function extractCalendlyEventData_(payload) {
  var p = payload.payload;
  if (!p) return null;

  var startTime, endTime;

  // Calendly v2: scheduled_event tiene start_time y end_time
  if (p.scheduled_event) {
    startTime = new Date(p.scheduled_event.start_time);
    endTime = new Date(p.scheduled_event.end_time);
  }
  // Fallback: intentar event directamente
  else if (p.event && p.event.start_time) {
    startTime = new Date(p.event.start_time);
    endTime = new Date(p.event.end_time);
  }
  else {
    Logger.log("No se encontró start_time en el payload");
    return null;
  }

  return {
    startTime: startTime,
    endTime: endTime,
    candidateName: p.name || p.invitee_name || "Candidato",
    candidateEmail: p.email || p.invitee_email || "",
    eventType: (p.scheduled_event && p.scheduled_event.name) || (p.event_type && p.event_type.name) || "Entrevista",
    calendlyEventUri: (p.scheduled_event && p.scheduled_event.uri) || "",
    cancelUrl: p.cancel_url || "",
    rescheduleUrl: p.reschedule_url || "",
  };
}


/**
 * Extrae datos del payload enviado por Zapier.
 * Zapier envía un JSON plano con campos mapeados desde el trigger de Calendly.
 *
 * Formato esperado (configurado en el Zap → Webhooks POST → Data):
 *   {
 *     "source": "zapier",
 *     "secret": "...",
 *     "start_time": "2025-02-10T09:00:00-06:00",
 *     "end_time": "2025-02-10T09:30:00-06:00",
 *     "candidate_name": "Juan Pérez",
 *     "candidate_email": "juan@example.com",
 *     "event_type_name": "Entrevista técnica",
 *     "calendly_event_uri": "https://api.calendly.com/...",
 *     "cancel_url": "...",
 *     "reschedule_url": "..."
 *   }
 */
function extractZapierEventData_(payload) {
  var startRaw = payload.start_time || payload.startTime;
  var endRaw = payload.end_time || payload.endTime;

  if (!startRaw || !endRaw) {
    Logger.log("Zapier payload missing start_time or end_time");
    return null;
  }

  var startTime = new Date(startRaw);
  var endTime = new Date(endRaw);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    Logger.log("Zapier payload has invalid date format: " + startRaw + " / " + endRaw);
    return null;
  }

  return {
    startTime: startTime,
    endTime: endTime,
    candidateName: payload.candidate_name || payload.name || "Candidato",
    candidateEmail: payload.candidate_email || payload.email || "",
    eventType: payload.event_type_name || payload.event_type || "Entrevista",
    calendlyEventUri: payload.calendly_event_uri || "",
    cancelUrl: payload.cancel_url || "",
    rescheduleUrl: payload.reschedule_url || "",
  };
}


/**
 * Busca en la hoja de disponibilidad quién está libre en el rango dado.
 * Retorna array de {name, email} de entrevistadores disponibles.
 */
function findAvailableInterviewers_(startTime, endTime) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.AVAILABILITY_SHEET);

  if (!sheet) {
    Logger.log("No existe la hoja de disponibilidad. Ejecuta parseWhen2MeetAndTabulate() primero.");
    return [];
  }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  // Headers: ["Fecha/Hora", "Día", "Entrev1", "Entrev2", ..., "Total", "¿Viable?"]
  var headers = data[0];
  var interviewerCols = [];
  for (var c = 2; c < headers.length - 2; c++) {
    interviewerCols.push({ index: c, name: String(headers[c]) });
  }

  // Formatear la hora de búsqueda para comparar
  var searchTime = Utilities.formatDate(startTime, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");

  // Buscar el slot que coincide
  var availableInterviewers = [];

  for (var i = 1; i < data.length; i++) {
    var slotTime = String(data[i][0]);

    if (slotTime === searchTime) {
      // Encontramos el slot, verificar quién está libre
      for (var j = 0; j < interviewerCols.length; j++) {
        var col = interviewerCols[j];
        var status = String(data[i][col.index]);

        if (status === "Libre") {
          var email = CONFIG.INTERVIEWER_EMAILS[col.name] || "";
          availableInterviewers.push({
            name: col.name,
            email: email,
          });
        }
      }
      break;
    }
  }

  // Si no se encontró slot exacto, buscar el más cercano dentro del rango
  if (availableInterviewers.length === 0) {
    availableInterviewers = findClosestSlot_(data, interviewerCols, startTime);
  }

  return availableInterviewers;
}


/**
 * Si no hay match exacto, busca el slot más cercano al startTime.
 */
function findClosestSlot_(data, interviewerCols, targetTime) {
  var targetMs = targetTime.getTime();
  var bestMatch = null;
  var bestDiff = Infinity;

  for (var i = 1; i < data.length; i++) {
    var slotValue = data[i][0];
    var slotDate;

    if (slotValue instanceof Date) {
      slotDate = slotValue;
    } else {
      slotDate = new Date(String(slotValue));
    }

    if (isNaN(slotDate.getTime())) continue;

    var diff = Math.abs(slotDate.getTime() - targetMs);

    // Solo considerar slots dentro de la duración de entrevista
    if (diff < CONFIG.INTERVIEW_DURATION_MINUTES * 60 * 1000 && diff < bestDiff) {
      bestDiff = diff;
      bestMatch = i;
    }
  }

  if (bestMatch === null) return [];

  var result = [];
  for (var j = 0; j < interviewerCols.length; j++) {
    var col = interviewerCols[j];
    if (String(data[bestMatch][col.index]) === "Libre") {
      result.push({
        name: col.name,
        email: CONFIG.INTERVIEWER_EMAILS[col.name] || "",
      });
    }
  }

  return result;
}


/**
 * Selecciona los entrevistadores a asignar.
 * Estrategia: balanceo de carga - asigna a los que tienen menos entrevistas previas.
 */
function selectInterviewers_(available) {
  if (available.length <= CONFIG.MIN_INTERVIEWERS) {
    return available;
  }

  // Contar asignaciones previas de cada entrevistador en el log
  var counts = getAssignmentCounts_();

  // Ordenar por menos asignaciones (balanceo de carga)
  available.sort(function(a, b) {
    var countA = counts[a.name] || 0;
    var countB = counts[b.name] || 0;
    return countA - countB;
  });

  return available.slice(0, CONFIG.MIN_INTERVIEWERS);
}


/**
 * Cuenta cuántas entrevistas tiene asignada cada persona (del log).
 */
function getAssignmentCounts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName(CONFIG.LOG_SHEET);
  var counts = {};

  if (!logSheet || logSheet.getLastRow() < 2) return counts;

  var data = logSheet.getDataRange().getValues();

  // Columna de "Entrevistadores Asignados" es la 4ta (index 3)
  for (var i = 1; i < data.length; i++) {
    var status = String(data[i][5]); // Columna de estado
    if (status.indexOf("OK") === -1) continue;

    var assigned = String(data[i][3]).split(",");
    for (var j = 0; j < assigned.length; j++) {
      var name = assigned[j].trim();
      if (name) {
        counts[name] = (counts[name] || 0) + 1;
      }
    }
  }

  return counts;
}


/**
 * Helper: respuesta JSON para el webhook
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Guarda el payload crudo del webhook para debug
 */
function logWebhookPayload_(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Webhook_Debug");
  if (!sheet) {
    sheet = ss.insertSheet("Webhook_Debug");
    sheet.appendRow(["Timestamp", "Event Type", "Payload"]);
  }

  sheet.appendRow([
    new Date(),
    payload.event || "unknown",
    JSON.stringify(payload).substring(0, 50000),
  ]);
}

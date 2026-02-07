/**
 * ============================================================
 * CONFIGURACIÓN - Editar estos valores antes de usar
 * ============================================================
 */

const CONFIG = {
  // Nombre de la hoja donde pegaste el CSV de When2Meet
  SOURCE_SHEET: "When2Meet_CSV",

  // Nombre de la hoja donde se genera la tabla de disponibilidad
  AVAILABILITY_SHEET: "Disponibilidad",

  // Nombre de la hoja de log de asignaciones
  LOG_SHEET: "Log_Asignaciones",

  // Zona horaria de referencia
  TIMEZONE: "America/Mexico_City",

  // Mínimo de entrevistadores requeridos por entrevista
  MIN_INTERVIEWERS: 2,

  // Duración de cada entrevista en minutos
  INTERVIEW_DURATION_MINUTES: 30,

  // Calendly webhook signing key (obtener de Calendly > Webhooks)
  // Dejar vacío si no se usa verificación de firma
  CALENDLY_WEBHOOK_SIGNING_KEY: "",

  // Calendly Personal Access Token (para obtener detalles del evento)
  CALENDLY_API_TOKEN: "",

  // Emails de los entrevistadores (mapeo nombre When2Meet → email)
  // IMPORTANTE: los nombres deben coincidir EXACTAMENTE con los del When2Meet
  INTERVIEWER_EMAILS: {
    // "Nombre en When2Meet": "email@empresa.com",
    // Ejemplo:
    // "Ana García": "ana.garcia@empresa.com",
    // "Carlos López": "carlos.lopez@empresa.com",
  },

  // Título base para los eventos de calendario
  CALENDAR_EVENT_TITLE: "Entrevista - {candidato}",

  // Descripción del evento de calendario
  CALENDAR_EVENT_DESCRIPTION:
    "Entrevista agendada automáticamente.\n" +
    "Candidato: {candidato}\n" +
    "Email: {email}\n" +
    "Agendado vía Calendly + Apps Script",
};

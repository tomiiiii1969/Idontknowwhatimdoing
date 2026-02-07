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

  // Secreto compartido con Zapier para verificar que el POST es legítimo
  // Generar un valor aleatorio (ej: "mi-secreto-zapier-abc123xyz")
  // Este mismo valor se configura en el Zap como campo "secret"
  ZAPIER_WEBHOOK_SECRET: "",

  // Fuentes de datos aceptadas: "zapier", "calendly", "any"
  // "any" acepta ambos formatos (útil durante migración)
  ACCEPTED_SOURCE: "any",

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
    "Agendado vía Calendly + Zapier + Apps Script",
};

# Configuración de Zapier: Calendly → Apps Script

Zapier actúa como puente entre Calendly y tu Google Apps Script.
No necesitas Calendly Premium porque Zapier usa su propia integración con la API de Calendly.

## Prerequisitos

- Cuenta de Calendly (plan gratuito funciona)
- Cuenta de Zapier (plan gratuito: 100 tasks/mes, polling cada 15 min)
- Apps Script desplegado como Web App (ver SETUP.md pasos 1-6)

## Crear el Zap

### Paso 1: Trigger (Calendly)

1. Ir a [zapier.com](https://zapier.com) → **Create Zap**
2. **Trigger App**: buscar **Calendly**
3. **Event**: seleccionar **Invitee Created**
4. **Account**: conectar tu cuenta de Calendly (OAuth, se abre ventana de autorización)
5. **Test trigger**: Zapier buscará un booking reciente para usar como datos de prueba
   - Si no tienes bookings recientes, crea uno de prueba en Calendly primero

### Paso 2: Action (Webhooks by Zapier)

1. **Action App**: buscar **Webhooks by Zapier**
2. **Event**: seleccionar **POST**
3. Configurar:

| Campo | Valor |
|-------|-------|
| **URL** | La URL de tu Web App (ver menú del Sheet → "Ver URL del webhook") |
| **Payload Type** | `json` |

4. En la sección **Data**, agregar estos campos uno por uno:

| Key (escribir exacto) | Value (seleccionar del trigger de Calendly) |
|------------------------|---------------------------------------------|
| `source` | `zapier` ← escribir literalmente, no seleccionar del trigger |
| `secret` | El mismo valor que pusiste en `ZAPIER_WEBHOOK_SECRET` en Config.gs |
| `start_time` | **Scheduled Event Start Time** (del trigger Calendly) |
| `end_time` | **Scheduled Event End Time** (del trigger Calendly) |
| `candidate_name` | **Name** (del trigger Calendly) |
| `candidate_email` | **Email** (del trigger Calendly) |
| `event_type_name` | **Scheduled Event Name** (del trigger Calendly) |
| `calendly_event_uri` | **Scheduled Event URI** (del trigger Calendly) |
| `cancel_url` | **Cancel URL** (del trigger Calendly) |
| `reschedule_url` | **Reschedule URL** (del trigger Calendly) |

5. **Headers**: dejar vacío (defaults OK)
6. **Test**: enviar request de prueba

### Paso 3: Verificar

1. Ir a tu Google Sheet → hoja **Webhook_Debug**
2. Debería aparecer una fila nueva con el payload de prueba
3. Ir a la hoja **Log_Asignaciones** para ver si se procesó correctamente
4. Revisar tu Google Calendar para verificar que se creó el evento

### Paso 4: Activar

1. Si todo funciona → **Turn on Zap**
2. El Zap queda activo y se ejecutará automáticamente

## Ejemplo de payload que Zapier envía

Así se ve el JSON que llega a tu `doPost()`:

```json
{
  "source": "zapier",
  "secret": "tu-secreto-aqui",
  "start_time": "2025-02-10T09:00:00.000Z",
  "end_time": "2025-02-10T09:30:00.000Z",
  "candidate_name": "María López",
  "candidate_email": "maria.lopez@gmail.com",
  "event_type_name": "Entrevista Técnica",
  "calendly_event_uri": "https://api.calendly.com/scheduled_events/abc123",
  "cancel_url": "https://calendly.com/cancellations/abc123",
  "reschedule_url": "https://calendly.com/reschedulings/abc123"
}
```

## Timing

| Plan Zapier | Frecuencia de polling | Delay máximo |
|-------------|----------------------|--------------|
| Free        | Cada 15 minutos      | ~15 min      |
| Starter     | Cada 2 minutos       | ~2 min       |
| Professional | Cada 1 minuto       | ~1 min       |

Para entrevistas, 15 minutos de delay es generalmente aceptable: el candidato agenda para días futuros, no para "ahora mismo".

## Troubleshooting

**"Unauthorized" en la respuesta del test:**
→ El campo `secret` en Zapier no coincide con `ZAPIER_WEBHOOK_SECRET` en Config.gs. Verificar que sean idénticos.

**No aparece nada en Webhook_Debug:**
→ La URL del Web App es incorrecta. Re-deployear el Apps Script y copiar la URL nueva.

**Se recibe el payload pero no se crea evento en Calendar:**
→ Verificar que las fechas del booking coincidan con algún slot en la hoja de Disponibilidad.
→ Revisar la hoja Log_Asignaciones para ver el estado (puede decir "INSUFICIENTES").

**"No se pudieron extraer datos del evento":**
→ Los nombres de los campos en Zapier no coinciden. Verificar que se escribieron exactamente como en la tabla de arriba.

**Zapier no detecta bookings nuevos:**
→ Verificar que la cuenta de Calendly conectada en Zapier es la correcta.
→ Crear un booking de prueba y esperar hasta 15 minutos (free plan).

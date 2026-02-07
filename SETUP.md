# Setup: When2Meet → Google Sheets + Calendly Auto-Assign

## Arquitectura

```
When2Meet CSV ──→ Google Sheet (disponibilidad tabulada)
                        ↑
Calendly webhook ───→ Apps Script ──→ Google Calendar
                        │                (evento con entrevistadores)
                        ↓
                  Log de asignaciones
```

## Archivos

| Archivo | Qué hace |
|---------|----------|
| `Config.gs` | Configuración: timezone, emails, mínimo de entrevistadores |
| `1_ParseCSV.gs` | Parsea el CSV de When2Meet → tabla de disponibilidad con formato |
| `2_CalendlyWebhook.gs` | Recibe webhooks de Calendly, busca disponibilidad, asigna |
| `3_CalendarScheduler.gs` | Crea eventos en Google Calendar e invita entrevistadores |
| `4_Menu.gs` | Menú en Google Sheets para ejecutar todo sin tocar código |
| `sample_when2meet.csv` | CSV de ejemplo para probar |

## Paso a paso

### 1. Crear el Google Sheet

1. Ir a [sheets.new](https://sheets.new)
2. Crear una hoja llamada exactamente: **`When2Meet_CSV`**
3. Pegar ahí el contenido del CSV de When2Meet (o importar archivo)

### 2. Exportar el CSV de When2Meet

When2Meet no tiene export nativo. Opciones:

- **Opción A (recomendada):** Usar el bookmarklet [when2meet-extractor](https://github.com/aculich/when2meet-extractor) — visitar tu When2Meet, ejecutar el bookmarklet, descargar CSV
- **Opción B:** Usar el userscript [When2Meet CSV Exporter](https://greasyfork.org/en/scripts/523476-when2meet-csv-exporter) con Tampermonkey
- **Opción C:** Copiar manualmente los datos al formato del `sample_when2meet.csv`

El CSV debe tener este formato:
```
Time,Persona1,Persona2,...
2025-02-10 09:00,1,0,...
```
Donde `1` = disponible, `0` = no disponible.

### 3. Copiar el código a Apps Script

1. En el Google Sheet: **Extensiones → Apps Script**
2. Borrar el contenido default de `Code.gs`
3. Crear los siguientes archivos (clic en `+` → Script):
   - `Config.gs` → pegar contenido de `Config.gs`
   - `1_ParseCSV.gs` → pegar contenido de `1_ParseCSV.gs`
   - `2_CalendlyWebhook.gs` → pegar contenido de `2_CalendlyWebhook.gs`
   - `3_CalendarScheduler.gs` → pegar contenido de `3_CalendarScheduler.gs`
   - `4_Menu.gs` → pegar contenido de `4_Menu.gs`
4. Eliminar el archivo `Code.gs` vacío original

### 4. Configurar `Config.gs`

Editar estos campos obligatorios:

```javascript
INTERVIEWER_EMAILS: {
  "Ana García": "ana.garcia@empresa.com",
  "Carlos López": "carlos.lopez@empresa.com",
  // ... nombres EXACTOS como aparecen en el When2Meet
},
```

Ajustar opcionalmente:
- `TIMEZONE` — zona horaria de referencia
- `MIN_INTERVIEWERS` — mínimo requerido por entrevista
- `INTERVIEW_DURATION_MINUTES` — duración de cada slot

### 5. Parsear el When2Meet

1. Recargar el Google Sheet (para que aparezca el menú)
2. **🎯 Entrevistas → 📊 Parsear When2Meet CSV**
3. Autorizar los permisos cuando se soliciten
4. Se generará la hoja **Disponibilidad** con formato verde/rojo

### 6. Desplegar el webhook

1. En Apps Script: **Deploy → New deployment**
2. Tipo: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Clic en **Deploy**
6. Copiar la URL del web app

### 7. Configurar Calendly

1. Ir a [Calendly Integrations](https://calendly.com/integrations)
2. Webhooks → **Add Webhook Subscription**
3. Pegar la URL del paso 6
4. Events: seleccionar **invitee.created**
5. Guardar

### 8. Probar

1. En el Sheet: **🎯 Entrevistas → 🧪 Test: simular webhook Calendly**
2. El test buscará la primera franja viable y te preguntará si crear un evento real
3. Verificar que se creó el evento en Google Calendar con los entrevistadores correctos

## Flujo en producción

```
1. Candidato agenda en Calendly
2. Calendly envía webhook → doPost()
3. Apps Script busca la hora en la tabla de disponibilidad
4. Encuentra entrevistadores con "Libre" en esa franja
5. Selecciona los que tienen menos entrevistas (balanceo de carga)
6. Crea evento en Google Calendar e invita a todos
7. Loguea la asignación en la hoja Log_Asignaciones
```

## Actualizar disponibilidad

Cuando los entrevistadores actualicen su When2Meet:
1. Re-exportar el CSV
2. Pegar en la hoja `When2Meet_CSV`
3. Ejecutar **🎯 Entrevistas → 🔄 Recargar disponibilidad**

## Troubleshooting

- **"No se encontró la hoja When2Meet_CSV"**: Crear la hoja con ese nombre exacto
- **Webhook no llega**: Verificar la URL en Calendly, revisar la hoja `Webhook_Debug`
- **No se asignan entrevistadores**: Verificar que los nombres en `INTERVIEWER_EMAILS` coincidan exactamente con los del CSV
- **Error de permisos en Calendar**: Re-autorizar en Apps Script → Run → Authorize

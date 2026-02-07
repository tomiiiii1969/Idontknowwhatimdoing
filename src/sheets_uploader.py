"""
Fase 3: Crear/actualizar Google Sheet.

Usa la Google Sheets API para:
  1. Crear un spreadsheet nuevo (o actualizar uno existente)
  2. Poblar con la matriz de disponibilidad
  3. Aplicar conditional formatting (verde=Libre, rojo=Ocupado)
  4. Auto-resize columnas

Requiere:
  - credentials.json (OAuth client) en la raíz del proyecto
  - Primera ejecución abre browser para autorizar
  - token.json se guarda automáticamente para futuros usos
"""

import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from config import SCOPES, SPREADSHEET_TITLE


def get_credentials() -> Credentials:
    """Obtiene credenciales OAuth, solicitando login si es necesario."""
    creds = None
    token_path = "token.json"
    creds_path = "credentials.json"

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(creds_path):
                raise FileNotFoundError(
                    "No se encontró credentials.json. "
                    "Descárgalo desde Google Cloud Console > APIs & Services > Credentials."
                )
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "w") as token:
            token.write(creds.to_json())

    return creds


def create_spreadsheet(creds: Credentials, title: str = None) -> str:
    """Crea un nuevo Google Sheet y devuelve su ID."""
    service = build("sheets", "v4", credentials=creds)

    spreadsheet_body = {
        "properties": {"title": title or SPREADSHEET_TITLE}
    }
    spreadsheet = service.spreadsheets().create(body=spreadsheet_body).execute()
    spreadsheet_id = spreadsheet["spreadsheetId"]

    print(f"Spreadsheet creado: https://docs.google.com/spreadsheets/d/{spreadsheet_id}")
    return spreadsheet_id


def upload_matrix(creds: Credentials, spreadsheet_id: str, matrix: list[list[str]]) -> None:
    """Sube la matriz de disponibilidad al spreadsheet."""
    service = build("sheets", "v4", credentials=creds)

    body = {"values": matrix}
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="A1",
        valueInputOption="RAW",
        body=body,
    ).execute()

    print(f"Datos subidos: {len(matrix) - 1} slots de tiempo")


def apply_formatting(creds: Credentials, spreadsheet_id: str, matrix: list[list[str]]) -> None:
    """
    Aplica conditional formatting al spreadsheet:
      - Verde (#b7e1cd) para celdas con "Libre"
      - Rojo (#f4c7c3) para celdas con "Ocupado"
      - Header en negrita con fondo gris
      - Auto-resize de columnas
    """
    service = build("sheets", "v4", credentials=creds)

    sheet_metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = sheet_metadata["sheets"][0]["properties"]["sheetId"]

    num_rows = len(matrix)
    num_cols = len(matrix[0]) if matrix else 0

    requests_list = [
        # Header: negrita + fondo gris
        {
            "repeatCell": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_cols,
                },
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"bold": True},
                        "backgroundColor": {
                            "red": 0.85, "green": 0.85, "blue": 0.85,
                        },
                    }
                },
                "fields": "userEnteredFormat(textFormat,backgroundColor)",
            }
        },
        # Conditional: "Libre" -> verde
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [{
                        "sheetId": sheet_id,
                        "startRowIndex": 1,
                        "endRowIndex": num_rows,
                        "startColumnIndex": 1,
                        "endColumnIndex": num_cols - 1,
                    }],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": "Libre"}],
                        },
                        "format": {
                            "backgroundColor": {
                                "red": 0.718, "green": 0.882, "blue": 0.804,
                            }
                        },
                    },
                },
                "index": 0,
            }
        },
        # Conditional: "Ocupado" -> rojo
        {
            "addConditionalFormatRule": {
                "rule": {
                    "ranges": [{
                        "sheetId": sheet_id,
                        "startRowIndex": 1,
                        "endRowIndex": num_rows,
                        "startColumnIndex": 1,
                        "endColumnIndex": num_cols - 1,
                    }],
                    "booleanRule": {
                        "condition": {
                            "type": "TEXT_EQ",
                            "values": [{"userEnteredValue": "Ocupado"}],
                        },
                        "format": {
                            "backgroundColor": {
                                "red": 0.957, "green": 0.78, "blue": 0.765,
                            }
                        },
                    },
                },
                "index": 1,
            }
        },
        # Freeze header row
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        },
        # Auto-resize columns
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": num_cols,
                }
            }
        },
    ]

    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests_list},
    ).execute()

    print("Formatting aplicado (colores, header, auto-resize)")


def upload_to_sheets(matrix: list[list[str]], title: str = None) -> str:
    """
    Función principal: crea sheet, sube datos y aplica formato.
    Returns: URL del spreadsheet.
    """
    creds = get_credentials()
    spreadsheet_id = create_spreadsheet(creds, title)
    upload_matrix(creds, spreadsheet_id, matrix)
    apply_formatting(creds, spreadsheet_id, matrix)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
    return url

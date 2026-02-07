"""
Fase 2: Transformar datos crudos a formato tabular.

Convierte la lista de records {timestamp, interviewer, available}
en una matriz: filas = slots de tiempo, columnas = entrevistadores.

Output: lista de listas listas para volcar a Google Sheets o CSV.
"""

import csv
from io import StringIO


def build_availability_matrix(parsed_data: dict) -> list[list[str]]:
    """
    Convierte parsed_data en una matriz tabular.

    Returns:
        Lista de listas donde:
        - Fila 0 = headers: ["Fecha/Hora", "Entrev_1", ..., "Total Disponibles"]
        - Fila N = datos: ["2024-01-15 09:00", "Libre", "Ocupado", ..., "3"]
    """
    records = parsed_data["records"]
    people = parsed_data["people"]
    time_slots = parsed_data["time_slots"]

    # Indexar disponibilidad: {(timestamp, interviewer): available}
    availability_index = {}
    datetime_map = {}
    for rec in records:
        key = (rec["timestamp"], rec["interviewer"])
        availability_index[key] = rec["available"]
        datetime_map[rec["timestamp"]] = rec["datetime"]

    # Headers
    headers = ["Fecha/Hora"] + people + ["Total Disponibles"]

    # Filas de datos
    rows = [headers]
    for ts in sorted(set(time_slots)):
        row = [datetime_map.get(ts, str(ts))]
        available_count = 0

        for person in people:
            is_available = availability_index.get((ts, person), False)
            status = "Libre" if is_available else "Ocupado"
            row.append(status)
            if is_available:
                available_count += 1

        row.append(str(available_count))
        rows.append(row)

    return rows


def matrix_to_csv(matrix: list[list[str]], output_path: str) -> str:
    """Exporta la matriz a un archivo CSV."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(matrix)
    return output_path


def matrix_to_csv_string(matrix: list[list[str]]) -> str:
    """Devuelve la matriz como string CSV (útil para debug)."""
    output = StringIO()
    writer = csv.writer(output)
    writer.writerows(matrix)
    return output.getvalue()

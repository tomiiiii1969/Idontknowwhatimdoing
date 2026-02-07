"""
Orquestador principal: When2Meet → Google Sheet.

Uso:
  # Desde URL de When2Meet
  python main.py --url https://www.when2meet.com/XXXXX

  # Desde archivo JSON local
  python main.py --json data/export.json

  # Solo generar CSV (sin subir a Google Sheets)
  python main.py --url https://www.when2meet.com/XXXXX --csv-only

  # Con título personalizado para el Sheet
  python main.py --url https://www.when2meet.com/XXXXX --title "Entrevistas Q1 2025"
"""

import argparse
import sys

from src.when2meet_parser import parse_from_url, parse_from_json
from src.transformer import build_availability_matrix, matrix_to_csv, matrix_to_csv_string
from src.sheets_uploader import upload_to_sheets


def main():
    parser = argparse.ArgumentParser(
        description="Extrae disponibilidad de When2Meet y la sube a Google Sheets"
    )

    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="URL pública del When2Meet")
    source.add_argument("--json", help="Ruta a archivo JSON con datos exportados")

    parser.add_argument("--csv-only", action="store_true",
                        help="Solo genera CSV, no sube a Google Sheets")
    parser.add_argument("--csv-output", default="data/disponibilidad.csv",
                        help="Ruta de salida del CSV (default: data/disponibilidad.csv)")
    parser.add_argument("--title", default=None,
                        help="Título del Google Sheet")

    args = parser.parse_args()

    # Fase 1: Parsear When2Meet
    print("=== Fase 1: Extrayendo datos de When2Meet ===")
    if args.url:
        print(f"Fuente: URL {args.url}")
        parsed_data = parse_from_url(args.url)
    else:
        print(f"Fuente: archivo {args.json}")
        parsed_data = parse_from_json(args.json)

    print(f"Encontrados: {len(parsed_data['people'])} entrevistadores, "
          f"{len(set(parsed_data['time_slots']))} slots de tiempo")

    # Fase 2: Transformar a matriz
    print("\n=== Fase 2: Transformando a formato tabular ===")
    matrix = build_availability_matrix(parsed_data)
    print(f"Matriz generada: {len(matrix)-1} filas x {len(matrix[0])} columnas")

    # Exportar CSV siempre (como respaldo)
    csv_path = matrix_to_csv(matrix, args.csv_output)
    print(f"CSV guardado en: {csv_path}")

    if args.csv_only:
        print("\n=== Modo CSV-only: no se sube a Google Sheets ===")
        print("\nPreview:")
        print(matrix_to_csv_string(matrix[:6]))
        return

    # Fase 3: Subir a Google Sheets
    print("\n=== Fase 3: Subiendo a Google Sheets ===")
    url = upload_to_sheets(matrix, title=args.title)
    print(f"\nGoogle Sheet listo: {url}")


if __name__ == "__main__":
    main()

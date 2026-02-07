"""
Fase 1: Extraer datos de When2Meet.

Dos estrategias soportadas:
  1. Scraping de URL pública (extrae JS variables del HTML)
  2. Carga de JSON manual (si el usuario exportó los datos)

Output: lista de dicts {timestamp, interviewer, available}
"""

import json
import re
from datetime import datetime

import pytz
import requests
from bs4 import BeautifulSoup

from config import REFERENCE_TIMEZONE


def parse_from_url(url: str) -> dict:
    """
    Extrae datos de un When2Meet público.

    When2Meet almacena la disponibilidad en variables JS dentro del HTML:
      - TimeOfSlot: array de unix timestamps para cada slot
      - PeopleNames: array de nombres de participantes
      - PeopleIDs: array de IDs
      - AvailableAtSlot: array de arrays con IDs disponibles por slot
    """
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    html = response.text

    time_slots = _extract_js_array(html, "TimeOfSlot")
    people_names = _extract_js_array(html, "PeopleNames")
    people_ids = _extract_js_array(html, "PeopleIDs")
    available_at_slot = _extract_js_nested_array(html, "AvailableAtSlot")

    if not time_slots or not people_names:
        raise ValueError(
            "No se pudieron extraer datos del When2Meet. "
            "Verifica que el link sea público y tenga respuestas."
        )

    return _build_availability(time_slots, people_names, people_ids, available_at_slot)


def parse_from_json(file_path: str) -> dict:
    """
    Carga datos desde un archivo JSON con el formato:
    {
      "time_slots": [unix_ts, ...],
      "people": ["nombre1", ...],
      "availability": {
        "nombre1": [unix_ts_disponible, ...],
        ...
      }
    }
    """
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    tz = pytz.timezone(REFERENCE_TIMEZONE)
    records = []

    for ts in data["time_slots"]:
        dt = datetime.fromtimestamp(ts, tz=tz)
        for person in data["people"]:
            records.append({
                "timestamp": ts,
                "datetime": dt.strftime("%Y-%m-%d %H:%M"),
                "interviewer": person,
                "available": ts in data["availability"].get(person, []),
            })

    return {
        "records": records,
        "time_slots": data["time_slots"],
        "people": data["people"],
    }


def _extract_js_array(html: str, var_name: str) -> list:
    """Extrae un array JS simple del HTML de When2Meet."""
    pattern = rf"{var_name}\s*=\s*\[(.*?)\]"
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return []

    raw = match.group(1).strip()
    if not raw:
        return []

    items = [item.strip().strip("'\"") for item in raw.split(",")]

    # Intentar convertir a int si son números
    try:
        return [int(item) for item in items]
    except ValueError:
        return items


def _extract_js_nested_array(html: str, var_name: str) -> list:
    """Extrae un array de arrays JS del HTML."""
    pattern = rf"{var_name}\s*=\s*\[(.*?)\];"
    match = re.search(pattern, html, re.DOTALL)
    if not match:
        return []

    raw = match.group(1)
    inner_pattern = r"\[(.*?)\]"
    inner_matches = re.findall(inner_pattern, raw)

    result = []
    for inner in inner_matches:
        if inner.strip():
            items = [int(x.strip()) for x in inner.split(",") if x.strip()]
            result.append(items)
        else:
            result.append([])

    return result


def _build_availability(time_slots, people_names, people_ids, available_at_slot):
    """Construye estructura de disponibilidad a partir de datos crudos de W2M."""
    tz = pytz.timezone(REFERENCE_TIMEZONE)

    id_to_name = {}
    for i, pid in enumerate(people_ids):
        if i < len(people_names):
            id_to_name[pid] = people_names[i]

    records = []
    for slot_idx, ts in enumerate(time_slots):
        dt = datetime.fromtimestamp(ts, tz=tz)
        available_ids = available_at_slot[slot_idx] if slot_idx < len(available_at_slot) else []

        for pid, name in id_to_name.items():
            records.append({
                "timestamp": ts,
                "datetime": dt.strftime("%Y-%m-%d %H:%M"),
                "interviewer": name,
                "available": pid in available_ids,
            })

    return {
        "records": records,
        "time_slots": time_slots,
        "people": list(id_to_name.values()),
    }

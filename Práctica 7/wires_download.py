#!/usr/bin/env python3
"""
El código que se expone a continuación ha sido generado con la ayuda de Claude para agrupar en diversos json los datos. 

    src/cable-geo.json          trazado de los cables
    src/landing-point-geo.json  puntos de amarre
    src/cables_info.json        año de puesta en servicio, longitud, propietarios y amarres

Solo usa la librería estándar de Python.
"""
import argparse
import json
import os
import sys
import time
import urllib.request

BASE = "https://www.submarinecablemap.com/api/v3"
HEADERS = {"User-Agent": "Mozilla/5.0 (practica IG ULPGC)"}


def get_json(url, intentos=3):
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if i == intentos - 1:
                raise
            print(f"  reintento ({e})")
            time.sleep(2)


def guarda(obj, ruta):
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Escrito {ruta} ({os.path.getsize(ruta) // 1024} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sin-info", action="store_true", help="no descarga las fichas de cada cable")
    ap.add_argument("--carpeta", default="src")
    args = ap.parse_args()
    os.makedirs(args.carpeta, exist_ok=True)

    print("Descargando trazados...")
    cables = get_json(f"{BASE}/cable/cable-geo.json")
    guarda(cables, os.path.join(args.carpeta, "cable-geo.json"))

    print("Descargando puntos de amarre...")
    amarres = get_json(f"{BASE}/landing-point/landing-point-geo.json")
    guarda(amarres, os.path.join(args.carpeta, "landing-point-geo.json"))

    if args.sin_info:
        return

    ids = sorted({f["properties"].get("id") for f in cables["features"] if f["properties"].get("id")})
    print(f"Descargando la ficha de {len(ids)} cables (paciencia)...")
    info = {}
    for n, cid in enumerate(ids, 1):
        try:
            d = get_json(f"{BASE}/cable/{cid}.json")
        except Exception as e:
            print(f"  {cid}: error {e}")
            continue
        info[cid] = {
            "name": d.get("name"),
            "rfs": d.get("rfs"),
            "rfs_year": d.get("rfs_year"),
            "length": d.get("length"),
            "owners": d.get("owners"),
            "is_planned": d.get("is_planned"),
            "landing_points": [lp.get("name") for lp in d.get("landing_points", []) if lp.get("name")],
        }
        if n % 25 == 0:
            print(f"  {n}/{len(ids)}")
        time.sleep(0.15)  # no saturar el servidor

    guarda(info, os.path.join(args.carpeta, "cables_info.json"))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"Error: {e}\nSi la web ha cambiado, descarga cable-geo.json y landing-point-geo.json "
                 "a mano desde las herramientas de desarrollador del navegador (pestaña Red).")

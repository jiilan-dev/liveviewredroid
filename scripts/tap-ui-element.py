#!/usr/bin/env python3
import argparse
import re
import subprocess
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path


def run_cmd(cmd):
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout.strip(), proc.stderr.strip()


def adb(serial, *args):
    cmd = ["adb", "-s", serial, *args]
    return run_cmd(cmd)


def parse_bounds(bounds_text):
    match = re.match(r"^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$", bounds_text)
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    return x1, y1, x2, y2


def center_of(bounds):
    x1, y1, x2, y2 = bounds
    return (x1 + x2) // 2, (y1 + y2) // 2


def normalize_text(value):
    return " ".join((value or "").strip().lower().split())


def node_matches(node, selector_text, selector_id, selector_desc):
    text = (node.attrib.get("text") or "").strip()
    res_id = (node.attrib.get("resource-id") or "").strip()
    desc = (node.attrib.get("content-desc") or "").strip()

    text_norm = normalize_text(text)
    desc_norm = normalize_text(desc)
    selector_text_norm = normalize_text(selector_text)
    selector_desc_norm = normalize_text(selector_desc)

    if selector_id and res_id == selector_id:
        return True

    if selector_desc and desc.lower() == selector_desc.lower():
        return True

    if selector_desc_norm and (desc_norm == selector_desc_norm or selector_desc_norm in desc_norm):
        return True

    if selector_text:
        if text.lower() == selector_text.lower():
            return True
        if desc.lower() == selector_text.lower():
            return True

    # Fallback matching for slightly different UI strings/whitespace.
    if selector_text_norm:
        if text_norm == selector_text_norm or selector_text_norm in text_norm:
            return True
        if desc_norm == selector_text_norm or selector_text_norm in desc_norm:
            return True

    return False


def find_tappable_node(xml_path, selector_text, selector_id, selector_desc):
    tree = ET.parse(xml_path)
    root = tree.getroot()

    for node in root.iter("node"):
        if not node_matches(node, selector_text, selector_id, selector_desc):
            continue

        bounds = parse_bounds(node.attrib.get("bounds", ""))
        if not bounds:
            continue

        clickable = (node.attrib.get("clickable") or "false").lower() == "true"
        enabled = (node.attrib.get("enabled") or "true").lower() == "true"

        if enabled and (clickable or True):
            return center_of(bounds)

    return None


def dump_ui_xml(serial, local_xml_path):
    code, out, err = adb(serial, "shell", "uiautomator", "dump", "/sdcard/window_dump.xml")
    if code != 0:
        raise RuntimeError(f"uiautomator dump gagal: {err or out}")

    code, out, err = adb(serial, "pull", "/sdcard/window_dump.xml", str(local_xml_path))
    if code != 0:
        raise RuntimeError(f"adb pull xml gagal: {err or out}")


def tap(serial, x, y):
    code, out, err = adb(serial, "shell", "input", "tap", str(x), str(y))
    if code != 0:
        raise RuntimeError(f"input tap gagal: {err or out}")


def main():
    parser = argparse.ArgumentParser(description="Cari elemen UI dan tap otomatis via adb")
    parser.add_argument("--serial", default="localhost:5555", help="ADB serial target")
    parser.add_argument("--text", default="Done", help="Cari berdasarkan text exact (case-insensitive)")
    parser.add_argument("--id", dest="resource_id", default="", help="Cari berdasarkan resource-id")
    parser.add_argument("--desc", default="", help="Cari berdasarkan content-desc")
    parser.add_argument("--timeout", type=int, default=60, help="Maksimal tunggu elemen (detik)")
    parser.add_argument("--interval", type=float, default=1.0, help="Interval retry (detik)")
    args = parser.parse_args()

    if not args.text and not args.resource_id and not args.desc:
        raise SystemExit("Minimal isi satu selector: --text atau --id atau --desc")

    code, out, err = adb(args.serial, "get-state")
    if code != 0:
        raise SystemExit(f"Device adb belum siap: {err or out}")

    deadline = time.time() + args.timeout

    with tempfile.TemporaryDirectory() as tmpdir:
        xml_path = Path(tmpdir) / "window_dump.xml"

        while time.time() < deadline:
            try:
                dump_ui_xml(args.serial, xml_path)
                point = find_tappable_node(xml_path, args.text, args.resource_id, args.desc)
                if point:
                    x, y = point
                    tap(args.serial, x, y)
                    print(f"Tap sukses di titik ({x}, {y})")
                    return
            except Exception:
                pass

            time.sleep(args.interval)

    raise SystemExit("Elemen UI tidak ditemukan sampai timeout")


if __name__ == "__main__":
    main()

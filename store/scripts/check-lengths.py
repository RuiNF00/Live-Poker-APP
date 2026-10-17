#!/usr/bin/env python3
"""Checks store listing fields against App Store / Google Play length limits.

Run after fill.sh so the real app name is counted:
    python3 store/scripts/check-lengths.py store/out/listing/*.md
"""
import glob
import os
import re
import sys

# Field label (as written in the listing files) -> (limit, unit)
LIMITS = {
    "Nome": (30, "chars"), "Name": (30, "chars"),
    "Subtítulo": (30, "chars"), "Subtitle": (30, "chars"),
    "Título": (30, "chars"), "Title": (30, "chars"),
    "Texto promocional": (170, "chars"), "Promotional text": (170, "chars"),
    "Palavras-chave": (100, "bytes"), "Keywords": (100, "bytes"),
    "Descrição curta": (80, "chars"), "Short description": (80, "chars"),
    "Descrição": (4000, "chars"), "Description": (4000, "chars"),
    "Nombre": (30, "chars"), "Palabras clave": (100, "bytes"), "Descripción corta": (80, "chars"), "Descripción": (4000, "chars"),
}

FIELD = re.compile(r"^\*\*(?P<label>[^*]+?)\*\* \(\d+[^)]*\):\s*(?P<inline>.*)$")


def fields(text):
    """Yields (label, value) for every '**Label** (limit): value' block."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = FIELD.match(lines[i])
        if not m:
            i += 1
            continue
        label, value = m["label"], m["inline"].strip()
        i += 1
        if not value:
            body = []
            while i < len(lines) and not lines[i].startswith("**") and not lines[i].startswith("## "):
                body.append(lines[i])
                i += 1
            value = "\n".join(body).strip()
        yield label, value


def main(paths):
    failed = False
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for label, value in fields(f.read()):
                if label not in LIMITS:
                    continue
                limit, unit = LIMITS[label]
                size = len(value.encode("utf-8")) if unit == "bytes" else len(value)
                status = "ok " if size <= limit else "TOO LONG"
                failed |= size > limit
                print(f"{status} {path}: {label} {size}/{limit} {unit}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    # No arguments: check the filled listings, so a bare run never passes vacuously.
    default = sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "out", "listing", "*.md")))
    main(sys.argv[1:] or default)

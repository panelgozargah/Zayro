#!/usr/bin/env python3
"""Build multi-resolution zayro.ico from the user's Zayro logo."""
from PIL import Image

SRC = "/home/z/my-project/upload/Zayro pdf logo.jpg"
OUT = "/home/z/my-project/desktop-build/zayro.ico"
SIZES = [256, 128, 64, 48, 32, 16]

img = Image.open(SRC).convert("RGBA")
base = img.resize((256, 256), Image.LANCZOS)
base.save(OUT, format="ICO", sizes=[(s, s) for s in SIZES])
print("saved", OUT)

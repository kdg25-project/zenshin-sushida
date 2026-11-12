#!/usr/bin/env python3
"""Create source-faithful, textless PDF crops from an Illustrator PDF-compatible AI.

The Illustrator sources are left untouched.  Text is removed only by dropping
complete PDF BT..ET blocks; vector paths, images, clipping paths, and effects
are preserved.  Poppler's vector anti-aliasing is explicitly disabled: these
pixel-art files contain adjacent vector tiles, and anti-aliasing makes false
hairline grids between them. This is appropriate for live-value frames, never
for a crop whose state text is intentionally part of the artwork.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream


def textless_pdf(source: Path, output: Path) -> None:
    reader = PdfReader(source)
    if len(reader.pages) != 1:
        raise ValueError(f"expected exactly one source page, got {len(reader.pages)}")
    original_page = reader.pages[0]
    writer = PdfWriter()
    writer.add_page(original_page)
    page = writer.pages[0]
    contents = page.get_contents()
    if contents is None:
        raise ValueError("source page has no content stream")

    filtered: list[tuple[object, bytes]] = []
    inside_text = False
    for operands, operator in contents.operations:
        if operator == b"BT":
            inside_text = True
        if not inside_text:
            filtered.append((operands, operator))
        if operator == b"ET":
            inside_text = False
    if inside_text:
        raise ValueError("unbalanced PDF text block")

    clean = ContentStream(None, reader)
    clean.operations = filtered
    page.replace_contents(clean)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as stream:
        writer.write(stream)


def crop_png(source: Path, output: Path, crop: tuple[int, int, int, int]) -> None:
    x, y, width, height = crop
    output.parent.mkdir(parents=True, exist_ok=True)
    output_base = output.with_suffix("")
    subprocess.run(
        [
            "pdftoppm", "-png", "-singlefile", "-r", "72", "-aaVector", "no",
            "-x", str(x), "-y", str(y), "-W", str(width), "-H", str(height),
            str(source), str(output_base),
        ],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path, help="final .png crop")
    parser.add_argument("--textless-pdf", type=Path, required=True)
    parser.add_argument("--crop", type=int, nargs=4, metavar=("X", "Y", "WIDTH", "HEIGHT"), required=True)
    args = parser.parse_args()

    textless_pdf(args.source, args.textless_pdf)
    crop_png(args.textless_pdf, args.output, tuple(args.crop))


if __name__ == "__main__":
    main()

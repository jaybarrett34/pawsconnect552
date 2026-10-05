"""Render docs/report.md -> docs/PawsConnect_Report.pdf via headless Chrome.

Screenshots: drop PNG/JPGs into docs/screenshots/ (sorted by name); they replace the "Figure N: [...]" placeholders.
usage: uv run --with markdown scripts/report_pdf.py
"""

from __future__ import annotations

import base64
import re
import subprocess
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: Letter; margin: 0.8in 0.85in; }
body { font: 10.5pt/1.45 Georgia, 'Times New Roman', serif; color: #1f1a17; }
h1 { font-size: 19pt; margin: 0 0 4pt; }
h2 { font-size: 13.5pt; margin: 16pt 0 5pt; border-bottom: 1px solid #ddd; padding-bottom: 2pt; }
h3 { font-size: 11.5pt; margin: 11pt 0 3pt; } p { margin: 0 0 7pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 9pt; font-size: 9pt; page-break-inside: avoid; }
th, td { border: 1px solid #cfc6bd; padding: 3pt 5pt; text-align: left; vertical-align: top; } th { background: #f2ebe3; }
code { font: 8.5pt Menlo, monospace; background: #f4f1ed; padding: 0 2px; }
figure { margin: 10pt 0; page-break-inside: avoid; } figure img { width: 100%; border: 1px solid #ccc; }
figcaption { font-size: 9pt; color: #555; margin-top: 3pt; }
"""


def main() -> None:
    md = (DOCS / "report.md").read_text()
    shots = (
        sorted(p for p in (DOCS / "screenshots").glob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg"})
        if (DOCS / "screenshots").is_dir()
        else []
    )
    placeholders = re.findall(r"^Figure (\d+): \[(.*?)\]\s*$", md, flags=re.M)
    html = markdown.markdown(md, extensions=["tables"])
    for (n, caption), shot in zip(placeholders, shots, strict=False):
        mime = "image/png" if shot.suffix.lower() == ".png" else "image/jpeg"
        data = base64.b64encode(shot.read_bytes()).decode()
        fig = f'<figure><img src="data:{mime};base64,{data}"><figcaption>Figure {n}: {caption}</figcaption></figure>'
        html = re.sub(rf"<p>Figure {n}: \[.*?\]</p>", fig, html)
    out_html = DOCS / "report.html"
    out_html.write_text(f"<!doctype html><meta charset=utf-8><style>{CSS}</style>{html}")
    pdf = DOCS / "PawsConnect_Report.pdf"
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={pdf}", out_html.as_uri()],
        check=True,
        capture_output=True,
    )
    out_html.unlink()
    print(f"Wrote {pdf} ({len(shots)} screenshot(s) embedded)")


if __name__ == "__main__":
    main()

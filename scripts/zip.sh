#!/usr/bin/env bash
# Build the Brightspace submission zip (source + data + cache; no deps, builds, or secrets).
set -euo pipefail
cd "$(dirname "$0")/.."
out=PawsConnect_submission.zip
rm -f "$out"
zip -rq "$out" . -x 'node_modules/*' '.next/*' '.venv/*' '.git/*' '.vercel/*' '*__pycache__*' '.env' '.env.*' '*.zip' '.DS_Store' '.ruff_cache/*' '*.tsbuildinfo' 'docs/report-data.md' 'docs/*.docx' 'docs/PawsConnect_Report.pdf' 'docs/screenshots/*'
zip -q "$out" .env.example
echo "Wrote $out ($(du -h "$out" | cut -f1))"

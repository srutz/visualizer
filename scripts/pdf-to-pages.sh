#!/usr/bin/env bash
#
# Convert every page of a PDF to a PNG under public/<name>/.
#
# Usage:
#   scripts/pdf-to-pages.sh <pdf-file> [name] [dpi]
#
#   <pdf-file>  path to the source PDF (required)
#   [name]      output folder under public/ (default: PDF basename)
#   [dpi]       render resolution (default: 150)
#
# Produces:
#   public/<name>/page-001.png
#   public/<name>/page-002.png
#   ...
#
# Uses pdftocairo (poppler) for rendering — it's Cairo-based so it produces
# clean antialiased PNGs out of the box, and it handles the zero-padded
# filename suffix for us. Falls back to mutool (mupdf) if pdftocairo isn't
# installed, since that's also very good on Linux.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <pdf-file> [name] [dpi]" >&2
  exit 1
fi

pdf="$1"

if [[ ! -f "$pdf" ]]; then
  echo "error: PDF not found: $pdf" >&2
  exit 1
fi

name="${2:-$(basename "$pdf" .pdf)}"
dpi="${3:-150}"

# Resolve project root as the parent of this script's directory, so the
# script works the same whether you run it from the repo root or elsewhere.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"
out_dir="$project_root/public/$name"

mkdir -p "$out_dir"

echo "rendering '$pdf' → $out_dir (dpi=$dpi)"

if command -v pdftocairo >/dev/null 2>&1; then
  # pdftocairo writes files as <prefix>-<page>.png with zero-padding that
  # matches the total page count. We pass the prefix as "page" so the
  # filenames come out as page-001.png, page-002.png, ...
  pdftocairo -png -r "$dpi" "$pdf" "$out_dir/page"
elif command -v mutool >/dev/null 2>&1; then
  # mutool convert uses a printf-style pattern; %03d gives 3-digit padding.
  # We compute DPI by overriding the default 72 dpi via -O.
  mutool convert -O "resolution=$dpi" -o "$out_dir/page-%03d.png" "$pdf"
else
  echo "error: need pdftocairo (poppler-utils) or mutool (mupdf-tools) installed" >&2
  exit 1
fi

page_count=$(find "$out_dir" -maxdepth 1 -name 'page-*.png' | wc -l)
echo "done: $page_count pages → public/$name/"

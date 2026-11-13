#!/usr/bin/env bash
# Render the source PDF-compatible AI exactly once. This never modifies the AI.
# The resulting stage intentionally retains its source nickname placeholder;
# runtime must cover that region with menu-v4-input-clean.png before drawing the
# live nickname.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 SOURCE.ai OUTPUT.png" >&2
  exit 64
fi

source_ai=$1
output_png=$2
output_base=${output_png%.png}
pdftoppm -png -singlefile -r 72 -aaVector no "$source_ai" "$output_base"

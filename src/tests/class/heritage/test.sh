#!/bin/bash

if [[ -z "$1" ]]; then
  echo "Usage: $0 <base-path>"
  exit 1
fi

BASE_PATH="$1"

if [[ ! -d "$BASE_PATH" ]]; then
  echo "Error: '$BASE_PATH' is not a directory"
  exit 1
fi

REPORT_FILE="execution_report_$(date +%Y%m%d_%H%M%S).txt"

v1_failures=0
v2_failures=0
total_dirs=0

{
  echo "Execution Report"
  echo "Base Path: $BASE_PATH"
  echo "Generated: $(date)"
  echo "----------------------------------------"
} > "$REPORT_FILE"

# Iterate over immediate subdirectories
for dir in "$BASE_PATH"/*; do
  ((total_dirs++))

  dirname=$(basename "$dir")

  v1_file="$dir/$dirname.v1.client.ts"
  v2_file="$dir/$dirname.v2.client.ts"

  echo "" >> "$REPORT_FILE"
  echo "Directory: $dirname" >> "$REPORT_FILE"

  # ---- v1 ----
  if [[ -f "$v1_file" ]]; then
    (cd "$dir" && npx ts-node "$dirname.v1.client.ts" > /dev/null 2>&1)
    v1_status=$?
  else
    v1_status=127
  fi

  if [[ $v1_status -eq 0 ]]; then
    echo "  v1: SUCCESS" >> "$REPORT_FILE"
  else
    echo "  v1: FAILED (exit code $v1_status)" >> "$REPORT_FILE"
    ((v1_failures++))
  fi

  # ---- v2 ----
  if [[ -f "$v2_file" ]]; then
    (cd "$dir" && npx ts-node "$dirname.v2.client.ts" > /dev/null 2>&1)
    v2_status=$?
  else
    v2_status=127
  fi

  if [[ $v2_status -eq 0 ]]; then
    echo "  v2: SUCCESS" >> "$REPORT_FILE"
  else
    echo "  v2: FAILED (exit code $v2_status)" >> "$REPORT_FILE"
    ((v2_failures++))
  fi
done

{
  echo ""
  echo "========================================"
  echo "Summary"
  echo "Total directories processed: $total_dirs"
  echo "v1 failures: $v1_failures"
  echo "v2 failures: $v2_failures"
}

echo "Report written to: $REPORT_FILE"

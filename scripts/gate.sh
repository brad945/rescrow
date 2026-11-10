#!/usr/bin/env bash
# Everything that must pass before a commit lands on main.
# Usage: bash scripts/gate.sh [--build]
set -euo pipefail
cd "$(dirname "$0")/.."
npm run lint
npm run typecheck
npm test
npm run format:check
if [[ "${1:-}" == "--build" ]]; then
  npm run build
fi
echo "gate: all checks passed"

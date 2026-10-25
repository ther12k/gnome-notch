#!/usr/bin/env bash
# Redacted secret scan over tracked files (plus staged diff when present).
# Uses gitleaks when installed; otherwise falls back to conservative regexes.
# Prints only file/line numbers — never the matched text.
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

if command -v gitleaks >/dev/null 2>&1; then
    exec gitleaks detect --redact --no-banner -v
fi

echo "gitleaks not found — using built-in regex checks" >&2
PATTERNS='-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{45,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{15,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|https?://[^[[:space:]:@]]+:[^[[:space:]@]]+@|([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}'

hits=0
while IFS= read -r file; do
    while IFS= read -r lineno; do
        [ -n "$lineno" ] || continue
        echo "SECRET-PATTERN at ${file}:${lineno}" >&2
        hits=$((hits + 1))
    done < <(grep -InE "$PATTERNS" -- "$file" 2>/dev/null | cut -d: -f1)
done < <(git ls-files)

if [ "$hits" -gt 0 ]; then
    echo "${hits} suspicious match(es) found — inspect them before committing" >&2
    exit 1
fi
echo "no obvious secrets found" >&2

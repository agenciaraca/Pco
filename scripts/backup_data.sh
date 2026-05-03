#!/usr/bin/env bash
# Backup diário dos arquivos JSON de dados.
# Roda via cron user-space — não precisa sudo.
# Mantém os últimos 14 dias de backup.

set -euo pipefail

DATA_DIR="${DATA_DIR:-$HOME/ava-pco/data}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/ava-pco/data/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ ! -d "$DATA_DIR" ]; then
  echo "[backup] $DATA_DIR não existe — nada a fazer."
  exit 0
fi

TS=$(date -u +%Y-%m-%d_%H-%M-%S)
DEST="$BACKUP_ROOT/$TS"
mkdir -p "$DEST"

# Copia *.json de DATA_DIR (NÃO o subdir backups recursivo)
COUNT=0
for f in "$DATA_DIR"/*.json; do
  [ -f "$f" ] || continue
  cp "$f" "$DEST/"
  COUNT=$((COUNT + 1))
done

if [ "$COUNT" -eq 0 ]; then
  rmdir "$DEST" 2>/dev/null || true
  echo "[backup] $TS - nenhum arquivo JSON encontrado."
  exit 0
fi

# Tar.gz e remove o dir solto
tar -czf "$DEST.tar.gz" -C "$BACKUP_ROOT" "$TS" 2>/dev/null
rm -rf "$DEST"

# Limpa backups antigos
find "$BACKUP_ROOT" -maxdepth 1 -name '*.tar.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

SIZE=$(stat -c%s "$DEST.tar.gz" 2>/dev/null || echo "?")
echo "[backup] $TS - $COUNT files, $SIZE bytes -> $DEST.tar.gz"

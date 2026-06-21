#!/bin/bash
# Backup script for PES Engine
# Runs as cron job inside backup container

set -e

BACKUP_DIR="${BACKUP_PATH:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PROVIDER="${DATABASE_PROVIDER:-sqlite}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PES Engine backup..."

# Backup SQLite database
if [ "$DB_PROVIDER" = "sqlite" ] && [ -f "$SQLITE_DB_PATH" ]; then
    echo "[$(date)] Backing up SQLite database..."
    cp "$SQLITE_DB_PATH" "$BACKUP_DIR/pes-engine-db-$TIMESTAMP.db"
    echo "[$(date)] SQLite backup: pes-engine-db-$TIMESTAMP.db"
fi

# Backup PostgreSQL (if configured)
if [ "$DB_PROVIDER" = "postgresql" ]; then
    echo "[$(date)] Backing up PostgreSQL database..."
    if command -v pg_dump >/dev/null 2>&1; then
        PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/pes-engine-db-$TIMESTAMP.sql" 2>/dev/null || \
        echo "[$(date)] PostgreSQL backup failed"
    else
        echo "[$(date)] pg_dump not available, skipping PostgreSQL backup"
    fi
fi

# Backup uploads directory
if [ -d /app/data/uploads ]; then
    echo "[$(date)] Backing up uploads..."
    tar -czf "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz" -C /app/data uploads 2>/dev/null || \
    echo "[$(date)] Uploads backup skipped"
fi

# Backup spec sheets
if [ -d /app/data/specs ]; then
    echo "[$(date)] Backing up spec sheets..."
    tar -czf "$BACKUP_DIR/specs-$TIMESTAMP.tar.gz" -C /app/data specs 2>/dev/null || \
    echo "[$(date)] Specs backup skipped"
fi

# Cleanup old backups
find "$BACKUP_DIR" -name "pes-engine-db-*.db" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "[$(date)] Backup complete. Files in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR" 2>/dev/null || true

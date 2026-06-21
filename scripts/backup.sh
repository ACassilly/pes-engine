#!/bin/bash
# PES Engine — Backup Script
# Backup database and uploads

set -e

BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="./data/pes-engine.db"
UPLOADS_DIR="./data/uploads"
SPECS_DIR="./data/specs"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "========================================="
echo "PES Engine — Backup Script"
echo "Timestamp: $TIMESTAMP"
echo "========================================="

# Backup SQLite database
if [ -f "$DB_PATH" ]; then
    echo "💾 Backing up database..."
    cp "$DB_PATH" "$BACKUP_DIR/pes-engine-db-$TIMESTAMP.db"
    echo "✅ Database backup: pes-engine-db-$TIMESTAMP.db"
else
    echo "⚠️  SQLite database not found at $DB_PATH"
    
    # Try PostgreSQL backup
    if command -v pg_dump &> /dev/null; then
        echo "💾 Backing up PostgreSQL database..."
        pg_dump -U pes -h localhost pes_engine > "$BACKUP_DIR/pes-engine-db-$TIMESTAMP.sql" 2>/dev/null || \
        echo "⚠️  PostgreSQL backup failed (may not be configured)"
    fi
fi

# Backup uploads
echo "📁 Backing up uploads..."
tar -czf "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz" -C "$UPLOADS_DIR" . 2>/dev/null || echo "⚠️  Uploads backup skipped (empty or not found)"

# Backup specs
if [ -d "$SPECS_DIR" ]; then
    echo "📁 Backing up spec sheets..."
    tar -czf "$BACKUP_DIR/specs-$TIMESTAMP.tar.gz" -C "$SPECS_DIR" . 2>/dev/null || echo "⚠️  Specs backup skipped (empty or not found)"
fi

# Cleanup old backups (keep last 30 days)
echo "🧹 Cleaning up old backups (older than 30 days)..."
find "$BACKUP_DIR" -name "pes-engine-db-*.db" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete 2>/dev/null || true

echo ""
echo "========================================="
echo "✅ Backup complete!"
echo "========================================="
echo "Backup location: $BACKUP_DIR"
ls -lh "$BACKUP_DIR" | tail -5

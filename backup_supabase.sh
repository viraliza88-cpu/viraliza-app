#!/bin/bash
source /var/www/viraliza-app/.env

FECHA=$(date +%Y%m%d_%H%M%S)
CARPETA="/var/www/viraliza-app/backups_privados/supabase"
mkdir -p "$CARPETA"

BASE="$SUPABASE_URL/rest/v1"
AUTH="-H \"apikey: $SUPABASE_SERVICE_ROLE_KEY\" -H \"Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY\""

# Videos (confirmado que funciona)
curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/videos?select=*&limit=10000" \
  -o "$CARPETA/videos_$FECHA.json"

# Perfiles (nombre real de la tabla de usuarios)
curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/perfiles?select=*&limit=10000" \
  -o "$CARPETA/perfiles_$FECHA.json"

# Pagos (nombre real de la tabla de planes/pagos)
curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/pagos?select=*&limit=10000" \
  -o "$CARPETA/pagos_$FECHA.json"

# Membresías
curl -s \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/membresias?select=*&limit=10000" \
  -o "$CARPETA/membresias_$FECHA.json"

# Eliminar backups de más de 30 días
find "$CARPETA" -name "*.json" -mtime +30 -delete

# Verificar tamaños
echo "Backup $FECHA:"
for f in "$CARPETA"/*_$FECHA.json; do
  SIZE=$(wc -c < "$f")
  NAME=$(basename "$f")
  if [ "$SIZE" -lt 50 ]; then
    echo "  WARN - $NAME: posible error ($SIZE bytes)"
  else
    echo "  OK   - $NAME: $SIZE bytes"
  fi
done

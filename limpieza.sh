#!/bin/bash
find /var/www/MoneyPrinterTurbo/storage/tasks -maxdepth 1 -mindepth 1 -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null
find /var/www/MoneyPrinterTurbo/storage/custom_audio -name "*.mp3" -mtime +1 -delete 2>/dev/null
find /var/www/MoneyPrinterTurbo/storage/local_videos -mtime +1 -delete 2>/dev/null
for log in /root/.pm2/logs/*.log; do
  if [ $(stat -c%s "$log" 2>/dev/null || echo 0) -gt 52428800 ]; then
    > "$log"
  fi
done
echo "Limpieza completada: $(date)"
# Limpieza de videos — mantener solo los 15 más recientes por usuario en Supabase
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/var/www/viraliza-app/.env' });
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: usuarios } = await sb.from('perfiles').select('id');
  for (const u of (usuarios || [])) {
    const { data: videos } = await sb.from('videos').select('id,url_video').eq('usuario_id', u.id).order('creado_en', { ascending: false });
    if (!videos || videos.length <= 15) continue;
    const eliminar = videos.slice(15);
    for (const v of eliminar) {
      if (v.url_video) {
        const archivo = v.url_video.replace('https://viralizacol.com', '/var/www/viraliza-app/public');
        if (require('fs').existsSync(archivo)) require('fs').unlinkSync(archivo);
      }
      await sb.from('videos').delete().eq('id', v.id);
    }
    if (eliminar.length > 0) console.log('Eliminados ' + eliminar.length + ' videos viejos de usuario ' + u.id);
  }
})();
" 2>/dev/null || true

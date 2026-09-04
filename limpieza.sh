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

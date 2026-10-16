# Vídeo promocional

El vídeo se pinta con la propia interfaz (`src/app/promo/PromoFilm.tsx`).

1. `npm run build && npx next start -p 3124`
2. Fotogramas (60 fps, 60 s): `python3 scripts/promo/render.py frames 60 0 3600` (Playwright de Python)
3. Sonido: `python3 scripts/promo/audio.py` → `mix.wav`, `music.wav`, `sfx.wav`
4. `ffmpeg -framerate 60 -i frames/f%05d.jpg -i mix.wav -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -af "loudnorm=I=-14:TP=-1.5:LRA=11" -shortest rotafy-promo.mp4`

Para verlo en el navegador sin grabar: `/promo`.

#!/usr/bin/env python3
import sys
import subprocess
from faster_whisper import WhisperModel

FUENTES = {
    "clasica": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Bold.ttf",
    "ligera": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Medium.ttf",
    "elegante": "/var/www/MoneyPrinterTurbo/resource/fonts/Charm-Bold.ttf",
    "moderna": "/var/www/MoneyPrinterTurbo/resource/fonts/UTM Kabel KT.ttf",
    "redondeada": "/var/www/MoneyPrinterTurbo/resource/fonts/Charm-Bold.ttf",
    "viral": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Bold.ttf",
}
FONT_SIZE_ACTIVA = 92
FONT_SIZE_RESTO = 76
PALABRAS_POR_GRUPO = 3

def limpiar(word):
    return word.replace("'", "").replace(":", "").replace("\\", "").replace('"', '').replace('%', '').replace('[','').replace(']','').replace('(','').replace(')','').strip()

def transcribir(audio_path, guion_texto):
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="es",
        initial_prompt=guion_texto if guion_texto else None
    )
    palabras = []
    for seg in segments:
        if seg.words:
            for w in seg.words:
                palabras.append({"word": w.word.strip(), "start": w.start, "end": w.end})
    return palabras

def alinear(palabras_whisper, guion_texto):
    if not guion_texto:
        return palabras_whisper
    palabras_guion = guion_texto.split()
    resultado = []
    for i, p in enumerate(palabras_whisper):
        if i < len(palabras_guion):
            resultado.append({"word": palabras_guion[i], "start": p["start"], "end": p["end"]})
        else:
            resultado.append(p)
    return resultado

def generar_filtro_grupos(palabras, font_path, color_principal):
    """
    Muestra grupos de 3 palabras. La palabra activa va en color principal y grande.
    Las otras dos van en blanco y más pequeñas. Estilo TikTok viral.
    """
    color_hex = color_principal.replace("#", "")
    filtros = []

    # Agrupar palabras de 3 en 3
    grupos = []
    for i in range(0, len(palabras), PALABRAS_POR_GRUPO):
        grupo = palabras[i:i+PALABRAS_POR_GRUPO]
        if grupo:
            grupos.append(grupo)

    for grupo in grupos:
        # El grupo se muestra desde el inicio de la primera palabra hasta el fin de la última
        grupo_start = grupo[0]["start"]
        grupo_end = grupo[-1]["end"]

        # Para cada palabra dentro del grupo, resaltarla cuando es la activa
        for idx_activa, p_activa in enumerate(grupo):
            start_activa = p_activa["start"]
            end_activa = max(p_activa["end"], start_activa + 0.08)

            # Construir el texto del grupo con la palabra activa en mayúsculas
            linea_partes = []
            for idx, p in enumerate(grupo):
                w = limpiar(p["word"])
                if not w:
                    continue
                linea_partes.append(w.upper() if idx == idx_activa else w)

            texto_grupo = " ".join(linea_partes)

            # Fondo semitransparente — línea de texto completo en blanco
            filtro_base = (
                f"drawtext=fontfile='{font_path}'"
                f":text='{texto_grupo}'"
                f":fontcolor=0xFFFFFF"
                f":fontsize={FONT_SIZE_RESTO}"
                f":bordercolor=0x000000"
                f":borderw=5"
                f":x=(w-text_w)/2"
                f":y=h*0.74"
                f":enable='between(t,{start_activa:.3f},{end_activa:.3f})'"
            )
            filtros.append(filtro_base)

            # Palabra activa encima — en color principal y más grande
            w_activa = limpiar(p_activa["word"]).upper()
            if w_activa:
                # Calcular posición X aproximada de la palabra activa
                total_palabras = len(grupo)
                pos_relativa = idx_activa / max(total_palabras - 1, 1) - 0.5  # -0.5 a 0.5
                offset_x = f"(w-text_w)/2+{int(pos_relativa * 120)}"

                filtro_activa = (
                    f"drawtext=fontfile='{font_path}'"
                    f":text='{w_activa}'"
                    f":fontcolor=0x{color_hex}"
                    f":fontsize={FONT_SIZE_ACTIVA}"
                    f":bordercolor=0x000000"
                    f":borderw=6"
                    f":x=(w-text_w)/2"
                    f":y=h*0.725"
                    f":enable='between(t,{start_activa:.3f},{end_activa:.3f})'"
                )
                filtros.append(filtro_activa)

    return ",".join(filtros) if filtros else "null"

def procesar(video_in, audio_in, video_out, color="#FFE500", fuente="clasica", guion=""):
    print(f"[POST] Transcribiendo...")
    palabras = transcribir(audio_in, guion)

    if guion:
        palabras = alinear(palabras, guion)
        print(f"[POST] Alineado con guion: {len(palabras)} palabras")
    else:
        print(f"[POST] {len(palabras)} palabras")

    if not palabras:
        subprocess.run(["cp", video_in, video_out], check=True)
        return

    font_path = FUENTES.get(fuente, FUENTES["clasica"])
    filtro = generar_filtro_grupos(palabras, font_path, color)

    print(f"[POST] Aplicando subtítulos en grupos...")
    cmd = ["ffmpeg", "-y", "-i", video_in, "-vf", filtro,
           "-c:a", "copy", "-c:v", "libx264", "-preset", "fast", "-crf", "22", video_out]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[POST] Error: {result.stderr[-500:]}")
        subprocess.run(["cp", video_in, video_out], check=True)
    else:
        print(f"[POST] OK: {video_out}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: post_process.py <video_in> <audio_in> <video_out> [color] [fuente] [guion]")
        sys.exit(1)
    color = sys.argv[4] if len(sys.argv) > 4 else "#FFE500"
    fuente = sys.argv[5] if len(sys.argv) > 5 else "clasica"
    guion = sys.argv[6] if len(sys.argv) > 6 else ""
    procesar(sys.argv[1], sys.argv[2], sys.argv[3], color, fuente, guion)

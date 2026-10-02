#!/usr/bin/env python3
import sys
import subprocess
import os
from faster_whisper import WhisperModel

FUENTES = {
    "clasica": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Bold.ttf",
    "ligera": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Medium.ttf",
    "elegante": "/var/www/MoneyPrinterTurbo/resource/fonts/Charm-Bold.ttf",
    "moderna": "/var/www/MoneyPrinterTurbo/resource/fonts/UTM Kabel KT.ttf",
    "redondeada": "/var/www/MoneyPrinterTurbo/resource/fonts/Charm-Bold.ttf",
    "viral": "/var/www/MoneyPrinterTurbo/resource/fonts/BeVietnamPro-Bold.ttf",
}
FONT_SIZE = 90

def transcribir_con_guion(audio_path, guion_texto):
    """Transcribe y alinea con el guion para palabras perfectas"""
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

def alinear_con_guion(palabras_whisper, guion_texto):
    """Reemplaza las palabras de whisper con las del guion manteniendo el timing"""
    if not guion_texto:
        return palabras_whisper
    
    palabras_guion = guion_texto.split()
    resultado = []
    
    for i, p in enumerate(palabras_whisper):
        if i < len(palabras_guion):
            resultado.append({
                "word": palabras_guion[i],
                "start": p["start"],
                "end": p["end"]
            })
        else:
            resultado.append(p)
    
    return resultado

def generar_filtro(palabras, font_path, color_principal):
    filtros = []
    color_hex = color_principal.replace("#", "")
    
    for i, p in enumerate(palabras):
        word = p["word"].replace("'", "").replace(":", "").replace("\\", "").replace('"', '').replace('%', '').replace('[','').replace(']','')
        if not word:
            continue
        start = p["start"]
        end = max(p["end"], start + 0.1)
        color = color_hex if i % 2 == 0 else "FFFFFF"
        
        filtro = (
            f"drawtext=fontfile='{font_path}'"
            f":text='{word}'"
            f":fontcolor=0x{color}"
            f":fontsize={FONT_SIZE}"
            f":bordercolor=0x000000"
            f":borderw=5"
            f":x=(w-text_w)/2"
            f":y=h*0.73"
            f":enable='between(t,{start:.3f},{end:.3f})'"
        )
        filtros.append(filtro)
    
    return ",".join(filtros) if filtros else "null"

def procesar(video_in, audio_in, video_out, color="#FFE500", fuente="clasica", guion=""):
    print(f"[POST] Transcribiendo con guion...")
    palabras = transcribir_con_guion(audio_in, guion)
    
    if guion:
        palabras = alinear_con_guion(palabras, guion)
        print(f"[POST] Alineado con guion: {len(palabras)} palabras")
    else:
        print(f"[POST] {len(palabras)} palabras (sin guion)")
    
    if not palabras:
        subprocess.run(["cp", video_in, video_out], check=True)
        return
    
    font_path = FUENTES.get(fuente, FUENTES["clasica"])
    filtro = generar_filtro(palabras, font_path, color)
    
    print(f"[POST] Aplicando subtítulos...")
    cmd = ["ffmpeg", "-y", "-i", video_in, "-vf", filtro,
           "-c:a", "copy", "-c:v", "libx264", "-preset", "fast", "-crf", "22", video_out]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[POST] Error ffmpeg: {result.stderr[-300:]}")
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

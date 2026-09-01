import asyncio
import edge_tts
import sys

async def run():
    voz = sys.argv[1]
    salida = sys.argv[2]
    texto = "Hola, esta es una muestra de mi voz. Con Viraliza produces videos profesionales en minutos."
    c = edge_tts.Communicate(text=texto, voice=voz)
    await c.save(salida)

asyncio.run(run())

# VIRALIZA — Manual de arranque (paso a paso)

Tu plataforma de producción de videos, versión local. Con esto la corres
completa en tu computador: landing, registro, panel privado, producción
y descarga de videos.

---

## Lo que necesitas antes de empezar

1. **Node.js 18 o superior.** Abre PowerShell y escribe: `node -v`
   - Si aparece algo como `v18`, `v20` o `v22`, ya lo tienes.
   - Si sale error, descárgalo de https://nodejs.org (botón verde "LTS"),
     instala con "Siguiente, Siguiente" y vuelve a probar.
2. **El motor encendido.** En tu carpeta
   `MoneyPrinterTurbo-Portable-Windows-1.3.2`, dale doble clic a **`api`**
   (no a `start`). Se abre una ventana negra: **déjala abierta**. Esa
   ventana ES el motor de producción, escuchando en el puerto 8080.

---

## Montaje (solo la primera vez)

1. Descomprime `viraliza-app.zip` donde quieras (por ejemplo en
   `Documentos\viraliza`).
2. Abre esa carpeta en VS Code (clic derecho → "Abrir con Code", o desde
   VS Code: Archivo → Abrir carpeta).
3. Abre la terminal de VS Code (menú Terminal → Nueva terminal) y escribe:

   ```
   npm install
   ```

   Espera a que termine (descarga las dependencias, tarda 1–2 minutos).

4. Copia el archivo de configuración:

   ```
   Copy-Item .env.example .env
   ```

---

## Arrancar la plataforma (cada vez que quieras usarla)

1. Enciende el motor: doble clic a `api` en la carpeta del
   MoneyPrinterTurbo (ventana negra abierta).
2. En la terminal de VS Code:

   ```
   npm start
   ```

3. Abre tu navegador en **http://localhost:3000**

Eso es todo. Verás la landing → "Solicitar acceso" → creas tu cuenta →
entras al panel → escribes un tema → "Producir video" → en 2–5 minutos
aparece "Listo" y lo descargas.

---

## Cosas útiles

- **Cambiar la membresía de un usuario** (mientras montamos los pagos):
  abre `data/db.json`, busca el usuario y cambia `"plan": "inicial"` por
  `"esencial"`, `"signature"` o `"elite"`. Guarda el archivo y listo.
- **Los datos** (cuentas y videos) viven en `data/db.json`. Si borras ese
  archivo, la plataforma arranca en blanco.
- **Configuración** en el archivo `.env`:
  - `PUERTO` — puerto de la plataforma (3000 por defecto)
  - `MOTOR_URL` — dirección del motor (http://127.0.0.1:8080)
  - `JWT_SECRETO` — cámbialo por cualquier frase larga tuya

---

## Si algo falla

| Síntoma | Causa probable | Solución |
|---|---|---|
| "El motor de producción no está disponible" | La ventana de `api` está cerrada | Doble clic a `api` y reintenta |
| `npm install` da error de red | Sin internet o proxy | Verifica tu conexión y reintenta |
| El puerto 3000 está ocupado | Otra app lo usa | Cambia `PUERTO=3001` en `.env` |
| El video queda "Produciendo" mucho tiempo | El motor está renderizando | Normal en videos largos; mira la ventana negra del motor para ver el avance |

---

Hecho en Medellín. Siguiente etapa: subirlo a internet y conectar los pagos.

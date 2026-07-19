// ============================================================
//  VIRALIZA — Servidor principal
//  Plataforma de producción de video · v0.5 (marca de agua plan gratis)
// ============================================================
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const os = require("os");
const FFMPEG_BIN = require("ffmpeg-static");
const MARCA_AGUA_PNG = path.join(__dirname, "public_assets", "marca-agua.png");

// Aplica la marca de agua (solo plan gratis) sobre un archivo de video local.
// Si algo falla, no rompe la descarga: se resuelve con la ruta original.
function aplicarMarcaDeAgua(rutaEntrada) {
  return new Promise((resolve) => {
    const rutaSalida = path.join(os.tmpdir(), `viraliza-marca-${crypto.randomUUID()}.mp4`);
    const proceso = spawn(FFMPEG_BIN, [
      "-y",
      "-i", rutaEntrada,
      "-i", MARCA_AGUA_PNG,
      "-filter_complex", "[0:v][1:v]overlay=W-w-24:H-h-40",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-c:a", "copy",
      rutaSalida,
    ]);
    proceso.on("error", () => resolve(rutaEntrada));
    proceso.on("close", (codigo) => {
      if (codigo === 0 && fs.existsSync(rutaSalida)) resolve(rutaSalida);
      else resolve(rutaEntrada);
    });
  });
}

const PUERTO = process.env.PUERTO || 3000;
const MOTOR_URL = (process.env.MOTOR_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const JWT_SECRETO = process.env.JWT_SECRETO || "viraliza-cambia-esta-clave";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODELO = process.env.GROQ_MODELO || "llama-3.3-70b-versatile";

// ---------- Redacción propia: guion natural + palabras clave reales ----------
const PALABRAS_POR_DURACION = {
  corto: 65,
  medio: 130,
  largo: 195,
};

async function preguntarGroq(mensajes) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: GROQ_MODELO, temperature: 0.7, messages: mensajes }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "El redactor no respondió.");
  return j.choices?.[0]?.message?.content?.trim() || "";
}

async function redactarGuion(tema, duracion) {
  const palabras = PALABRAS_POR_DURACION[duracion] || PALABRAS_POR_DURACION.corto;
  const texto = await preguntarGroq([
    {
      role: "system",
      content:
        "Escribes guiones para video corto vertical (TikTok/Reels) en español neutro latino. " +
        "Suenan a una persona hablando de verdad, no a un texto leído: frases cortas, " +
        "contracciones naturales, sin tecnicismos de redacción, sin listas ni signos raros. " +
        "Arrancas con un gancho fuerte en la primera frase. Nada de introducciones tipo " +
        "'hoy les voy a hablar de'. REGLA ABSOLUTA: el guion completo va 100% en español. " +
        "Nunca uses una sola palabra en inglés, ni siquiera nombres de conceptos técnicos: " +
        "tradúcelos siempre. Solo devuelves el guion, sin comillas ni explicaciones.",
    },
    {
      role: "user",
      content: `Tema: "${tema}". Extensión objetivo: ${palabras} palabras, ni más ni menos. Recuerda: todo en español, ni una sola palabra en inglés.`,
    },
  ]);
  return texto.replace(/^["']|["']$/g, "").trim();
}

const PALABRAS_INGLES_SOSPECHOSAS = /\b(nothing|something|everything|the|and|with|about|because|today|business|money|people|life)\b/i;

async function redactarGuionSeguro(tema, duracion) {
  for (let intento = 0; intento < 2; intento++) {
    const guion = await redactarGuion(tema, duracion);
    if (!PALABRAS_INGLES_SOSPECHOSAS.test(guion)) return guion;
    console.warn("Guion con palabras en inglés detectadas, reintentando…");
  }
  return redactarGuion(tema, duracion);
}

async function redactarPalabrasClave(tema, guion) {
  const texto = await preguntarGroq([
    {
      role: "system",
      content:
        "Generas términos de búsqueda en inglés para un banco de video de fotografía y video " +
        "REAL (no animación, no renders 3D, no ilustraciones, no íconos, nada simbólico ni " +
        "festivo ni artístico). REGLA CLAVE: cada término debe corresponder a un objeto, lugar, " +
        "persona o acción que esté literalmente mencionado o directamente implicado por el guion " +
        "que te paso. Prohibido inventar escenas que no tengan relación directa con el tema " +
        "(nada de 'memories', 'tradition', 'celebration', 'family archive' salvo que el guion " +
        "hable exactamente de eso). Si el tema es de dinero, trámites o negocios, usa términos " +
        "como 'office desk', 'paperwork', 'calculator', 'laptop typing', 'money cash', " +
        "'signing document', 'receipts', según corresponda al contenido real. " +
        "Responde solo con 5 términos cortos separados por coma, en inglés, sin numerar.",
    },
    { role: "user", content: `Tema: "${tema}"\nGuion: "${guion}"` },
  ]);
  return texto.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5);
}

// ---------- Membresías y cuotas mensuales ----------
const PLANES = {
  inicial:   { nombre: "Inicial",   limite: 2,   sello: true  },
  esencial:  { nombre: "Esencial",  limite: 15,  sello: false },
  signature: { nombre: "Signature", limite: 50,  sello: false },
  elite:     { nombre: "Élite",     limite: 150, sello: false },
};

// ---------- Base de datos simple en archivo ----------
const RUTA_DATOS = path.join(__dirname, "data");
const RUTA_DB = path.join(RUTA_DATOS, "db.json");
if (!fs.existsSync(RUTA_DATOS)) fs.mkdirSync(RUTA_DATOS, { recursive: true });
if (!fs.existsSync(RUTA_DB)) fs.writeFileSync(RUTA_DB, JSON.stringify({ usuarios: [], videos: [] }, null, 2));

function leerDB() {
  if (!fs.existsSync(RUTA_DB)) {
    if (!fs.existsSync(RUTA_DATOS)) fs.mkdirSync(RUTA_DATOS, { recursive: true });
    fs.writeFileSync(RUTA_DB, JSON.stringify({ usuarios: [], videos: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(RUTA_DB, "utf-8"));
}
function guardarDB(db) {
  fs.writeFileSync(RUTA_DB, JSON.stringify(db, null, 2));
}
function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Autenticación ----------
function crearToken(usuario) {
  return jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRETO, { expiresIn: "30d" });
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.t || "");
  if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });
  try {
    const datos = jwt.verify(token, JWT_SECRETO);
    const db = leerDB();
    const usuario = db.usuarios.find((u) => u.id === datos.id);
    if (!usuario) return res.status(401).json({ error: "Tu sesión ya no es válida. Inicia sesión de nuevo." });
    req.usuario = usuario;
    next();
  } catch {
    return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
}

function cuotaDe(usuario, db) {
  const plan = PLANES[usuario.plan] || PLANES.inicial;
  const usados = db.videos.filter(
    (v) => v.usuarioId === usuario.id && v.mes === mesActual() && v.estado !== "fallido"
  ).length;
  return { usados, limite: plan.limite, plan: plan.nombre };
}

// ---------- API: cuentas ----------
app.post("/api/registro", async (req, res) => {
  const { nombre, email, clave } = req.body || {};
  if (!nombre || !email || !clave) return res.status(400).json({ error: "Completa nombre, correo y contraseña." });
  if (String(clave).length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
  const correo = String(email).trim().toLowerCase();
  const db = leerDB();
  if (db.usuarios.some((u) => u.email === correo)) {
    return res.status(409).json({ error: "Ya existe una cuenta con este correo. Inicia sesión." });
  }
  const usuario = {
    id: crypto.randomUUID(),
    nombre: String(nombre).trim(),
    email: correo,
    hash: await bcrypt.hash(String(clave), 10),
    plan: "inicial",
    creado: new Date().toISOString(),
  };
  db.usuarios.push(usuario);
  guardarDB(db);
  res.json({ token: crearToken(usuario), nombre: usuario.nombre });
});

app.post("/api/login", async (req, res) => {
  const { email, clave } = req.body || {};
  const db = leerDB();
  const usuario = db.usuarios.find((u) => u.email === String(email || "").trim().toLowerCase());
  if (!usuario || !(await bcrypt.compare(String(clave || ""), usuario.hash))) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  res.json({ token: crearToken(usuario), nombre: usuario.nombre });
});

app.get("/api/yo", autenticar, (req, res) => {
  const db = leerDB();
  res.json({
    nombre: req.usuario.nombre,
    email: req.usuario.email,
    plan: req.usuario.plan,
    cuota: cuotaDe(req.usuario, db),
  });
});

// ---------- API: producción de videos ----------
const DURACIONES = {
  corto: { etiqueta: "Corto (~30 s)" },
  medio: { etiqueta: "Medio (~60 s)" },
  largo: { etiqueta: "Largo (~90 s)" },
};

app.post("/api/guion", autenticar, async (req, res) => {
  const { tema, duracion } = req.body || {};
  if (!tema || String(tema).trim().length < 5) {
    return res.status(400).json({ error: "Escribe el tema de tu video (mínimo 5 caracteres)." });
  }
  try {
    const guion = await redactarGuionSeguro(String(tema).trim(), duracion);
    const terminos = await redactarPalabrasClave(String(tema).trim(), guion);
    res.json({ guion, terminos });
  } catch (e) {
    console.error("Error redactando con Groq:", e.message);
    res.status(502).json({
      error: "No pudimos redactar el guion en este momento. Verifica la clave de Groq en tu configuración e inténtalo de nuevo.",
    });
  }
});

app.post("/api/videos", autenticar, async (req, res) => {
  const { tema, guion, terminos, voz, duracion } = req.body || {};
  if (!tema || String(tema).trim().length < 5) {
    return res.status(400).json({ error: "Escribe el tema de tu video (mínimo 5 caracteres)." });
  }
  const db = leerDB();
  const cuota = cuotaDe(req.usuario, db);
  if (cuota.usados >= cuota.limite) {
    return res.status(402).json({
      error: `Alcanzaste el límite de tu membresía ${cuota.plan} (${cuota.limite} videos este mes). Sube de nivel para seguir produciendo.`,
    });
  }
  const dur = DURACIONES[duracion] || DURACIONES.corto;

  let guionFinal = String(guion || "").trim();
  let terminosFinales = Array.isArray(terminos) ? terminos.filter(Boolean) : [];
  try {
    if (!guionFinal) guionFinal = await redactarGuionSeguro(tema, duracion);
    if (!terminosFinales.length) terminosFinales = await redactarPalabrasClave(tema, guionFinal);
  } catch (e) {
    console.error("Error redactando con Groq:", e.message);
    return res.status(502).json({
      error: "No pudimos redactar el guion en este momento. Verifica la clave de Groq en tu configuración e inténtalo de nuevo.",
    });
  }

  const carga = {
    video_subject: String(tema).trim(),
    video_script: guionFinal,
    video_terms: terminosFinales,
    video_aspect: "9:16",
    video_concat_mode: "random",
    video_transition_mode: "FadeOut",
    video_clip_duration: 3,
    video_count: 1,
    video_source: "pexels",
    video_language: "es",
    voice_name: voz || "es-CO-SalomeNeural-Female",
    voice_rate: 0.98,
    voice_volume: 1.0,
    bgm_type: "random",
    bgm_volume: 0.2,
    subtitle_enabled: true,
    font_name: "BeVietnamPro-Bold.ttf",
    font_size: 84,
    text_color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 3.2,
    subtitle_position: "bottom",
  };

  let respuesta;
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(carga),
    });
    respuesta = await r.json();
    if (!r.ok || !respuesta?.data?.task_id) throw new Error(JSON.stringify(respuesta));
  } catch (e) {
    console.error("Error hablando con el motor:", e.message);
    return res.status(502).json({
      error: "El motor de producción no está disponible. Verifica que la ventana del motor (api) esté abierta e inténtalo de nuevo.",
    });
  }

  const video = {
    id: crypto.randomUUID(),
    usuarioId: req.usuario.id,
    tema: carga.video_subject,
    voz: carga.voice_name,
    duracion: dur.etiqueta,
    taskId: respuesta.data.task_id,
    estado: "produciendo",
    progreso: 0,
    urls: [],
    mes: mesActual(),
    creado: new Date().toISOString(),
  };
  db.videos.push(video);
  guardarDB(db);
  res.json({ ok: true, video });
});

// Consulta el estado en el motor y lo sincroniza
async function sincronizarVideo(video) {
  if (video.estado === "listo" || video.estado === "fallido") return video;
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/tasks/${video.taskId}`);
    const j = await r.json();
    const tarea = j?.data;
    if (!tarea) return video;
    if (tarea.state === 1) {
      video.estado = "listo";
      video.progreso = 100;
      video.urls = tarea.videos || [];
    } else if (tarea.state === -1) {
      video.estado = "fallido";
    } else {
      video.progreso = Math.round(tarea.progress || 0);
    }
  } catch {
    /* motor apagado: se mantiene el último estado conocido */
  }
  return video;
}

app.get("/api/videos", autenticar, async (req, res) => {
  const db = leerDB();
  const mios = db.videos.filter((v) => v.usuarioId === req.usuario.id);
  for (const v of mios) await sincronizarVideo(v);
  guardarDB(db);
  mios.sort((a, b) => (a.creado < b.creado ? 1 : -1));
  res.json({ videos: mios, cuota: cuotaDe(req.usuario, db) });
});

app.get("/api/videos/:id/descargar", autenticar, async (req, res) => {
  const db = leerDB();
  const video = db.videos.find((v) => v.id === req.params.id && v.usuarioId === req.usuario.id);
  if (!video) return res.status(404).json({ error: "Este video no existe en tu cuenta." });
  await sincronizarVideo(video);
  guardarDB(db);
  if (video.estado !== "listo" || !video.urls.length) {
    return res.status(409).json({ error: "Tu video aún está en producción. Vuelve en un momento." });
  }
  try {
    const ruta = video.urls[0];
    const url = ruta.startsWith("http") ? ruta : `${MOTOR_URL}${ruta.startsWith("/") ? "" : "/"}${ruta}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("no disponible");

    // Se guarda primero en disco: el filtro de marca de agua necesita un archivo real, no un flujo.
    const rutaTemporal = path.join(os.tmpdir(), `viraliza-origen-${crypto.randomUUID()}.mp4`);
    fs.writeFileSync(rutaTemporal, Buffer.from(await r.arrayBuffer()));

    const esGratis = (req.usuario.plan || "inicial") === "inicial";
    const rutaFinal = esGratis ? await aplicarMarcaDeAgua(rutaTemporal) : rutaTemporal;

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="viraliza-${video.id.slice(0, 8)}.mp4"`);
    const lector = fs.createReadStream(rutaFinal);
    lector.pipe(res);
    lector.on("close", () => {
      fs.unlink(rutaTemporal, () => {});
      if (rutaFinal !== rutaTemporal) fs.unlink(rutaFinal, () => {});
    });
  } catch {
    res.status(502).json({ error: "No pudimos traer el archivo del motor. Verifica que el motor esté encendido." });
  }
});

// ---------- Arranque ----------
app.listen(PUERTO, () => {
  console.log("——————————————————————————————————————");
  console.log(`  VIRALIZA · corriendo en http://localhost:${PUERTO}`);
  console.log(`  Motor de producción: ${MOTOR_URL}`);
  console.log("——————————————————————————————————————");
});
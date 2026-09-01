// ============================================================
//  VIRALIZA — Servidor principal
//  Plataforma de producción de video · v1.0 (con Supabase)
// ============================================================
require("dotenv").config();
process.on("unhandledRejection", (err) => {
  console.error("ERROR NO ATRAPADO (el servidor sigue en pie):", err?.message || err);
});
process.on("uncaughtException", (err) => {
  console.error("ERROR CRÍTICO NO ATRAPADO (el servidor sigue en pie):", err?.message || err);
});

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const os = require("os");
const FFMPEG_BIN = require("ffmpeg-static");
const { createClient } = require("@supabase/supabase-js");
const busboy = require("busboy");
global.WebSocket = require("ws");

const MARCA_AGUA_PNG = path.join(__dirname, "public_assets", "marca-agua.png");
const PUERTO = process.env.PUERTO || 3000;
const MOTOR_URL = (process.env.MOTOR_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODELO = process.env.GROQ_MODELO || "openai/gpt-oss-120b";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const WOMPI_ENTORNO = process.env.WOMPI_ENTORNO || "sandbox";
const WOMPI_API_BASE = WOMPI_ENTORNO === "produccion" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1";
const WOMPI_LLAVE_PUBLICA = process.env.WOMPI_LLAVE_PUBLICA || "";
const WOMPI_SECRETO_INTEGRIDAD = process.env.WOMPI_SECRETO_INTEGRIDAD || "";
const SITIO_URL = process.env.SITIO_URL || "http://localhost:3000";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_REMITENTE = process.env.RESEND_REMITENTE || "Viraliza <onboarding@resend.dev>";

const UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY || "";
const UPLOAD_POST_BASE = "https://api.upload-post.com/api";

async function asegurarPerfilUploadPost(usuarioId) {
  await fetch(`${UPLOAD_POST_BASE}/uploadposts/users`, {
    method: "POST",
    headers: { Authorization: `Apikey ${UPLOAD_POST_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ username: usuarioId }),
  }).catch(() => {});
}

async function avisarVideoListo(video) {
  if (!RESEND_API_KEY) return;
  try {
    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(video.usuario_id);
    const email = usuario?.user?.email;
    if (!email) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: RESEND_REMITENTE,
        to: email,
        subject: "Tu video ya está listo",
        html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;background:#0C0C0E;color:#EDEAE2">
          <h1 style="font-size:22px;margin-bottom:6px">Viraliza<span style="color:#D6B25E">.</span></h1>
          <p style="color:#9B968B;font-size:14px;letter-spacing:1px;text-transform:uppercase;margin-bottom:24px">Tu producción está lista</p>
          <p style="font-size:17px;margin-bottom:20px">"<strong>${video.tema}</strong>" ya terminó de producirse y te está esperando en tu panel.</p>
          <a href="${SITIO_URL}/panel.html" style="display:inline-block;background:#D6B25E;color:#141209;padding:14px 26px;text-decoration:none;font-size:13px;letter-spacing:2px;text-transform:uppercase">Ver mi video</a>
        </div>`,
      }),
    });
  } catch (e) {
    console.error("Error enviando correo de aviso:", e.message);
  }
}

function firmaIntegridadWompi(referencia, montoEnCentavos, moneda) {
  const cadena = `${referencia}${montoEnCentavos}${moneda}${WOMPI_SECRETO_INTEGRIDAD}`;
  return crypto.createHash("sha256").update(cadena).digest("hex");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function aplicarMarcaDeAgua(rutaEntrada) {
  return new Promise((resolve) => {
    const rutaSalida = path.join(os.tmpdir(), `viraliza-marca-${crypto.randomUUID()}.mp4`);
    const proceso = spawn(FFMPEG_BIN, [
      "-y", "-i", rutaEntrada, "-i", MARCA_AGUA_PNG,
      "-filter_complex", "[0:v][1:v]overlay=W-w-24:H-h-40",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "copy",
      rutaSalida,
    ]);
    proceso.on("error", () => resolve(rutaEntrada));
    proceso.on("close", (codigo) => {
      resolve(codigo === 0 && fs.existsSync(rutaSalida) ? rutaSalida : rutaEntrada);
    });
  });
}

const PALABRAS_POR_DURACION = { corto: 65, medio: 130, largo: 195 };

async function preguntarGroq(mensajes) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
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
        "Eres el mejor guionista de videos virales para TikTok, Reels e Instagram en Colombia y Latinoamérica. " +
        "Escribes guiones que atrapan desde el primer segundo y hacen que la gente no pueda dejar de ver. " +
        "ESTRUCTURA OBLIGATORIA: " +
        "1. GANCHO (primeras 2 frases): Una pregunta provocadora, dato sorprendente o afirmación controversial que enganche INMEDIATAMENTE. Nunca empieces con 'hoy', 'en este video', 'les voy a hablar'. " +
        "2. DESARROLLO: Entrega el valor prometido en el gancho. Frases cortas. Ritmo rápido. Una idea por frase. " +
        "3. CIERRE: Llamada a la acción clara o reflexión poderosa que genere comentarios o guardados. " +
        "REGLAS DE ORO: " +
        "- Habla como un colombiano real, no como un locutor. Usa 'bacano', 'chimba', 'parcero' solo si el tema lo pide. " +
        "- Frases de máximo 10 palabras. El cerebro procesa mejor frases cortas. " +
        "- Cada frase debe ser más interesante que la anterior. " +
        "- Cero palabras de relleno: 'básicamente', 'literalmente', 'o sea'. " +
        "- 100% en español. Cero anglicismos innecesarios. " +
        "- El guion debe sonar EXACTAMENTE como lo diría una persona real frente a la cámara. " +
        "Solo devuelves el guion listo para leer, sin títulos, sin comillas, sin explicaciones.",
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
        "Eres un experto en producción de video viral para redes sociales. " +
        "Tu tarea es generar términos de búsqueda en inglés MUY ESPECÍFICOS para encontrar " +
        "video stock REAL y PROFESIONAL que coincida exactamente con el tema del video. " +
        "REGLAS ESTRICTAS: " +
        "1. Cada término debe describir una escena VISUAL CONCRETA y ESPECÍFICA que aparezca en el guion. " +
        "2. Si el tema es espiritual o religioso (Ganesha, Buda, meditación), usa términos como " +
        "'hindu temple ritual', 'incense meditation', 'sacred ceremony india', 'devotional prayer'. " +
        "3. Si es de negocios: 'entrepreneur working laptop', 'business meeting colombia', 'startup office'. " +
        "4. Si es de comida: el plato específico, 'chef cooking restaurant', 'food preparation'. " +
        "5. Si es de fitness: el ejercicio específico, 'gym workout', 'running outdoor'. " +
        "6. Si es de tecnología: el dispositivo o app específica, 'smartphone app', 'coding computer'. " +
        "7. NUNCA uses términos genéricos como 'people', 'nature', 'city', 'background', 'abstract'. " +
        "8. NUNCA uses animaciones, ilustraciones o renders 3D. " +
        "9. Entrega los términos EN ORDEN NARRATIVO siguiendo el guion de principio a fin. " +
        "10. Cada término debe ser en inglés, específico y buscable en Pexels o Pixabay. " +
        "Responde SOLO con 8 términos separados por coma, sin numeración, sin explicaciones.",
    },
    { role: "user", content: `Tema: "${tema}"\nGuion completo: "${guion}"` },
  ]);
  return texto.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
}

const PLANES = {
  inicial:   { nombre: "Inicial",   limite: 2,   sello: true,  precioCOP: 0      },
  esencial:  { nombre: "Esencial",  limite: 15,  sello: false, precioCOP: 39900  },
  signature: { nombre: "Signature", limite: 50,  sello: false, precioCOP: 89900  },
  elite:     { nombre: "Élite",     limite: 150, sello: false, precioCOP: 199900 },
};

function mesActual() {
  return new Date().toISOString().slice(0, 7);
}

async function cuotaDe(usuarioId, plan) {
  const infoPlan = PLANES[plan] || PLANES.inicial;
  const { count } = await supabaseAdmin
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .eq("mes", mesActual())
    .neq("estado", "fallido");
  return { usados: count || 0, limite: infoPlan.limite, plan: infoPlan.nombre };
}

async function planEfectivo(perfil) {
  if (!perfil) return "inicial";
  const vencida = perfil.plan && perfil.plan !== "inicial" && perfil.plan_expira && new Date(perfil.plan_expira) < new Date();
  if (vencida) {
    await supabaseAdmin.from("perfiles").update({ plan: "inicial", plan_expira: null }).eq("id", perfil.id);
    return "inicial";
  }
  return perfil.plan || "inicial";
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const CACHE_SESIONES = new Map();
const DURACION_CACHE_MS = 5 * 60 * 1000;

async function autenticar(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.t || "");
  if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });

  const cacheada = CACHE_SESIONES.get(token);
  if (cacheada && cacheada.expira > Date.now()) {
    req.usuario = cacheada.usuario;
    return next();
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    CACHE_SESIONES.delete(token);
    return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
  req.usuario = {
    id: data.user.id,
    email: data.user.email,
    nombre: data.user.user_metadata?.nombre || "",
  };
  CACHE_SESIONES.set(token, { usuario: req.usuario, expira: Date.now() + DURACION_CACHE_MS });
  next();
}

const MOTOR_CARPETA = process.env.MOTOR_CARPETA || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || "";

const ANIMOS_MUSICA = {
  alegre: "happy",
  energica: "energetic",
  corporativa: "corporate",
  motivacional: "uplifting",
  cinematica: "epic",
  calmada: "relaxing",
};

app.get("/api/musicas/premium", autenticar, async (req, res) => {
  if (!JAMENDO_CLIENT_ID) return res.json({ pistas: [], aviso: "sin_configurar" });
  const etiqueta = ANIMOS_MUSICA[req.query.animo];
  if (!etiqueta) return res.status(400).json({ error: "Ánimo no reconocido." });
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&tags=${etiqueta}&limit=12&audioformat=mp31&order=popularity_total`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j?.headers?.status !== "success") {
      console.error("Jamendo respondió con error:", JSON.stringify(j?.headers || j));
      return res.json({ pistas: [], aviso: "error_jamendo" });
    }
    const pistas = (j?.results || []).map((t) => ({
      id: t.id,
      nombre: t.name,
      artista: t.artist_name,
      muestra: t.audio,
    })).filter((p) => p.muestra);
    res.json({ pistas });
  } catch (e) {
    console.error("Error buscando música premium:", e.message);
    res.json({ pistas: [], aviso: "error_red" });
  }
});

app.post("/api/galeria/buscar", autenticar, async (req, res) => {
  if (!PEXELS_API_KEY) return res.status(500).json({ error: "Falta configurar PEXELS_API_KEY en .env" });
  const { terminos, orientacion } = req.body || {};
  const lista = Array.isArray(terminos) ? terminos.filter(Boolean) : [];
  if (!lista.length) return res.json({ resultados: [] });

  const orient = orientacion === "16:9" ? "landscape" : orientacion === "1:1" ? "square" : "portrait";
  const resultados = [];
  for (const termino of lista.slice(0, 4)) {
    try {
      const r = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(termino)}&per_page=6&orientation=${orient}`,
        { headers: { Authorization: PEXELS_API_KEY }, signal: AbortSignal.timeout(8000) }
      );
      const j = await r.json();
      (j?.videos || []).forEach((v) => {
        const archivo = (v.video_files || []).find((f) => f.quality === "hd") || v.video_files?.[0];
        if (archivo) {
          resultados.push({ id: String(v.id), miniatura: v.image, url: archivo.link, termino });
        }
      });
    } catch (e) {
      console.error(`Error buscando "${termino}" en la galería:`, e.message);
    }
  }
  res.json({ resultados });
});

app.post("/api/galeria/elegir", autenticar, async (req, res) => {
  const { urls } = req.body || {};
  const lista = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!lista.length) return res.json({ archivos: [] });

  const archivos = [];
  try {
    for (const url of lista.slice(0, 12)) {
      const rOrigen = await fetch(url);
      if (!rOrigen.ok) continue;
      const bytes = await rOrigen.arrayBuffer();
      const formData = new FormData();
      formData.append("file", new Blob([bytes], { type: "video/mp4" }), `galeria-${crypto.randomUUID()}.mp4`);
      const rMotor = await fetch(`${MOTOR_URL}/api/v1/video_materials`, { method: "POST", body: formData });
      const j = await rMotor.json();
      if (rMotor.ok && j?.data?.file) archivos.push(j.data.file);
    }
    res.json({ archivos });
  } catch (e) {
    console.error("Error descargando de la galería:", e.message);
    res.status(502).json({ error: "No pudimos preparar las imágenes elegidas." });
  }
});

app.get("/api/voces-premium", autenticar, async (req, res) => {
  if (!ELEVENLABS_API_KEY) return res.json({ voces: [] });
  try {
    const r = await fetch("https://api.elevenlabs.io/v2/voices?page_size=30", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
    const j = await r.json();
    const voces = (j?.voices || []).map((v) => ({
      id: v.voice_id,
      nombre: v.name,
      muestra: v.preview_url || "",
      idioma: v.labels?.language || "",
      acento: v.labels?.accent || "",
    }));
    res.json({ voces });
  } catch (e) {
    console.error("Error listando voces premium:", e.message);
    res.json({ voces: [] });
  }
});

app.get("/api/musicas/:archivo/escuchar", autenticar, (req, res) => {
  if (!MOTOR_CARPETA) return res.status(500).json({ error: "Falta configurar MOTOR_CARPETA en .env" });
  const archivo = path.basename(req.params.archivo);
  const rutasPosibles = [
    path.join(MOTOR_CARPETA, "resource", "songs", archivo),
    path.join(MOTOR_CARPETA, "storage", "bgm", archivo),
  ];
  const rutaReal = rutasPosibles.find((r) => fs.existsSync(r));
  if (!rutaReal) return res.status(404).json({ error: "No encontramos esa canción." });
  res.setHeader("Content-Type", "audio/mpeg");
  fs.createReadStream(rutaReal).pipe(res);
});

app.get("/api/musicas", autenticar, async (req, res) => {
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/musics`);
    const j = await r.json();
    const archivos = j?.data?.files || [];
    const propias = archivos.filter((a) => {
      const nombre = a.file || a.name || a;
      return !/^output\d+\.mp3$/i.test(nombre);
    });
    const { data: nombresGuardados } = await supabaseAdmin
      .from("musica_subida").select("archivo, nombre").eq("usuario_id", req.usuario.id);
    const mapaNombres = Object.fromEntries((nombresGuardados || []).map((n) => [n.archivo, n.nombre]));
    const propiasConNombre = propias.map((a) => {
      const archivo = a.file || a.name || a;
      return { file: archivo, name: mapaNombres[archivo] || archivo };
    });
    res.json({ propias: propiasConNombre });
  } catch (e) {
    console.error("Error listando música:", e.message);
    res.status(502).json({ error: "No pudimos cargar las canciones disponibles." });
  }
});

app.post("/api/musicas", autenticar, async (req, res) => {
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/musics`, {
      method: "POST",
      headers: { "Content-Type": req.headers["content-type"] || "" },
      body: req,
      duplex: "half",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    const archivo = j?.data?.file;
    const nombreOriginal = String(req.query.nombre || archivo).slice(0, 200);
    await supabaseAdmin.from("musica_subida").insert({
      usuario_id: req.usuario.id, archivo, nombre: nombreOriginal,
    });
    res.json({ archivo });
  } catch (e) {
    console.error("Error subiendo música:", e.message);
    res.status(502).json({ error: "No pudimos subir tu canción. Verifica el formato (MP3, WAV, M4A) y el tamaño (máx. 30 MB)." });
  }
});

app.delete("/api/musicas/:archivo", autenticar, async (req, res) => {
  if (!MOTOR_CARPETA) return res.status(500).json({ error: "Falta configurar MOTOR_CARPETA en .env" });
  const archivo = path.basename(req.params.archivo);
  const ruta = path.join(MOTOR_CARPETA, "storage", "bgm", archivo);
  try {
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
    await supabaseAdmin.from("musica_subida").delete().eq("archivo", archivo).eq("usuario_id", req.usuario.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error eliminando canción:", e.message);
    res.status(500).json({ error: "No pudimos eliminar la canción." });
  }
});

app.get("/api/materiales", autenticar, async (req, res) => {
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/video_materials`);
    const j = await r.json();
    res.json({ archivos: j?.data?.files || [] });
  } catch (e) {
    console.error("Error listando materiales:", e.message);
    res.status(502).json({ error: "No pudimos cargar tus materiales." });
  }
});

app.post("/api/materiales", autenticar, async (req, res) => {
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/video_materials`, {
      method: "POST",
      headers: { "Content-Type": req.headers["content-type"] || "" },
      body: req,
      duplex: "half",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    res.json({ archivo: j?.data?.file });
  } catch (e) {
    console.error("Error subiendo material:", e.message);
    res.status(502).json({ error: "No pudimos subir tu archivo. Formatos aceptados: JPG, PNG, MP4, MOV, AVI, MKV." });
  }
});

app.delete("/api/materiales/:archivo", autenticar, (req, res) => {
  if (!MOTOR_CARPETA) return res.status(500).json({ error: "Falta configurar MOTOR_CARPETA en .env" });
  const archivo = path.basename(req.params.archivo);
  const ruta = path.join(MOTOR_CARPETA, "storage", "local_videos", archivo);
  if (!fs.existsSync(ruta)) return res.status(404).json({ error: "Ese archivo ya no existe." });
  try {
    fs.unlinkSync(ruta);
    res.json({ ok: true });
  } catch (e) {
    console.error("Error eliminando material:", e.message);
    res.status(500).json({ error: "No pudimos eliminar el archivo." });
  }
});

app.post("/api/narracion", autenticar, (req, res) => {
  if (!MOTOR_CARPETA) return res.status(500).json({ error: "Falta configurar MOTOR_CARPETA en .env" });
  const carpetaDestino = path.join(MOTOR_CARPETA, "storage", "custom_audio");
  fs.mkdirSync(carpetaDestino, { recursive: true });
  const nombreArchivo = `${crypto.randomUUID()}.mp3`;
  const rutaDestino = path.join(carpetaDestino, nombreArchivo);

  const bb = busboy({ headers: req.headers });
  let recibioArchivo = false;
  let escrituraTerminada = false;
  let yaRespondio = false;

  function responderCuandoListo() {
    if (yaRespondio) return;
    if (!recibioArchivo) {
      yaRespondio = true;
      return res.status(400).json({ error: "No recibimos ningún archivo de audio." });
    }
    if (!escrituraTerminada) return;
    yaRespondio = true;
    res.json({ archivo: rutaDestino });
  }

  bb.on("file", (nombreCampo, stream) => {
    recibioArchivo = true;
    const escritura = fs.createWriteStream(rutaDestino);
    stream.pipe(escritura);
    escritura.on("finish", () => {
      escrituraTerminada = true;
      responderCuandoListo();
    });
  });
  bb.on("error", (e) => {
    console.error("Error subiendo narración:", e.message);
    if (!res.headersSent) res.status(502).json({ error: "No pudimos guardar tu narración. Verifica que sea un archivo de audio válido." });
  });
  bb.on("close", responderCuandoListo);
  req.pipe(bb);
});

app.get("/api/planes", (req, res) => {
  const lista = Object.entries(PLANES)
    .filter(([clave]) => clave !== "inicial")
    .map(([clave, p]) => ({ clave, nombre: p.nombre, limite: p.limite, precioCOP: p.precioCOP }));
  res.json({ planes: lista });
});

app.post("/api/pagos/iniciar", autenticar, async (req, res) => {
  const { plan } = req.body || {};
  const infoPlan = PLANES[plan];
  if (!infoPlan || plan === "inicial") {
    return res.status(400).json({ error: "Elige una membresía válida." });
  }
  const referencia = `viraliza-${crypto.randomUUID()}`;
  const montoEnCentavos = infoPlan.precioCOP * 100;
  const firma = firmaIntegridadWompi(referencia, montoEnCentavos, "COP");

  await supabaseAdmin.from("pagos").insert({
    referencia, usuario_id: req.usuario.id, plan, monto_cop: infoPlan.precioCOP, estado: "pendiente",
  });

  res.json({
    llavePublica: WOMPI_LLAVE_PUBLICA,
    referencia,
    montoEnCentavos,
    moneda: "COP",
    firma,
    urlRedireccion: `${SITIO_URL}/pago-completado.html`,
    entorno: WOMPI_ENTORNO,
  });
});

async function consultarTransaccionWompi(idTransaccion) {
  const r = await fetch(`${WOMPI_API_BASE}/transactions/${idTransaccion}`);
  const j = await r.json();
  return j?.data;
}

async function aplicarPlanDesdeReferencia(referencia, estadoTransaccion) {
  const { data: pago } = await supabaseAdmin.from("pagos").select("*").eq("referencia", referencia).single();
  if (!pago) return { ok: false, motivo: "referencia no encontrada" };
  if (pago.estado === "aprobado") return { ok: true, plan: pago.plan, yaAplicado: true };
  if (estadoTransaccion !== "APPROVED") {
    await supabaseAdmin.from("pagos").update({ estado: "rechazado" }).eq("referencia", referencia);
    return { ok: false, motivo: "no aprobada" };
  }

  const expira = new Date();
  expira.setDate(expira.getDate() + 30);
  await supabaseAdmin.from("perfiles").update({ plan: pago.plan, plan_expira: expira.toISOString() }).eq("id", pago.usuario_id);
  await supabaseAdmin.from("pagos").update({ estado: "aprobado" }).eq("referencia", referencia);
  return { ok: true, usuarioId: pago.usuario_id, plan: pago.plan };
}

app.get("/api/pagos/confirmar", autenticar, async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Falta el identificador de la transacción." });
  try {
    const transaccion = await consultarTransaccionWompi(id);
    if (!transaccion) return res.status(404).json({ error: "No encontramos esa transacción." });
    const resultado = await aplicarPlanDesdeReferencia(transaccion.reference, transaccion.status);
    res.json({ estado: transaccion.status, aplicado: resultado.ok, plan: resultado.plan || null });
  } catch (e) {
    console.error("Error confirmando pago:", e.message);
    res.status(502).json({ error: "No pudimos confirmar el pago con Wompi. Inténtalo de nuevo." });
  }
});

app.post("/api/webhooks/wompi", express.json(), async (req, res) => {
  try {
    const evento = req.body;
    const transaccion = evento?.data?.transaction;
    if (transaccion) {
      await aplicarPlanDesdeReferencia(transaccion.reference, transaccion.status);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Error procesando webhook de Wompi:", e.message);
    res.sendStatus(200);
  }
});

async function requiereAdmin(req, res, next) {
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("es_admin").eq("id", req.usuario.id).single();
  if (!perfil?.es_admin) return res.status(403).json({ error: "No tienes acceso a esta sección." });
  next();
}

app.get("/api/admin/usuarios", autenticar, requiereAdmin, async (req, res) => {
  const { data: usuariosAuth } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const { data: perfiles } = await supabaseAdmin.from("perfiles").select("*");
  const { data: videos } = await supabaseAdmin.from("videos").select("usuario_id, estado, mes");

  const mes = mesActual();
  const lista = (usuariosAuth?.users || []).map((u) => {
    const perfil = (perfiles || []).find((p) => p.id === u.id) || {};
    const videosDelUsuario = (videos || []).filter((v) => v.usuario_id === u.id);
    const videosEsteMes = videosDelUsuario.filter((v) => v.mes === mes && v.estado !== "fallido").length;
    return {
      id: u.id,
      nombre: u.user_metadata?.nombre || "",
      email: u.email,
      plan: perfil.plan || "inicial",
      planExpira: perfil.plan_expira || null,
      videosTotal: videosDelUsuario.length,
      videosEsteMes,
      creadoEn: u.created_at,
    };
  });
  lista.sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  res.json({ usuarios: lista });
});

app.put("/api/admin/usuarios/:id/plan", autenticar, requiereAdmin, async (req, res) => {
  const { plan } = req.body || {};
  if (!PLANES[plan]) return res.status(400).json({ error: "Plan inválido." });
  const { error } = await supabaseAdmin.from("perfiles").update({ plan }).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: "No pudimos actualizar el plan." });
  res.json({ ok: true });
});

app.post("/api/redes/conectar", autenticar, async (req, res) => {
  if (!UPLOAD_POST_API_KEY) {
    return res.status(500).json({ error: "La publicación a redes todavía no está configurada." });
  }
  await asegurarPerfilUploadPost(req.usuario.id);
  try {
    const r = await fetch(`${UPLOAD_POST_BASE}/uploadposts/users/generate-jwt`, {
      method: "POST",
      headers: { Authorization: `Apikey ${UPLOAD_POST_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ username: req.usuario.id }),
    });
    const j = await r.json();
    if (!j?.access_url) throw new Error("sin access_url en la respuesta");
    res.json({ urlConexion: j.access_url });
  } catch (e) {
    console.error("Error generando enlace de conexión:", e.message);
    res.status(502).json({ error: "No pudimos generar el enlace de conexión. Inténtalo de nuevo." });
  }
});

app.post("/api/videos/:id/publicar", autenticar, async (req, res) => {
  if (!UPLOAD_POST_API_KEY) {
    return res.status(500).json({ error: "La publicación a redes todavía no está configurada." });
  }
  const { data: video } = await supabaseAdmin
    .from("videos").select("*").eq("id", req.params.id).eq("usuario_id", req.usuario.id).single();
  if (!video || video.estado !== "listo" || !video.urls?.length) {
    return res.status(409).json({ error: "Este video todavía no está listo para publicar." });
  }
  const plataformas = Array.isArray(req.body?.plataformas) && req.body.plataformas.length
    ? req.body.plataformas
    : ["tiktok", "instagram", "youtube"];

  try {
    const rVideo = await fetch(video.urls[0]);
    const bytesVideo = await rVideo.arrayBuffer();
    const formData = new FormData();
    formData.append("video", new Blob([bytesVideo], { type: "video/mp4" }), "video.mp4");
    formData.append("user", req.usuario.id);
    formData.append("title", video.tema);
    plataformas.forEach((p) => formData.append("platform[]", p));

    const r = await fetch(`${UPLOAD_POST_BASE}/upload`, {
      method: "POST",
      headers: { Authorization: `Apikey ${UPLOAD_POST_API_KEY}` },
      body: formData,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    res.json({ ok: true, resultado: j });
  } catch (e) {
    console.error("Error publicando en redes:", e.message);
    res.status(502).json({ error: "No pudimos publicar el video. Verifica que tus redes estén conectadas e inténtalo de nuevo." });
  }
});

function generarSilencio(segundos) {
  return new Promise((resolve, reject) => {
    if (!MOTOR_CARPETA) return reject(new Error("Falta configurar MOTOR_CARPETA"));
    const carpeta = path.join(MOTOR_CARPETA, "storage", "custom_audio");
    fs.mkdirSync(carpeta, { recursive: true });
    const nombre = `silencio-${crypto.randomUUID()}.mp3`;
    const destino = path.join(carpeta, nombre);
    const proceso = spawn(FFMPEG_BIN, [
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-t", String(segundos), "-c:a", "libmp3lame", "-y", destino,
    ]);
    proceso.on("error", reject);
    proceso.on("close", (codigo) => {
      if (codigo === 0) resolve(destino);
      else reject(new Error("no se pudo generar el silencio"));
    });
  });
}

app.post("/api/registro", async (req, res) => {
  const { nombre, email, clave } = req.body || {};
  if (!nombre || !email || !clave) return res.status(400).json({ error: "Completa nombre, correo y contraseña." });
  if (String(clave).length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });

  const { error: errorCreacion } = await supabaseAdmin.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password: String(clave),
    email_confirm: true,
    user_metadata: { nombre: String(nombre).trim() },
  });
  if (errorCreacion) {
    const mensaje = /already|registrad/i.test(errorCreacion.message)
      ? "Ya existe una cuenta con este correo. Inicia sesión."
      : "No pudimos crear tu cuenta. Inténtalo de nuevo.";
    return res.status(409).json({ error: mensaje });
  }

  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email: String(email).trim().toLowerCase(),
    password: String(clave),
  });
  if (error || !data?.session) {
    return res.status(500).json({ error: "Tu cuenta se creó, pero no pudimos iniciar tu sesión. Intenta iniciar sesión manualmente." });
  }
  res.json({ token: data.session.access_token, nombre: String(nombre).trim() });
});

app.post("/api/login", async (req, res) => {
  const { email, clave } = req.body || {};
  const { data, error } = await supabasePublic.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password: String(clave || ""),
  });
  if (error || !data?.session) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  res.json({ token: data.session.access_token, nombre: data.user.user_metadata?.nombre || "" });
});

app.get("/api/yo", autenticar, async (req, res) => {
  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("id, plan, plan_expira, es_admin")
    .eq("id", req.usuario.id)
    .single();
  const plan = await planEfectivo(perfil);
  res.json({
    nombre: req.usuario.nombre,
    email: req.usuario.email,
    plan,
    esAdmin: !!perfil?.es_admin,
    cuota: await cuotaDe(req.usuario.id, plan),
  });
});

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
    res.status(502).json({ error: "No pudimos redactar el guion en este momento. Verifica la clave de Groq e inténtalo de nuevo." });
  }
});

app.post("/api/videos", autenticar, async (req, res) => {
  const { tema, guion, terminos, voz, duracion, bgmArchivo, bgmVolumen, materiales, audioPersonalizado, vozPremium, formato, sinNarracion, fuente, bgmPremiumUrl, subtitulosActivos, subtitulosColor, subtitulosFuente } = req.body || {};
  if (!tema || String(tema).trim().length < 5) {
    return res.status(400).json({ error: "Escribe el tema de tu video (mínimo 5 caracteres)." });
  }

  const { data: perfil } = await supabaseAdmin.from("perfiles").select("id, plan, plan_expira").eq("id", req.usuario.id).single();
  const plan = await planEfectivo(perfil);
  const cuota = await cuotaDe(req.usuario.id, plan);
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
    return res.status(502).json({ error: "No pudimos redactar el guion en este momento. Verifica la clave de Groq e inténtalo de nuevo." });
  }

  const usaPropios = Array.isArray(materiales) && materiales.length > 0;
  const SEGUNDOS_POR_DURACION = { corto: 30, medio: 60, largo: 90 };
  const FORMATOS_VALIDOS = ["9:16", "16:9", "1:1"];
  const aspecto = FORMATOS_VALIDOS.includes(formato) ? formato : "9:16";
  const FUENTES_VALIDAS = ["pexels", "pixabay", "coverr"];
  const fuenteVideo = FUENTES_VALIDAS.includes(fuente) ? fuente : "pexels";
  const FUENTES_VALIDAS_SUBTITULO = {
    clasica: "BeVietnamPro-Bold.ttf",
    ligera: "BeVietnamPro-Medium.ttf",
    elegante: "Charm-Bold.ttf",
    moderna: "UTM Kabel KT.ttf",
    redondeada: "BeVietnamPro-Medium.ttf",
    viral: "BeVietnamPro-Bold.ttf",
  };

  let audioFinal = audioPersonalizado || undefined;
  if (sinNarracion && !audioPersonalizado) {
    try {
      audioFinal = await generarSilencio(SEGUNDOS_POR_DURACION[duracion] || 30);
    } catch (e) {
      console.error("Error generando silencio:", e.message);
      return res.status(500).json({ error: "No pudimos preparar el video sin narración. Inténtalo de nuevo." });
    }
  }

  let bgmArchivoFinal = bgmArchivo || "";
  if (bgmPremiumUrl && !bgmArchivo) {
    try {
      const rBgm = await fetch(bgmPremiumUrl, { signal: AbortSignal.timeout(15000) });
      if (!rBgm.ok) throw new Error("no se pudo descargar la canción elegida");
      const bytes = await rBgm.arrayBuffer();
      const formData = new FormData();
      formData.append("file", new Blob([bytes], { type: "audio/mpeg" }), `jamendo-${crypto.randomUUID()}.mp3`);
      const rMotor = await fetch(`${MOTOR_URL}/api/v1/musics`, { method: "POST", body: formData });
      const j = await rMotor.json();
      if (!rMotor.ok || !j?.data?.file) throw new Error("el motor no aceptó la canción");
      bgmArchivoFinal = j.data.file;
    } catch (e) {
      console.error("Error descargando música premium:", e.message);
      return res.status(502).json({ error: "No pudimos preparar la canción premium elegida. Prueba con otra o inténtalo de nuevo." });
    }
  }

  const carga = {
    video_subject: String(tema).trim(),
    video_script: guionFinal,
    video_terms: terminosFinales,
    video_aspect: aspecto,
    video_concat_mode: "random",
    video_transition_mode: "Shuffle",
    match_materials_to_script: !usaPropios,
    n_threads: 4,
    video_clip_duration: 3,
    video_count: 1,
    video_source: usaPropios ? "local" : fuenteVideo,
    video_materials: usaPropios ? materiales.map((m) => ({ provider: "local", url: m })) : undefined,
    video_language: "es",
    voice_name: vozPremium ? `elevenlabs:${vozPremium}:premium` : (voz || "es-CO-SalomeNeural-Female"),
    voice_rate: 0.98,
    voice_volume: 1.0,
    custom_audio_file: audioFinal,
    bgm_type: "random",
    bgm_file: bgmArchivoFinal,
    bgm_volume: typeof bgmVolumen === "number" ? Math.max(0, Math.min(1, bgmVolumen)) : 0.2,
    subtitle_enabled: subtitulosActivos !== false,
    font_name: FUENTES_VALIDAS_SUBTITULO[subtitulosFuente] || "BeVietnamPro-Bold.ttf",
    font_size: aspecto === "16:9" ? 64 : 84,
    text_color: /^#[0-9A-Fa-f]{6}$/.test(subtitulosColor || "") ? subtitulosColor : "#FFFFFF",
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
    return res.status(502).json({ error: "El motor de producción no está disponible. Verifica que la ventana del motor (api) esté abierta e inténtalo de nuevo." });
  }

  const { data: video, error } = await supabaseAdmin
    .from("videos")
    .insert({
      usuario_id: req.usuario.id,
      tema: carga.video_subject,
      voz: carga.voice_name,
      duracion: dur.etiqueta,
      task_id: respuesta.data.task_id,
      estado: "produciendo",
      progreso: 0,
      urls: [],
      mes: mesActual(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error guardando el video en Supabase:", error.message);
    return res.status(500).json({ error: "El video se envió a producir, pero no pudimos registrarlo. Escríbenos si no aparece en tu lista." });
  }
  res.json({ ok: true, video });
});

async function sincronizarVideo(video) {
  if (video.estado === "listo" || video.estado === "fallido") return video;
  try {
    const r = await fetch(`${MOTOR_URL}/api/v1/tasks/${video.task_id}`);
    if (r.status === 404) {
      const { data: actualizado } = await supabaseAdmin
        .from("videos").update({ estado: "fallido" }).eq("id", video.id).select().single();
      return actualizado || video;
    }
    const j = await r.json();
    const tarea = j?.data;
    if (!tarea) return video;

    if (tarea.state === 1 && tarea.videos?.length) {
      const rutaMotor = tarea.videos[0];
      const urlMotor = rutaMotor.startsWith("http") ? rutaMotor : `${MOTOR_URL}${rutaMotor.startsWith("/") ? "" : "/"}${rutaMotor}`;
      const rOrigen = await fetch(urlMotor);
      const bytes = Buffer.from(await rOrigen.arrayBuffer());
      const rutaStorage = `${video.usuario_id}/${video.id}.mp4`;
      const { error: errorSubida } = await supabaseAdmin.storage.from("videos").upload(rutaStorage, bytes, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (errorSubida) throw new Error("no se pudo subir a Supabase Storage: " + errorSubida.message);
      const { data: publico } = supabaseAdmin.storage.from("videos").getPublicUrl(rutaStorage);

      const { data: actualizado } = await supabaseAdmin
        .from("videos")
        .update({ estado: "listo", progreso: 100, urls: [publico.publicUrl] })
        .eq("id", video.id)
        .select()
        .single();
      if (actualizado) avisarVideoListo(actualizado);
      return actualizado || video;
    } else if (tarea.state === -1) {
      const { data: actualizado } = await supabaseAdmin
        .from("videos").update({ estado: "fallido" }).eq("id", video.id).select().single();
      return actualizado || video;
    } else {
      const progreso = Math.round(tarea.progress || 0);
      if (progreso !== video.progreso) {
        await supabaseAdmin.from("videos").update({ progreso }).eq("id", video.id);
      }
      return { ...video, progreso };
    }
  } catch (e) {
    console.error("Error sincronizando video:", e.message);
    return video;
  }
}

app.get("/api/videos", autenticar, async (req, res) => {
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("id, plan, plan_expira").eq("id", req.usuario.id).single();
  const plan = await planEfectivo(perfil);
  const { data: videos } = await supabaseAdmin
    .from("videos")
    .select("*")
    .eq("usuario_id", req.usuario.id)
    .order("creado_en", { ascending: false });

  const sincronizados = await Promise.all((videos || []).map(sincronizarVideo));
  res.json({ videos: sincronizados, cuota: await cuotaDe(req.usuario.id, plan) });
});

app.get("/api/videos/:id/descargar", autenticar, async (req, res) => {
  const { data: video } = await supabaseAdmin
    .from("videos")
    .select("*")
    .eq("id", req.params.id)
    .eq("usuario_id", req.usuario.id)
    .single();
  if (!video) return res.status(404).json({ error: "Este video no existe en tu cuenta." });

  const actualizado = await sincronizarVideo(video);
  if (actualizado.estado !== "listo" || !actualizado.urls?.length) {
    return res.status(409).json({ error: "Tu video aún está en producción. Vuelve en un momento." });
  }

  const { data: perfil } = await supabaseAdmin.from("perfiles").select("id, plan, plan_expira").eq("id", req.usuario.id).single();
  const esGratis = (await planEfectivo(perfil)) === "inicial";

  if (!esGratis) {
    return res.redirect(actualizado.urls[0]);
  }

  try {
    const rCrudo = await fetch(actualizado.urls[0]);
    const rutaTemporal = path.join(os.tmpdir(), `viraliza-origen-${crypto.randomUUID()}.mp4`);
    fs.writeFileSync(rutaTemporal, Buffer.from(await rCrudo.arrayBuffer()));
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
    res.status(502).json({ error: "No pudimos preparar tu descarga. Inténtalo de nuevo en un momento." });
  }
});

app.listen(PUERTO, () => {
  console.log("——————————————————————————————————————");
  console.log(`  VIRALIZA · corriendo en http://localhost:${PUERTO}`);
  console.log(`  Motor de producción: ${MOTOR_URL}`);
  console.log(`  Supabase: ${SUPABASE_URL || "(sin configurar)"}`);
  console.log("——————————————————————————————————————");
});



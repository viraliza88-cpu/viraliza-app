// ============================================================
//  VIRALIZA — Servidor principal
//  Plataforma de producción de video · v1.0 (con Supabase)
// ============================================================
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const os = require("os");
const FFMPEG_BIN = require("ffmpeg-static");
const { createClient } = require("@supabase/supabase-js");
global.WebSocket = require("ws");

const MARCA_AGUA_PNG = path.join(__dirname, "public_assets", "marca-agua.png");
const PUERTO = process.env.PUERTO || 3000;
const MOTOR_URL = (process.env.MOTOR_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODELO = process.env.GROQ_MODELO || "llama-3.3-70b-versatile";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

const PLANES = {
  inicial:   { nombre: "Inicial",   limite: 2,   sello: true  },
  esencial:  { nombre: "Esencial",  limite: 15,  sello: false },
  signature: { nombre: "Signature", limite: 50,  sello: false },
  elite:     { nombre: "Élite",     limite: 150, sello: false },
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

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function autenticar(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.t || "");
  if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
  req.usuario = {
    id: data.user.id,
    email: data.user.email,
    nombre: data.user.user_metadata?.nombre || "",
  };
  next();
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
    console.error("ERROR DE REGISTRO:", errorCreacion.message);
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
    console.error("ERROR DE LOGIN COMPLETO:", JSON.stringify(error, null, 2));
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }
  res.json({ token: data.session.access_token, nombre: data.user.user_metadata?.nombre || "" });
});

app.get("/api/yo", autenticar, async (req, res) => {
  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("plan")
    .eq("id", req.usuario.id)
    .single();
  const plan = perfil?.plan || "inicial";
  res.json({
    nombre: req.usuario.nombre,
    email: req.usuario.email,
    plan,
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
  const { tema, guion, terminos, voz, duracion } = req.body || {};
  if (!tema || String(tema).trim().length < 5) {
    return res.status(400).json({ error: "Escribe el tema de tu video (mínimo 5 caracteres)." });
  }

  const { data: perfil } = await supabaseAdmin.from("perfiles").select("plan").eq("id", req.usuario.id).single();
  const plan = perfil?.plan || "inicial";
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
  const { data: perfil } = await supabaseAdmin.from("perfiles").select("plan").eq("id", req.usuario.id).single();
  const plan = perfil?.plan || "inicial";
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

  const { data: perfil } = await supabaseAdmin.from("perfiles").select("plan").eq("id", req.usuario.id).single();
  const esGratis = (perfil?.plan || "inicial") === "inicial";
  // Plan pago: sin marca de agua que aplicar, así que mandamos directo al archivo en la nube.
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
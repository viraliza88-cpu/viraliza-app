// Script de reactivación — usuarios sin producir en 7 días
// Ejecutar con: node reactivacion.js
require('dotenv').config({ path: '/var/www/viraliza-app/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: require("ws") } });
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_REMITENTE = process.env.RESEND_REMITENTE || 'Viraliza <hola@viralizacol.com>';
const SITIO_URL = process.env.SITIO_URL || 'https://viralizacol.com';

const IDEAS_POR_PLAN = {
  inicial:     ["3 razones para tener presencia en redes", "Cómo diferenciarte de tu competencia"],
  esencial:    ["El producto estrella de tu negocio este mes", "Una historia de cliente satisfecho"],
  signature:   ["Tendencia del momento en tu industria", "El detrás de cámaras de tu negocio"],
  elite:       ["Campaña especial de la semana", "Tu propuesta de valor en 30 segundos"],
  profesional: ["Video testimonial de cliente", "Presentación de tu equipo de trabajo"],
};

async function enviarReactivacion(email, nombre, plan) {
  const ideas = IDEAS_POR_PLAN[plan?.toLowerCase()] || IDEAS_POR_PLAN.inicial;
  const idea1 = ideas[0];
  const idea2 = ideas[1];

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: RESEND_REMITENTE,
      to: email,
      subject: `${nombre}, tu próximo video está esperando`,
      html: `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#08080B;color:#EDEAE2">
        <div style="height:3px;background:linear-gradient(90deg,#8A6E1E,#D6B25E,#8A6E1E)"></div>
        <div style="padding:40px 36px 32px">
          <h1 style="font-size:26px;margin:0 0 4px">Viraliza<span style="color:#D6B25E">.</span></h1>
          <p style="color:#6B6560;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px">Ideas para esta semana</p>
          <p style="font-size:17px;font-weight:700;color:#F0EDE5;margin:0 0 8px">Hola, <span style="color:#D6B25E">${nombre}</span>.</p>
          <p style="font-size:15px;line-height:1.7;color:#9B9590;margin:0 0 28px">Han pasado unos días desde tu último video. Tu audiencia está esperando contenido nuevo — aquí van dos ideas para empezar hoy:</p>
          <div style="background:#0F0F13;border:1px solid rgba(255,255,255,.07);padding:20px 24px;margin-bottom:12px">
            <p style="font-size:11px;color:#D6B25E;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">Idea 1</p>
            <p style="font-size:15px;color:#F0EDE5;margin:0;font-weight:600">${idea1}</p>
          </div>
          <div style="background:#0F0F13;border:1px solid rgba(255,255,255,.07);padding:20px 24px;margin-bottom:28px">
            <p style="font-size:11px;color:#D6B25E;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">Idea 2</p>
            <p style="font-size:15px;color:#F0EDE5;margin:0;font-weight:600">${idea2}</p>
          </div>
          <a href="${SITIO_URL}/panel.html" style="display:inline-block;background:#D6B25E;color:#08080B;padding:16px 32px;text-decoration:none;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;font-family:Arial,sans-serif">Producir ahora</a>
          <p style="font-size:12px;color:#4A4540;margin-top:32px;line-height:1.6">Tu estudio de video sigue activo y listo.<br>— El equipo de Viraliza</p>
        </div>
        <div style="height:1px;background:rgba(255,255,255,.05);margin:0 36px"></div>
        <div style="padding:20px 36px">
          <p style="font-size:11px;color:#3A3530;margin:0">© 2026 Viraliza · Medellín, Colombia · viralizacol.com</p>
        </div>
      </div>`,
    }),
  });
}

async function main() {
  console.log(`[REACTIVACION] Iniciando — ${new Date().toISOString()}`);

  const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const hace8dias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  // Usuarios con plan activo que no han producido en 7-8 días
  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, plan, nombre')
    .neq('plan', 'Inicial')
    .not('plan', 'is', null);

  if (!perfiles?.length) { console.log('[REACTIVACION] No hay usuarios con plan activo'); return; }

  let enviados = 0;
  for (const perfil of perfiles) {
    try {
      // Verificar último video producido
      const { data: ultimoVideo } = await supabase
        .from('videos')
        .select('creado_en')
        .eq('usuario_id', perfil.id)
        .order('creado_en', { ascending: false })
        .limit(1)
        .single();

      const ultimaActividad = ultimoVideo?.creado_en || null;

      // Solo enviar si el último video fue hace entre 7 y 8 días (para no enviar cada día)
      if (!ultimaActividad || (ultimaActividad < hace7dias && ultimaActividad > hace8dias)) {
        const { data: usuario } = await supabase.auth.admin.getUserById(perfil.id);
        const email = usuario?.user?.email;
        const nombre = perfil.nombre || 'amigo';
        if (!email) continue;

        await enviarReactivacion(email, nombre, perfil.plan);
        console.log(`[REACTIVACION] Enviado a ${email}`);
        enviados++;

        // Esperar 1 segundo entre correos para no saturar Resend
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch(e) {
      console.error(`[REACTIVACION] Error con ${perfil.id}:`, e.message);
    }
  }

  console.log(`[REACTIVACION] Completado — ${enviados} correos enviados`);
}

main().catch(console.error);

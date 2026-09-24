require('dotenv').config({ path: '/var/www/viraliza-app/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: require('ws') } }
);
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_REMITENTE = process.env.RESEND_REMITENTE || 'Viraliza <hola@viralizacol.com>';
const SITIO_URL = process.env.SITIO_URL || 'https://viralizacol.com';

const PRECIOS = { Esencial: 39900, Signature: 89900, Élite: 199900, Elite: 199900, Profesional: 149000 };

async function enviarCorreo(email, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: RESEND_REMITENTE, to: email, subject, html }),
  });
}

function plantillaCorreo(titulo, subtitulo, cuerpo, ctaTexto, ctaUrl) {
  return `<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#08080B;color:#EDEAE2">
    <div style="height:3px;background:linear-gradient(90deg,#8A6E1E,#D6B25E,#8A6E1E)"></div>
    <div style="padding:40px 36px 32px">
      <h1 style="font-size:26px;margin:0 0 4px">Viraliza<span style="color:#D6B25E">.</span></h1>
      <p style="color:#6B6560;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 32px">${subtitulo}</p>
      ${cuerpo}
      <a href="${ctaUrl}" style="display:inline-block;background:#D6B25E;color:#08080B;padding:16px 32px;text-decoration:none;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;font-family:Arial,sans-serif">${ctaTexto}</a>
      <p style="font-size:12px;color:#4A4540;margin-top:32px;line-height:1.6">— El equipo de Viraliza</p>
    </div>
    <div style="height:1px;background:rgba(255,255,255,.05);margin:0 36px"></div>
    <div style="padding:20px 36px"><p style="font-size:11px;color:#3A3530;margin:0">© 2026 Viraliza · Medellín, Colombia</p></div>
  </div>`;
}

async function main() {
  console.log(`[RENOVACIONES] Iniciando — ${new Date().toISOString()}`);

  const ahora = new Date();
  const en3dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hoy = ahora.toISOString().slice(0, 10);
  const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, plan, plan_expira, nombre')
    .not('plan_expira', 'is', null)
    .neq('plan', 'Inicial');

  if (!perfiles?.length) { console.log('[RENOVACIONES] Sin planes por vencer'); return; }

  let procesados = 0;
  for (const perfil of perfiles) {
    try {
      const expira = perfil.plan_expira?.slice(0, 10);
      if (!expira) continue;

      const { data: auth } = await supabase.auth.admin.getUserById(perfil.id);
      const email = auth?.user?.email;
      const nombre = perfil.nombre || 'amigo';
      const plan = perfil.plan;
      const precio = PRECIOS[plan] || 0;
      if (!email) continue;

      // 3 días antes — recordatorio
      if (expira === en3dias) {
        const html = plantillaCorreo(
          'Tu plan vence pronto',
          'Renovación de membresía',
          `<p style="font-size:15px;line-height:1.7;color:#9B9590;margin:0 0 28px">
            Hola <strong style="color:#F0EDE5">${nombre}</strong>, tu plan <strong style="color:#D6B25E">${plan}</strong> vence en 3 días.
            Renuévalo para seguir produciendo videos sin interrupciones.
          </p>
          <div style="background:#0F0F13;border:1px solid rgba(214,178,94,.2);padding:16px 24px;margin-bottom:28px">
            <p style="font-size:13px;color:#CCCAB8;margin:0">Plan ${plan} · $${precio.toLocaleString('es-CO')} COP / mes</p>
          </div>`,
          'Renovar mi plan ahora',
          `${SITIO_URL}/panel.html`
        );
        await enviarCorreo(email, `Tu plan ${plan} vence en 3 días — Viraliza`, html);
        console.log(`[RENOVACIONES] Recordatorio 3 días → ${email}`);
        procesados++;
      }

      // El día que vence — urgente
      if (expira === hoy) {
        const html = plantillaCorreo(
          'Tu plan vence hoy',
          'Acción requerida',
          `<p style="font-size:15px;line-height:1.7;color:#9B9590;margin:0 0 28px">
            Hola <strong style="color:#F0EDE5">${nombre}</strong>, tu plan <strong style="color:#D6B25E">${plan}</strong> vence hoy.
            Tienes <strong style="color:#F0EDE5">24 horas adicionales</strong> de gracia antes de que tu cuenta pase al plan Inicial.
            Renueva ahora para no perder acceso a tus videos y configuraciones.
          </p>`,
          'Renovar antes de que venza',
          `${SITIO_URL}/panel.html`
        );
        await enviarCorreo(email, `⚠ Tu plan ${plan} vence hoy — renueva ahora`, html);
        console.log(`[RENOVACIONES] Vence hoy → ${email}`);
        procesados++;
      }

      // Un día después — degradar a Inicial
      if (expira === ayer) {
        await supabase.from('perfiles')
          .update({ plan: 'Inicial', plan_expira: null, videos_este_mes: 0 })
          .eq('id', perfil.id);

        const html = plantillaCorreo(
          'Tu plan ha vencido',
          'Membresía vencida',
          `<p style="font-size:15px;line-height:1.7;color:#9B9590;margin:0 0 28px">
            Hola <strong style="color:#F0EDE5">${nombre}</strong>, tu plan <strong style="color:#D6B25E">${plan}</strong> ha vencido
            y tu cuenta pasó al plan Inicial. Tus videos producidos siguen disponibles.
            Renueva cuando quieras para seguir produciendo.
          </p>`,
          'Reactivar mi plan',
          `${SITIO_URL}/panel.html`
        );
        await enviarCorreo(email, `Tu plan ${plan} ha vencido — Viraliza`, html);
        console.log(`[RENOVACIONES] Plan degradado → ${email}`);
        procesados++;
      }

      await new Promise(r => setTimeout(r, 500));
    } catch(e) {
      console.error(`[RENOVACIONES] Error con ${perfil.id}:`, e.message);
    }
  }

  console.log(`[RENOVACIONES] Completado — ${procesados} acciones`);
}

main().catch(console.error);

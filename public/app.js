// ============================================================
//  VIRALIZA · Lógica del navegador (acceso + panel)
// ============================================================

const API = {
  token() { return localStorage.getItem("viraliza_token") || ""; },
  guardarSesion(token, nombre) {
    localStorage.setItem("viraliza_token", token);
    localStorage.setItem("viraliza_nombre", nombre);
  },
  cerrarSesion() {
    localStorage.removeItem("viraliza_token");
    localStorage.removeItem("viraliza_nombre");
    location.href = "login.html";
  },
  async pedir(ruta, opciones = {}) {
    const r = await fetch(ruta, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(this.token() ? { Authorization: "Bearer " + this.token() } : {}),
        ...(opciones.headers || {}),
      },
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && ruta !== "/api/login" && ruta !== "/api/registro") { this.cerrarSesion(); return null; }
    if (!r.ok) throw new Error(j.error || "Algo no salió bien. Inténtalo de nuevo.");
    return j;
  },
};

function mostrarMensaje(texto, tipo) {
  const m = document.getElementById("mensaje");
  if (!m) return;
  m.textContent = texto;
  m.className = "msg " + (tipo || "err");
}
function limpiarMensaje() {
  const m = document.getElementById("mensaje");
  if (m) m.className = "msg";
}

// ------------------------------------------------------------
//  Página de acceso
// ------------------------------------------------------------
const Acceso = {
  modo: "login",
  iniciar() {
    if (API.token()) { location.href = "panel.html"; return; }
    const params = new URLSearchParams(location.search);
    this.cambiarModo(params.get("modo") === "registro" ? "registro" : "login");

    document.getElementById("tab-login").onclick = () => this.cambiarModo("login");
    document.getElementById("tab-registro").onclick = () => this.cambiarModo("registro");
    document.getElementById("cambiar").onclick = (e) => {
      e.preventDefault();
      this.cambiarModo(this.modo === "login" ? "registro" : "login");
    };
    document.getElementById("accion").onclick = () => this.enviar();
    document.getElementById("clave").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.enviar();
    });
  },
  cambiarModo(modo) {
    this.modo = modo;
    limpiarMensaje();
    const esRegistro = modo === "registro";
    document.getElementById("tab-login").classList.toggle("activo", !esRegistro);
    document.getElementById("tab-registro").classList.toggle("activo", esRegistro);
    document.getElementById("campo-nombre").style.display = esRegistro ? "block" : "none";
    document.getElementById("titulo").innerHTML = esRegistro
      ? 'Tu estudio te <em>espera</em>' : 'Bienvenido <em>de vuelta</em>';
    document.getElementById("subtitulo").textContent = esRegistro
      ? "Crea tu cuenta y produce tu primer video gratis." : "Entra a tu panel de producción.";
    document.getElementById("accion").textContent = esRegistro ? "Crear mi cuenta" : "Entrar";
    document.getElementById("alterno").style.display = "none";
  },
  async enviar() {
    limpiarMensaje();
    const boton = document.getElementById("accion");
    boton.disabled = true;
    try {
      const cuerpo = {
        email: document.getElementById("email").value,
        clave: document.getElementById("clave").value,
      };
      let respuesta;
      if (this.modo === "registro") {
        cuerpo.nombre = document.getElementById("nombre").value;
        respuesta = await API.pedir("/api/registro", { method: "POST", body: JSON.stringify(cuerpo) });
      } else {
        respuesta = await API.pedir("/api/login", { method: "POST", body: JSON.stringify(cuerpo) });
      }
      API.guardarSesion(respuesta.token, respuesta.nombre);
      location.href = "panel.html";
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false;
    }
  },
};

// ------------------------------------------------------------
//  Panel de producción
// ------------------------------------------------------------
// Plantillas rápidas: voz, duración y un ejemplo de tema recomendados por nicho.
const PLANTILLAS = {
  inmobiliaria: { voz: "es-CO-GonzaloNeural-Male", duracion: "medio", ejemplo: "Los 3 errores que cometen los compradores primerizos en Medellín" },
  restaurante: { voz: "es-CO-SalomeNeural-Female", duracion: "corto", ejemplo: "El plato que nadie pide pero deberían probar" },
  belleza: { voz: "es-MX-DaliaNeural-Female", duracion: "corto", ejemplo: "3 tips para que tu manicure dure más de dos semanas" },
  agencia: { voz: "es-CO-GonzaloNeural-Male", duracion: "medio", ejemplo: "Por qué tu negocio necesita videos cortos ya" },
  gimnasio: { voz: "es-CO-SalomeNeural-Female", duracion: "corto", ejemplo: "El error que arruina tus resultados en el gimnasio" },
};

const Panel = {
  temporizador: null,
  terminosActuales: [],
  iniciar() {
    if (!API.token()) { location.href = "login.html"; return; }
    document.getElementById("nombre-usuario").textContent =
      localStorage.getItem("viraliza_nombre") || "";
    document.getElementById("salir").onclick = () => API.cerrarSesion();
    document.getElementById("generar-guion").onclick = () => this.generarGuion();
    document.getElementById("regenerar-guion").onclick = () => this.generarGuion();
    document.getElementById("producir").onclick = () => this.producir();
    document.querySelectorAll(".chip-plantilla").forEach((boton) => {
      boton.onclick = () => this.aplicarPlantilla(boton.dataset.nicho);
    });
    this.cargar();
  },
  aplicarPlantilla(nicho) {
    const plantilla = PLANTILLAS[nicho];
    if (!plantilla) return;
    document.getElementById("voz").value = plantilla.voz;
    document.getElementById("duracion").value = plantilla.duracion;
    const tema = document.getElementById("tema");
    if (!tema.value.trim()) tema.value = plantilla.ejemplo;
    tema.focus();
  },
  async cargar() {
    try {
      const yo = await API.pedir("/api/yo");
      if (!yo) return;
      this.pintarCuota(yo.cuota);
      await this.refrescarVideos();
    } catch (e) {
      mostrarMensaje(e.message, "err");
    }
  },
  pintarCuota(cuota) {
    document.getElementById("plan-nombre").textContent = "Membresía " + cuota.plan;
    document.getElementById("cuota-usados").textContent = cuota.usados;
    document.getElementById("cuota-limite").textContent = cuota.limite;
  },
  async generarGuion() {
    limpiarMensaje();
    const tema = document.getElementById("tema").value;
    if (!tema || tema.trim().length < 5) {
      mostrarMensaje("Escribe el tema de tu video (mínimo 5 caracteres).", "err");
      return;
    }
    const boton = document.getElementById("generar-guion");
    const botonRegenerar = document.getElementById("regenerar-guion");
    [boton, botonRegenerar].forEach((b) => { b.disabled = true; b.textContent = "Redactando…"; });
    try {
      const datos = await API.pedir("/api/guion", {
        method: "POST",
        body: JSON.stringify({ tema, duracion: document.getElementById("duracion").value }),
      });
      this.terminosActuales = datos.terminos || [];
      document.getElementById("guion-editable").value = datos.guion;
      document.getElementById("paso-tema").style.display = "none";
      document.getElementById("paso-guion").style.display = "block";
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false;
      boton.textContent = "Generar guion";
      botonRegenerar.disabled = false;
      botonRegenerar.textContent = "Generar otro guion";
    }
  },
  async producir() {
    limpiarMensaje();
    const boton = document.getElementById("producir");
    boton.disabled = true;
    boton.textContent = "Enviando a producción…";
    try {
      await API.pedir("/api/videos", {
        method: "POST",
        body: JSON.stringify({
          tema: document.getElementById("tema").value,
          guion: document.getElementById("guion-editable").value,
          terminos: this.terminosActuales,
          voz: document.getElementById("voz").value,
          duracion: document.getElementById("duracion").value,
        }),
      });
      document.getElementById("tema").value = "";
      document.getElementById("guion-editable").value = "";
      document.getElementById("paso-guion").style.display = "none";
      document.getElementById("paso-tema").style.display = "block";
      mostrarMensaje("Tu video entró a producción. Lo verás listo aquí mismo en unos minutos.", "ok");
      await this.refrescarVideos();
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false;
      boton.textContent = "Producir video";
    }
  },
  async refrescarVideos() {
    const datos = await API.pedir("/api/videos");
    if (!datos) return;
    this.pintarCuota(datos.cuota);
    this.pintarVideos(datos.videos);
    clearTimeout(this.temporizador);
    if (datos.videos.some((v) => v.estado === "produciendo")) {
      this.temporizador = setTimeout(() => this.refrescarVideos(), 8000);
    }
  },
  pintarVideos(videos) {
    const cont = document.getElementById("lista-videos");
    if (!videos.length) {
      cont.innerHTML =
        '<div class="vacio">Aquí aparecerán tus producciones.<br>Crea tu primer video para estrenar el estudio.</div>';
      return;
    }
    cont.innerHTML = videos
      .map((v) => {
        const fecha = new Date(v.creado_en || v.creado).toLocaleDateString("es-CO", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        });
        const estado =
          v.estado === "listo"
            ? '<span class="estado listo">Listo</span>'
            : v.estado === "fallido"
              ? '<span class="estado fallido">Falló</span>'
              : `<span class="estado produciendo">Produciendo · ${v.progreso}%</span>`;
        const accion =
          v.estado === "listo"
            ? `<a class="btn" href="/api/videos/${v.id}/descargar?t=${API.token()}">Descargar</a>`
            : "";
        const barra =
          v.estado === "produciendo"
            ? `<div class="progreso"><i style="width:${v.progreso}%"></i></div>`
            : "";
        return `<article class="video">
          <div>
            <p class="tema">${v.tema.replace(/</g, "&lt;")}</p>
            <p class="meta">${v.duracion} · ${fecha}</p>
          </div>
          ${estado}
          ${accion}
          ${barra}
        </article>`;
      })
      .join("");
  },
};
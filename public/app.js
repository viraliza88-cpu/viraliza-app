// ============================================================
//  VIRALIZA · Lógica del navegador
//  Wizard de producción en 5 pasos · v2.0
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
    if (r.status === 401) { this.cerrarSesion(); return null; }
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

// ============================================================
//  Página de acceso
// ============================================================
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
        const nombreVal = document.getElementById("nombre").value.trim();
        if (!nombreVal || nombreVal.length < 2) {
          mostrarMensaje("Escribe tu nombre para continuar.", "err");
          boton.disabled = false;
          return;
        }
        const emailVal = document.getElementById("email").value.trim();
        if (!emailVal || !emailVal.includes("@")) {
          mostrarMensaje("Escribe un correo válido.", "err");
          boton.disabled = false;
          return;
        }
        const claveVal = document.getElementById("clave").value;
        if (!claveVal || claveVal.length < 6) {
          mostrarMensaje("La contraseña debe tener mínimo 6 caracteres.", "err");
          boton.disabled = false;
          return;
        }
        cuerpo.nombre = nombreVal;
        respuesta = await API.pedir("/api/registro", { method: "POST", body: JSON.stringify(cuerpo) });
      } else {
        respuesta = await API.pedir("/api/login", { method: "POST", body: JSON.stringify(cuerpo) });
      }
      API.guardarSesion(respuesta.token, respuesta.nombre);
      // Evento GA4: registro
      if (this.modo === "registro" && typeof gtag !== "undefined") {
        gtag("event", "sign_up", { method: "email" });
      }
      const plan = new URLSearchParams(location.search).get("plan");
      if (plan && this.modo === "registro") {
        location.href = "panel.html?pagar=" + plan;
      } else {
        location.href = "panel.html";
      }
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false;
    }
  },
};

// ============================================================
//  W — Wizard de producción en 5 pasos
// ============================================================

const TEMAS_POR_NICHO = {
  restaurante: [
    "El plato secreto que todos piden en nuestro restaurante",
    "3 razones por las que nuestros clientes siempre vuelven",
    "Así preparamos nuestro plato estrella desde cero",
    "¿Por qué somos el restaurante favorito del barrio?",
    "El ingrediente especial que hace diferente nuestra cocina",
  ],
  inmobiliaria: [
    "3 errores que cometen los compradores primerizos en Medellín",
    "Por qué es el mejor momento para comprar apartamento en Colombia",
    "Los 5 barrios más valorizados de Medellín en 2025",
    "Qué revisar antes de firmar un contrato de arrendamiento",
    "Cómo financiar tu apartamento sin endeudarte de más",
  ],
  gimnasio: [
    "El error más común que arruina tus resultados en el gimnasio",
    "3 ejercicios que debes hacer si quieres ver resultados rápido",
    "Por qué la dieta importa más que el ejercicio",
    "Cómo empezar en el gimnasio sin sentirte perdido",
    "Los suplementos que realmente funcionan y los que no",
  ],
  belleza: [
    "3 tips para que tu manicure dure más de dos semanas",
    "El ritual de skincare que transformó la piel de nuestras clientas",
    "Por qué el corte de cabello adecuado cambia todo tu look",
    "Los errores de maquillaje que envejecen tu rostro",
    "Cómo cuidar tu cabello teñido sin que se maltrate",
  ],
  tienda: [
    "Los productos más vendidos de nuestra tienda este mes",
    "Por qué nuestros clientes nos recomiendan con sus amigos",
    "Novedad: llegó lo que tanto esperabas a nuestra tienda",
    "3 razones para comprar local en lugar de importado",
    "Así garantizamos la calidad de todo lo que vendemos",
  ],
  agencia: [
    "Por qué tu negocio necesita videos cortos ya mismo",
    "3 errores que cometen las marcas en redes sociales",
    "Cómo pasamos de 0 a 10.000 seguidores en 3 meses",
    "El tipo de contenido que más vende en TikTok e Instagram",
    "Por qué el video corto es el rey del marketing digital",
  ],
  educacion: [
    "3 técnicas de estudio que doblan tu rendimiento académico",
    "Por qué aprender esto puede cambiar tu vida profesional",
    "El método que usan los mejores estudiantes del mundo",
    "Cómo estudiar menos y recordar más",
    "Las habilidades más demandadas en el mercado laboral hoy",
  ],
  salud: [
    "3 hábitos que están dañando tu salud sin que lo sepas",
    "Por qué el sueño es el mejor medicamento que existe",
    "Los alimentos que debes eliminar de tu dieta ya",
    "Cómo mejorar tu energía sin tomar suplementos",
    "La verdad sobre las dietas que nadie te cuenta",
  ],
};

const W = {
  pasoActual: 1,
  estado: {
    tema: "",
    duracion: "corto",
    formato: "9:16",
    fuente: "pexels",
    guion: "",
    terminos: [],
    voz: "es-CO-SalomeNeural",
    modoVoz: "lista",
    vozPremiumId: "",
    audioPropio: "",
    sinNarracion: false,
    musicaArchivo: "",
    musicaPremiumUrl: "",
    volumen: 20,
    subtitulosActivos: true,
    subtitulosColor: "#FFFFFF",
    subtitulosFuente: "clasica",
    transicion: "None",
  },

  irA(paso) {
    if (paso === 3 && !this.estado.guion) {
      // Si vuelven al paso 3 sin guion, lo generamos
      this.generarGuion();
      return;
    }
    if (paso === 5) this.pintarResumen();
    this._mostrarPaso(paso);
  },

  _mostrarPaso(paso) {
    this.pasoActual = paso;
    document.querySelectorAll(".wizard-pantalla").forEach((p) => p.classList.remove("activa"));
    document.querySelector(`.wizard-pantalla[data-pantalla="${paso}"]`).classList.add("activa");
    document.querySelectorAll(".wizard-paso-indicador").forEach((ind) => {
      const n = Number(ind.dataset.paso);
      ind.classList.remove("activo", "completo");
      if (n === paso) ind.classList.add("activo");
      else if (n < paso) ind.classList.add("completo");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  // ---- Paso 1 ----
  limpiarSeleccionImagenes() {
    const grid = document.getElementById("grid-imagenes");
    if (grid) {
      grid.querySelectorAll(".seleccionada-img").forEach(el => {
        el.classList.remove("seleccionada-img");
        el.style.borderColor = "transparent";
        const check = el.querySelector("div");
        if (check) check.style.display = "none";
      });
    }
    this.estado.imagenesSeleccionadas = [];
    const count = document.getElementById("imagenes-seleccionadas-count");
    if (count) count.textContent = "0 imágenes seleccionadas";
    const bancoBtns = document.querySelectorAll("[data-banco]");
    bancoBtns.forEach(b => { b.style.opacity = "1"; b.style.pointerEvents = "auto"; });
    const bancoAviso = document.getElementById("banco-aviso");
    if (bancoAviso) bancoAviso.style.display = "none";
    const limpiarBtn = document.getElementById("btn-limpiar-seleccion");
    if (limpiarBtn) limpiarBtn.style.display = "none";
  },

  async buscarVideos() {
    const q = document.getElementById("busqueda-videos")?.value?.trim();
    if (!q) return mostrarMensaje("Escribe qué quieres buscar.", "err");
    const grid = document.getElementById("grid-videos");
    const cont = document.getElementById("resultados-videos");
    if (!grid || !cont) return;
    grid.innerHTML = `<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">Buscando clips…</p>`;
    cont.style.display = "block";
    try {
      const terminos = q.split(",").map(t => t.trim()).filter(Boolean);
      const r = await API.pedir("/api/galeria/buscar", {
        method: "POST",
        body: JSON.stringify({ terminos: terminos.length ? terminos : [q], orientacion: this.estado.formato || "9:16" })
      });
      const clips = r?.resultados || [];
      if (!clips.length) {
        grid.innerHTML = `<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">No encontramos clips. Prueba con otras palabras.</p>`;
        return;
      }
      grid.innerHTML = "";
      clips.forEach(clip => {
        const div = document.createElement("div");
        div.style.cssText = "position:relative;cursor:pointer;border:2px solid transparent;border-radius:4px;overflow:hidden;background:#111;aspect-ratio:16/9;grid-column:span 1";
        div.dataset.url = clip.url;
        const img = document.createElement("img");
        img.src = clip.miniatura;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;transition:all .3s";
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);transition:all .2s";
        overlay.innerHTML = `<span style="width:40px;height:40px;background:rgba(214,178,94,.85);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px">▶</span>`;
        const badge = document.createElement("span");
        badge.style.cssText = "position:absolute;top:6px;left:6px;background:rgba(0,0,0,.75);color:#D6B25E;font-size:8px;letter-spacing:1px;text-transform:uppercase;padding:3px 8px";
        badge.textContent = "VIDEO HD";
        const check = document.createElement("div");
        check.style.cssText = "position:absolute;top:6px;right:6px;width:22px;height:22px;background:#D6B25E;border-radius:50%;display:none;align-items:center;justify-content:center;color:#09090B;font-size:12px;font-weight:700";
        check.textContent = "✓";
        div.appendChild(img); div.appendChild(overlay); div.appendChild(badge); div.appendChild(check);
        div.onclick = () => {
          const sel = this.estado.imagenesSeleccionadas || [];
          const ya = sel.find(i => i.url === clip.url);
          if (ya) {
            this.estado.imagenesSeleccionadas = sel.filter(i => i.url !== clip.url);
            div.style.borderColor = "transparent"; check.style.display = "none";
          } else {
            if (sel.length >= 8) return mostrarMensaje("Máximo 8 elementos.", "err");
            this.estado.imagenesSeleccionadas = [...sel, { url: clip.url, ancho: 1920, alto: 1080 }];
            div.style.borderColor = "#D6B25E"; check.style.display = "flex";
          }
          const total = this.estado.imagenesSeleccionadas.length;
          const cv = document.getElementById("videos-seleccionados-count");
          const ci = document.getElementById("imagenes-seleccionadas-count");
          if (cv) cv.textContent = `${total} elemento(s) seleccionado(s)`;
          if (ci) ci.textContent = `${total} elemento(s) seleccionado(s)`;
          const at = document.getElementById("banco-aviso-texto");
          const bl = document.getElementById("btn-limpiar-seleccion");
          if (at) at.textContent = total > 0 ? `✓ Usarás ${total} elemento(s)` : "";
          if (bl) bl.style.display = total > 0 ? "inline-block" : "none";
        };
        let videoPreview = null;
        div.onmouseover = () => {
          overlay.style.display = "none";
          if (!videoPreview) {
            videoPreview = document.createElement("video");
            videoPreview.src = clip.url;
            videoPreview.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;border-radius:2px";
            videoPreview.muted = true;
            videoPreview.loop = true;
            videoPreview.playsInline = true;
            div.appendChild(videoPreview);
          }
          videoPreview.play().catch(()=>{});
          check.style.zIndex = "3";
        };
        div.onmouseout = () => {
          overlay.style.display = "flex";
          if (videoPreview) { videoPreview.pause(); videoPreview.currentTime = 0; }
          check.style.zIndex = "1";
        };
        grid.appendChild(div);
      });
    } catch(e) {
      console.error("buscarVideos:", e);
      grid.innerHTML = `<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">Error buscando. Intenta de nuevo.</p>`;
    }
  },

  async buscarImagenes() {
    const q = document.getElementById("busqueda-imagenes").value.trim();
    if (!q) return mostrarMensaje("Escribe qué quieres buscar.", "err");
    const fuente = this.estado.fuente || "pexels";
    const grid = document.getElementById("grid-imagenes");
    const resultadosDiv = document.getElementById("resultados-imagenes");
    grid.innerHTML = '<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">Buscando...</p>';
    resultadosDiv.style.display = "block";
    try {
      const { resultados } = await API.pedir(`/api/imagenes/buscar?q=${encodeURIComponent(q)}&fuente=${fuente}`);
      if (!resultados.length) {
        grid.innerHTML = '<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">No encontramos imágenes. Prueba otro término.</p>';
        return;
      }
      grid.innerHTML = "";
      resultados.forEach(img => {
        const div = document.createElement("div");
        div.style.cssText = "position:relative;cursor:pointer;border:2px solid transparent;border-radius:4px;overflow:hidden;background:#111";
        div.dataset.url = img.url;
        div.dataset.ancho = img.ancho;
        div.dataset.alto = img.alto;
        const imgEl = document.createElement("img");
        imgEl.src = img.thumb;
        imgEl.style.cssText = "width:100%;height:150px;object-fit:cover;display:block;transition:transform .2s;image-rendering:high-quality";
        imgEl.loading = "lazy";
        imgEl.onmouseover = () => imgEl.style.transform = "scale(1.05)";
        imgEl.onmouseout = () => imgEl.style.transform = "scale(1)";
        const check = document.createElement("div");
        check.style.cssText = "position:absolute;top:4px;right:4px;width:22px;height:22px;background:var(--gold);border-radius:50%;display:none;align-items:center;justify-content:center;font-size:12px;color:#000;font-weight:bold";
        check.textContent = "✓";
        div.appendChild(imgEl);
        div.appendChild(check);
        div.onclick = () => {
          const seleccionadas = grid.querySelectorAll(".seleccionada-img").length;
          if (div.classList.contains("seleccionada-img")) {
            div.classList.remove("seleccionada-img");
            div.style.borderColor = "transparent";
            check.style.display = "none";
          } else {
            if (seleccionadas >= 8) return mostrarMensaje("Máximo 8 imágenes.", "err");
            div.classList.add("seleccionada-img");
            div.style.borderColor = "var(--gold)";
            check.style.display = "flex";
          }
          const total = grid.querySelectorAll(".seleccionada-img").length;
          document.getElementById("imagenes-seleccionadas-count").textContent = `${total} imagen${total !== 1 ? "es" : ""} seleccionada${total !== 1 ? "s" : ""}`;
          // Controlar banco según selección
          const bancoBtns = document.querySelectorAll("[data-banco]");
          const bancoAviso = document.getElementById("banco-aviso");
          const limpiarBtn = document.getElementById("btn-limpiar-seleccion");
          if (total > 0) {
            bancoBtns.forEach(b => { b.style.opacity = "0.4"; b.style.pointerEvents = "none"; });
            if (bancoAviso) bancoAviso.style.display = "block";
            if (limpiarBtn) limpiarBtn.style.display = "inline-block";
          } else {
            bancoBtns.forEach(b => { b.style.opacity = "1"; b.style.pointerEvents = "auto"; });
            if (bancoAviso) bancoAviso.style.display = "none";
            if (limpiarBtn) limpiarBtn.style.display = "none";
            this.estado.imagenesSeleccionadas = [];
          }
          // Actualizar materiales del estado
          this.estado.imagenesSeleccionadas = Array.from(grid.querySelectorAll(".seleccionada-img")).map(el => ({
            url: el.dataset.url, ancho: parseInt(el.dataset.ancho), alto: parseInt(el.dataset.alto)
          }));
        };
        grid.appendChild(div);
      });
    } catch(e) {
      grid.innerHTML = '<p class="ayuda" style="grid-column:1/-1;text-align:center;padding:20px">Error buscando. Intenta de nuevo.</p>';
    }
  },

  elegirNicho(btn) {
    document.querySelectorAll(".chip-nicho").forEach(b => b.classList.remove("activo"));
    btn.classList.add("activo");
    const nicho = btn.dataset.nicho;
    const temas = TEMAS_POR_NICHO[nicho] || [];
    const cont = document.getElementById("lista-temas-sugeridos");
    const wrap = document.getElementById("temas-sugeridos");
    cont.innerHTML = temas.map(t => `
      <button class="tema-sugerido-btn" onclick="W.usarTema('${t.replace(/'/g, "\'")}')" type="button">
        💡 ${t}
      </button>
    `).join("");
    wrap.style.display = temas.length ? "block" : "none";
  },

  usarTema(tema) {
    document.getElementById("tema").value = tema;
    document.getElementById("tema").focus();
  },

  actualizarTiempoEstimado() {
    const duracion = this.estado.duracion || "corto";
    const TIEMPOS = { corto: "~2 min", medio: "~3 min", largo: "~5 min" };
    const el = document.querySelector('.sidebar-step-time[data-paso="5"]') ||
               document.querySelectorAll('.sidebar-step-time')[4];
    if (el) el.textContent = TIEMPOS[duracion] || "2-5 min";
    // También en el paso 5
    const el2 = document.getElementById("tiempo-estimado-produccion");
    if (el2) el2.textContent = TIEMPOS[duracion] || "2-5 min";
  },

  elegirDuracion(btn) {
    document.querySelectorAll("[data-duracion]").forEach((b) => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    this.estado.duracion = btn.dataset.duracion;
  },

  async irAPaso2() {
    const tema = document.getElementById("tema").value.trim();
    if (tema.length < 5) {
      mostrarMensaje("Escribe el tema de tu video (mínimo 5 caracteres).", "err");
      return;
    }
    this.estado.tema = tema;
    limpiarMensaje();
    // Generamos el guion en background mientras el usuario elige formato
    this.estado.guion = "";
    this.estado.terminos = [];
    this._generarGuionEnBackground();
    this._mostrarPaso(2);
  },

  async _generarGuionEnBackground() {
    try {
      const datos = await API.pedir("/api/guion", {
        method: "POST",
        body: JSON.stringify({ tema: this.estado.tema, duracion: this.estado.duracion }),
      });
      this.estado.guion = datos.guion || "";
      this.estado.terminos = datos.terminos || [];
      // Si el usuario ya llegó al paso 3, actualizar el textarea
      const ta = document.getElementById("guion-editable");
      if (ta && this.estado.guion) ta.value = this.estado.guion;
      document.getElementById("guion-loading").style.display = "none";
    } catch (e) {
      this.estado.guion = "";
    }
  },

  // ---- Paso 2 ----
  elegirFormato(btn) {
    document.querySelectorAll("[data-formato]").forEach((b) => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    this.estado.formato = btn.dataset.formato;
  },

  elegirFuente(btn) {
    document.querySelectorAll("[data-banco]").forEach(b => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    this.estado.fuente = btn.dataset.banco;
  },

  // ---- Paso 3 ----
  async generarGuion() {
    if (!this._intentosGuion) this._intentosGuion = 0;
    const MAX_INTENTOS = 5;
    const ta = document.getElementById("guion-editable");
    const loading = document.getElementById("guion-loading");
    const btn = document.getElementById("btn-regenerar");
    const contadorEl = document.getElementById("guion-contador");
    ta.style.display = "none";
    if (loading) { loading.style.display = "block"; loading.textContent = "Redactando tu guion..."; }
    if (btn) btn.disabled = true;
    limpiarMensaje();
    try {
      const datos = await API.pedir("/api/guion", {
        method: "POST",
        body: JSON.stringify({ tema: this.estado.tema, duracion: this.estado.duracion }),
      });
      this.estado.guion = datos.guion || "";
      this.estado.terminos = datos.terminos || [];
      ta.value = this.estado.guion;
      this._intentosGuion++;
      if (contadorEl) {
        const restantes = MAX_INTENTOS - this._intentosGuion;
        contadorEl.textContent = restantes > 0 ? `${restantes} generaciones restantes` : "Límite alcanzado — edita el guion a tu gusto";
      }
      if (btn) {
        if (this._intentosGuion >= MAX_INTENTOS) {
          btn.disabled = true;
          btn.textContent = "Límite alcanzado";
        } else {
          btn.disabled = false;
          btn.textContent = `↺ Generar otro guion`;
        }
      }
    } catch (e) {
      mostrarMensaje("No pudimos generar el guion. Intenta de nuevo.", "err");
      if (btn) { btn.disabled = false; btn.textContent = "↺ Generar otro guion"; }
    } finally {
      ta.style.display = "block";
      if (loading) loading.style.display = "none";
    }
    if (this.pasoActual !== 3) this._mostrarPaso(3);
  },

  regenerarGuion() {
    this.generarGuion();
  },

  // ---- Paso 4: voz ----
  actualizarGuionNarracion() {
    const guion = document.getElementById("guion")?.value?.trim();
    const preview = document.getElementById("guion-narracion-preview");
    if (preview) {
      if (guion && guion.length > 10) {
        preview.style.color = "rgba(255,255,255,.75)";
        preview.style.fontStyle = "normal";
        preview.textContent = guion;
      } else {
        preview.style.color = "rgba(255,255,255,.4)";
        preview.style.fontStyle = "italic";
        preview.textContent = "El guion aparecerá aquí una vez que lo escribas en el paso anterior.";
      }
    }
  },
  elegirModoVoz(btn) {
    this.actualizarGuionNarracion();
    document.querySelectorAll(".voz-tab").forEach((b) => b.classList.remove("activo"));
    btn.classList.add("activo");
    const modo = btn.dataset.modo;
    this.estado.modoVoz = modo;
    ["lista", "premium", "propia", "ninguna"].forEach((m) => {
      document.getElementById(`panel-voz-${m}`).style.display = m === modo ? "block" : "none";
    });
    this.estado.sinNarracion = modo === "ninguna";
    this.estado.audioPropio = "";
    this.estado.vozPremiumId = "";
    document.getElementById("audio-personalizado").value = "";
    document.getElementById("voz-premium-elegida").value = "";
    document.getElementById("sin-narracion").value = modo === "ninguna" ? "1" : "";
    if (modo === "propia") document.getElementById("archivo-narracion").click();
  },

  // ---- Paso 4: música ----
  alternarMusica(modo) {
    // Resetear todos los tabs
    ["premium","estandar","ninguna"].forEach(m => {
      const btn = document.getElementById("btn-musica-" + m);
      if (btn) btn.className = "musica-tab-btn" + (m === modo ? " activo" : "");
    });
    // Mostrar/ocultar secciones
    const secciones = { premium: "seccion-musica-premium", estandar: "seccion-musica-estandar", ninguna: "seccion-musica-ninguna" };
    Object.entries(secciones).forEach(([m, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = m === modo ? "block" : "none";
    });
    // Si elige sin música, limpiar selección
    if (modo === "ninguna") {
      document.getElementById("musica-premium-url").value = "";
      document.getElementById("musica").value = "";
      this.estado.musicaPremiumUrl = "";
      this.estado.musicaArchivo = "";
      // Pausar audio si estaba reproduciendo
      const audio = document.getElementById("reproductor-musica");
      if (audio && !audio.paused) audio.pause();
    }
  },

  async buscarAnimo(btn) {
    document.querySelectorAll("[data-animo]").forEach((b) => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    const cont = document.getElementById("lista-musica-premium");
    const nombreAnimo = (btn.querySelector(".animo-name") || btn.querySelector(".tarjeta-titulo") || btn).textContent.toLowerCase();
    cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">Buscando canciones ${nombreAnimo}…</p>`;
    try {
      const r = await API.pedir(`/api/musicas/premium?animo=${btn.dataset.animo}`);
      const pistas = r?.pistas || [];
      if (!pistas.length) {
        cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">No encontramos canciones para ese ánimo. Prueba con otro.</p>`;
        return;
      }
      cont.innerHTML = "";
      cont.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0 8px;border:none;max-height:none;overflow:visible";
      pistas.forEach((p, idx) => {
        const card = document.createElement("div");
        const sel = idx === 0;
        card.style.cssText = "border:1px solid " + (sel ? "var(--gold)" : "rgba(255,255,255,.08)") + ";background:" + (sel ? "rgba(214,178,94,.06)" : "rgba(255,255,255,.02)") + ";padding:10px 12px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;gap:6px";
        card.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre.replace(/</g,"&lt;")}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(p.artista||"").replace(/</g,"&lt;")}</div>
            </div>
            <div class="can-chk" style="width:16px;height:16px;border-radius:50%;flex-shrink:0;${sel ? "background:var(--gold);color:#000;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center" : "border:1px solid rgba(255,255,255,.15);margin-top:2px"}">${sel ? "✓" : ""}</div>
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn-esc-can" type="button" style="background:rgba(214,178,94,.08);border:1px solid rgba(214,178,94,.25);color:var(--gold);font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;cursor:pointer;font-family:inherit;white-space:nowrap">▶ Escuchar</button>
          </div>
        `;
        // Seleccionar
        card.onclick = (e) => {
          if (e.target.classList.contains("btn-esc-can")) return;
          cont.querySelectorAll("[style*='border']").forEach(t => {
            t.style.border = "1px solid rgba(255,255,255,.08)";
            t.style.background = "rgba(255,255,255,.02)";
            const ch = t.querySelector(".can-chk");
            if (ch) { ch.style.cssText = "width:16px;height:16px;border-radius:50%;flex-shrink:0;border:1px solid rgba(255,255,255,.15);margin-top:2px"; ch.textContent = ""; }
          });
          card.style.border = "1px solid var(--gold)";
          card.style.background = "rgba(214,178,94,.06)";
          const ch = card.querySelector(".can-chk");
          if (ch) { ch.style.cssText = "width:16px;height:16px;border-radius:50%;flex-shrink:0;background:var(--gold);color:#000;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center"; ch.textContent = "✓"; }
          this.estado.musicaPremiumUrl = p.muestra;
          this.estado.musicaArchivo = "";
          document.getElementById("musica-premium-url").value = p.muestra;
          document.getElementById("musica").value = "";
        };
        // Escuchar
        const btn = card.querySelector(".btn-esc-can");
        btn.onclick = (e) => {
          e.stopPropagation();
          const audio = document.getElementById("reproductor-musica");
          if (audio.dataset.actual === p.muestra && !audio.paused) {
            audio.pause(); btn.textContent = "▶ Escuchar"; return;
          }
          document.querySelectorAll(".btn-esc-can").forEach(b => b.textContent = "▶ Escuchar");
          audio.src = p.muestra; audio.dataset.actual = p.muestra; audio.play();
          btn.textContent = "⏸ Pausar";
          audio.onended = () => { btn.textContent = "▶ Escuchar"; };
        };
        // Seleccionar primera por defecto
        if (sel) {
          this.estado.musicaPremiumUrl = p.muestra;
          document.getElementById("musica-premium-url").value = p.muestra;
        }
        cont.appendChild(card);
      });
    } catch (e) {
      cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">No pudimos cargar la música en este momento.</p>`;
    }
  },

  // ---- Paso 4: subtítulos ----
    elegirTransicion(btn) {
    document.querySelectorAll(".trans-card").forEach(b => {
      b.classList.remove("elegida");
      b.style.borderColor = "rgba(255,255,255,.15)";
      b.style.background = "";
    });
    btn.classList.add("elegida");
    btn.style.borderColor = "#D6B25E";
    btn.style.background = "rgba(214,178,94,.08)";
    this.estado.transicion = btn.dataset.trans;
    // Actualizar preview
    const boxB = document.getElementById("trans-box-b");
    const desc = document.getElementById("trans-desc");
    const arrow = document.getElementById("trans-arrow");
    if (!boxB) return;
    const configs = {
      "None":    { anim: "none",                    desc: "Corte directo — sin efectos entre imágenes", arrow: "→" },
      "FadeIn":  { anim: "fadeInTrans .7s ease",    desc: "Fundido de entrada — suave y elegante", arrow: "✦" },
      "FadeOut": { anim: "fadeOutTrans .7s ease",   desc: "Fundido de salida — cinematográfico", arrow: "◈" },
      "SlideIn": { anim: "slideInTrans .5s ease",   desc: "Deslizamiento de entrada — dinámico y moderno", arrow: "⟶" },
      "ZoomIn":  { anim: "zoomInTrans .6s ease",    desc: "Zoom de entrada — impactante y visual", arrow: "⊕" },
      "Shuffle": { anim: "shuffleTrans .5s ease",   desc: "Transición aleatoria en cada imagen", arrow: "🎲" },
    };
    const cfg = configs[btn.dataset.trans] || configs["None"];
    if (desc) desc.textContent = cfg.desc;
    if (arrow) arrow.textContent = cfg.arrow;
    // Animar preview
    boxB.style.animation = "none";
    boxB.offsetHeight; // reflow
    boxB.style.animation = cfg.anim;
    // Repetir animación
    clearInterval(this._transInterval);
    if (cfg.anim !== "none") {
      this._transInterval = setInterval(() => {
        boxB.style.animation = "none";
        boxB.offsetHeight;
        boxB.style.animation = cfg.anim;
      }, 2000);
    } else {
      clearInterval(this._transInterval);
    }
  },

  toggleSubtitulos() {
    const toggle = document.getElementById("toggle-subtitulos");
    const activo = toggle.classList.toggle("activo");
    document.getElementById("subtitulos-activos").value = activo ? "1" : "0";
    document.getElementById("opciones-subtitulos").style.display = activo ? "block" : "none";
    this.estado.subtitulosActivos = activo;
  },

  elegirColorSub(chip) {
    document.querySelectorAll(".color-chip").forEach(c=>c.classList.remove("elegido"));
    chip.classList.add("elegido");
    document.getElementById("subtitulos-color").value = chip.dataset.color;
    this.estado.subtitulosColor = chip.dataset.color;
    this.actualizarPreviewSub();
  },

  actualizarPreviewSub() {
    const color = document.getElementById("subtitulos-color").value;
    this.estado.subtitulosColor = color;
    document.getElementById("preview-subtitulo").style.color = color;
  },

  elegirFuenteSub(btn) {
    document.querySelectorAll("[data-fuente]")
      .forEach(b=>{ b.classList.remove("elegida"); });
    btn.classList.add("elegida");
    this.estado.subtitulosFuente = btn.dataset.fuente;
    document.getElementById("subtitulos-fuente").value = btn.dataset.fuente;
    // Preview fiel a las fuentes reales del motor
    // BeVietnamPro-Bold → sans-serif bold
    // BeVietnamPro-Medium → sans-serif normal  
    // Charm-Regular → cursiva serif ligera
    // UTM Kabel KT → sans-serif condensada uppercase
    // Charm-Bold → cursiva serif gruesa
    const mapaFuentes = {
      clasica:    { family: "'Jost', sans-serif",        weight: "700", size: "21px", letterSpacing: "0.5px",  transform: "none",      style: "normal",  desc: "BeVietnamPro Bold — gruesa y directa" },
      ligera:     { family: "'Jost', sans-serif",        weight: "400", size: "19px", letterSpacing: "1px",    transform: "none",      style: "normal",  desc: "BeVietnamPro Medium — limpia y legible" },
      elegante:   { family: "Georgia, serif",            weight: "400", size: "19px", letterSpacing: "0.5px",  transform: "none",      style: "italic",  desc: "Charm Regular — cursiva elegante" },
      moderna:    { family: "'Arial Narrow', sans-serif",weight: "700", size: "20px", letterSpacing: "4px",    transform: "uppercase", style: "normal",  desc: "UTM Kabel — compacta en mayúsculas" },
      redondeada: { family: "Georgia, serif",            weight: "700", size: "20px", letterSpacing: "0.5px",  transform: "none",      style: "italic",  desc: "Charm Bold — cursiva con fuerza" },
      viral:      { family: "'Jost', sans-serif",        weight: "300", size: "18px", letterSpacing: "2px",    transform: "uppercase", style: "normal",  desc: "BeVietnamPro Medium — espaciada" },
    };
    const cfg = mapaFuentes[btn.dataset.fuente] || mapaFuentes.clasica;
    const el = document.getElementById("preview-subtitulo");
    el.style.fontFamily = cfg.family;
    el.style.fontWeight = cfg.weight;
    el.style.fontSize = cfg.size;
    el.style.letterSpacing = cfg.letterSpacing;
    el.style.textTransform = cfg.transform;
    el.style.fontStyle = cfg.style || "normal";
    // Mostrar descripción de la fuente real
    const descEl = document.getElementById("preview-fuente-desc");
    if (descEl) descEl.textContent = cfg.desc;
  },

  // ---- Banco de ideas por nicho ----
  elegirNicho(btn) {
    document.querySelectorAll(".nicho-btn").forEach(b => {
      b.classList.remove("elegido");
      b.style.borderColor = "rgba(255,255,255,.08)";
      b.style.background = "rgba(255,255,255,.02)";
      b.style.color = "rgba(255,255,255,.75)";
    });
    btn.classList.add("elegido");
    btn.style.borderColor = "var(--gold)";
    btn.style.background = "rgba(214,178,94,.08)";

    const nicho = btn.dataset.nicho;
    const IDEAS = {
      restaurante: [
        "3 platos de nuestra carta que se agotan todos los días",
        "Así preparamos nuestro plato estrella desde cero",
        "Por qué nuestros clientes vuelven cada semana",
        "El secreto detrás de nuestra sazón especial",
        "Reserva tu mesa este fin de semana — esto es lo que te espera",
        "De la cocina a tu mesa en menos de 20 minutos",
        "Los ingredientes frescos que usamos cada mañana",
        "Menú del día con todo incluido a precio justo",
        "Celebra tu ocasión especial con nosotros",
        "Lo que dicen nuestros clientes después de su primera visita",
      ],
      salon: [
        "Transforma tu look en menos de una hora con nosotros",
        "Los 3 tratamientos más pedidos este mes en nuestro salón",
        "Antes y después de una sesión completa de color",
        "Por qué el balayage es la técnica del momento",
        "Agenda tu cita hoy — cupos limitados esta semana",
        "Así cuidamos tu cabello durante cada proceso",
        "El corte perfecto para tu tipo de rostro",
        "Keratina sin daño: así lo hacemos nosotros",
        "Nuestros productos son 100% profesionales",
        "Regala una experiencia de belleza esta semana",
      ],
      gimnasio: [
        "Empieza tu transformación hoy — primer mes con descuento",
        "3 ejercicios para tonificar sin necesidad de pesas",
        "Así son nuestras clases funcionales en 60 segundos",
        "Resultados reales de nuestros miembros en 30 días",
        "Tu rutina de mañana en nuestro gimnasio — así se ve",
        "Por qué entrenar con instructor hace la diferencia",
        "Plan de nutrición incluido con tu membresía",
        "Clases grupales que no parecen ejercicio",
        "Instala el hábito del ejercicio en solo 3 semanas",
        "Contamos con los equipos más modernos de la ciudad",
      ],
      tienda: [
        "Nuevas llegadas esta semana — no te las pierdas",
        "Los 5 productos más vendidos del mes",
        "Así combinamos esta prenda para 3 looks distintos",
        "Envío gratis en compras mayores a 100 mil pesos",
        "Descubre nuestra colección exclusiva de temporada",
        "Por qué nuestros clientes nos recomiendan siempre",
        "Paga a cuotas sin intereses con tu tarjeta",
        "Visítanos y llévate un descuento especial hoy",
        "Así se ve esta prenda en talla real",
        "Asesoría de imagen gratis con tu compra",
      ],
      inmobiliaria: [
        "Conoce este apartamento disponible ahora en Medellín",
        "3 razones para invertir en finca raíz este año",
        "Así ayudamos a nuestros clientes a encontrar su hogar",
        "Este es el barrio que más valorización tuvo este año",
        "Cómo financiar tu primer inmueble paso a paso",
        "Tour virtual por nuestra propiedad destacada del mes",
        "El momento perfecto para comprar vivienda es ahora",
        "Arrienda o compra — te explicamos cuál conviene más",
        "Nuestros clientes hablan de su experiencia con nosotros",
        "Propiedades desde 200 millones en zonas premium",
      ],
      clinica: [
        "3 señales de que debes visitar a nuestro especialista",
        "Así es una consulta con nosotros paso a paso",
        "Por qué la prevención es más barata que el tratamiento",
        "Nuestro equipo médico tiene más de 10 años de experiencia",
        "Agenda tu cita hoy — atención el mismo día",
        "Los procedimientos más solicitados este mes",
        "Tecnología de punta para tu diagnóstico",
        "Tu salud no puede esperar — actúa ahora",
        "Atención personalizada para toda tu familia",
        "Resultados de nuestros pacientes en los últimos 6 meses",
      ],
      educacion: [
        "Lo que aprenderás en nuestro curso en solo 4 semanas",
        "3 habilidades que te harán ganar más dinero este año",
        "Así transformamos la vida de nuestros estudiantes",
        "Inscríbete antes del viernes y ahorra el 30%",
        "Aprende a tu ritmo desde cualquier lugar",
        "Por qué nuestro método funciona cuando otros no",
        "Testimonios reales de estudiantes que ya cambiaron su vida",
        "Certificado avalado incluido con tu matrícula",
        "Clases en vivo con expertos de la industria",
        "Empieza gratis con nuestra clase de prueba",
      ],
      emprendedor: [
        "Cómo empecé desde cero y hoy tengo mi propio negocio",
        "3 errores que todo emprendedor comete al iniciar",
        "El producto o servicio que me cambió la vida",
        "Así manejo mis finanzas como emprendedor",
        "Por qué decidí trabajar para mí y no para otros",
        "Un día normal en mi negocio — así se ve",
        "Los clientes ideales que busco para mi marca",
        "Colabora conmigo — así puedes trabajar juntos",
        "El consejo que le daría a alguien que quiere emprender",
        "Mis resultados después de 6 meses de trabajo constante",
      ],
    };

    const ideas = IDEAS[nicho] || [];
    const nombres = {
      restaurante: "🍽️ Restaurante",
      salon: "💇 Salón / Peluquería",
      gimnasio: "💪 Gimnasio",
      tienda: "🛍️ Tienda",
      inmobiliaria: "🏠 Inmobiliaria",
      clinica: "🏥 Clínica",
      educacion: "📚 Educación",
      emprendedor: "🚀 Emprendedor",
    };

    document.getElementById("ideas-titulo").textContent = "Ideas para " + (nombres[nicho] || nicho);
    const lista = document.getElementById("ideas-lista");
    lista.innerHTML = ideas.map((idea, i) => `
      <div style="border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);padding:14px 16px;display:flex;align-items:center;gap:12px;transition:all .2s"
        onmouseover="this.style.borderColor='rgba(214,178,94,.25)';this.style.background='rgba(214,178,94,.04)'"
        onmouseout="this.style.borderColor='rgba(255,255,255,.07)';this.style.background='rgba(255,255,255,.02)'">
        <span style="font-size:11px;color:rgba(214,178,94,.4);font-family:'Playfair Display',serif;font-style:italic;flex-shrink:0">${String(i+1).padStart(2,'0')}</span>
        <span style="font-size:13px;color:rgba(255,255,255,.75);flex:1;line-height:1.4">${idea}</span>
        <button onclick="W.producirIdea('${idea.replace(/'/g,"\'")}'); event.stopPropagation()"
          style="background:#D6B25E;color:#07070A;border:none;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:8px 14px;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">
          Producir
        </button>
      </div>
    `).join("");
    document.getElementById("ideas-nicho").style.display = "block";
  },

  producirIdea(tema) {
    // Ir a la pestaña producir y prellenar el tema
    Panel.cambiarPestana("producir");
    setTimeout(() => {
      const input = document.getElementById("tema");
      if (input) {
        input.value = tema;
        input.dispatchEvent(new Event("input"));
        W._mostrarPaso(1);
        input.focus();
        // Scroll al inicio
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 150);
  },

  // ---- Paso 5: resumen ----
  pintarResumen() {
    // Sincronizar desde el DOM antes de pintar
    this.estado.guion = document.getElementById("guion-editable").value || this.estado.guion;
    this.estado.voz = document.getElementById("voz")?.value || this.estado.voz;
    this.estado.volumen = Number(document.getElementById("volumen-musica").value);

    const ETIQUETAS_DURACION = { corto: "30 s", medio: "60 s", largo: "90 s" };
    const ETIQUETAS_FORMATO = { "9:16": "Vertical 9:16", "16:9": "Horizontal 16:9", "1:1": "Cuadrado 1:1" };
    const ETIQUETAS_VOZ = { lista: "Voz estándar", premium: "Voz premium", propia: "Mi narración", ninguna: "Sin voz" };

    let musica = "Aleatoria";
    if (this.estado.musicaPremiumUrl) musica = "Premium (Jamendo)";
    else if (this.estado.musicaArchivo) musica = "Tu canción";

    const items = [
      { label: "Tema", valor: this.estado.tema },
      { label: "Duración", valor: ETIQUETAS_DURACION[this.estado.duracion] },
      { label: "Formato", valor: ETIQUETAS_FORMATO[this.estado.formato] },
      { label: "Banco de video", valor: this.estado.fuente === "pexels" ? "Banco Prime" : "Banco Plus" },
      { label: "Narración", valor: ETIQUETAS_VOZ[this.estado.modoVoz] },
      { label: "Música", valor: musica },
      { label: "Subtítulos", valor: this.estado.subtitulosActivos ? "Activados" : "Sin subtítulos" },
      { label: "Volumen música", valor: this.estado.volumen + "%" },
    ];

    // Actualizar nombre en preview de voz
    const elNombreVoz = document.getElementById("preview-voz-nombre");
    if (elNombreVoz) {
      const NOMBRES_VOZ = { lista: "Voz estándar", premium: "Voz ElevenLabs", propia: "Tu narración", ninguna: "Sin voz" };
      elNombreVoz.textContent = NOMBRES_VOZ[this.estado.modoVoz] || "Voz estándar";
    }
    document.getElementById("resumen-grid").innerHTML = items.map(i => `
      <div class="resumen-item">
        <div class="resumen-item-label">${i.label}</div>
        <div class="resumen-item-valor">${String(i.valor).replace(/</g,"&lt;")}</div>
      </div>
    `).join("");
  },

  // ---- Preview de voz en paso 5 ----
  async previewVozFinal() {
    const btn = document.getElementById("btn-preview-voz");
    const audio = document.getElementById("audio-preview-voz-final");
    if (!audio) return;

    // Si está reproduciendo, pausar
    if (!audio.paused) {
      audio.pause();
      btn.textContent = "▶ Escuchar";
      return;
    }

    // Obtener primeras palabras del guion
    const guion = document.getElementById("guion-editable")?.value || this.estado.guion || "";
    const texto = guion.split(" ").slice(0, 12).join(" ") + "...";
    if (!texto || texto === "...") {
      mostrarMensaje("Genera el guion primero en el paso 3.", "err");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Generando...";

    try {
      const voz = document.getElementById("voz")?.value || this.estado.voz || "es-CO-SalomeNeural";
      const vozPremium = document.getElementById("voz-premium-elegida")?.value || "";
      const sinNarracion = document.getElementById("sin-narracion")?.value === "1";

      if (sinNarracion) {
        mostrarMensaje("Seleccionaste narración propia — no hay voz para previsualizar.", "ok");
        btn.disabled = false;
        btn.textContent = "▶ Escuchar";
        return;
      }

      const r = await API.pedir("/api/preview-voz", {
        method: "POST",
        body: JSON.stringify({ texto, voz: vozPremium ? `elevenlabs:${vozPremium}` : voz }),
      });

      if (r.url) {
        audio.src = r.url;
        audio.play();
        btn.textContent = "⏸ Pausar";
        btn.disabled = false;
        audio.onended = () => { btn.textContent = "▶ Escuchar"; };
      }
    } catch(e) {
      mostrarMensaje("No pudimos generar el preview de voz.", "err");
      btn.disabled = false;
      btn.textContent = "▶ Escuchar";
    }
  },

  // ---- Producir ----
  async producir() {
    // Límite: un video a la vez
    if (this._produciendo) {
      mostrarMensaje("Ya tienes un video en producción. Espera a que termine antes de producir otro.", "err");
      return;
    }
    limpiarMensaje();
    const boton = document.getElementById("btn-producir");
    boton.disabled = true;
    this._produciendo = true;

    // Pantalla de carga inmediata
    const pasoPanel = document.getElementById("paso-5-contenido") || document.querySelector('[data-paso="5"] .paso-body');
    const overlay = document.createElement("div");
    overlay.id = "overlay-produciendo";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(7,7,10,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;backdrop-filter:blur(8px)";
    overlay.innerHTML = `
      <div style="text-align:center;max-width:420px;padding:0 24px">
        <div style="font-family:'Playfair Display',serif;font-size:28px;color:#F0EDE5;margin-bottom:8px">Viraliza<span style="color:#D6B25E">.</span></div>
        <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(214,178,94,.6);margin-bottom:40px">Produciendo tu video</p>
        <div id="overlay-paso-actual" style="font-size:18px;color:#F0EDE5;margin-bottom:8px;min-height:28px">Iniciando producción…</div>
        <div id="overlay-detalle" style="font-size:12px;color:rgba(255,255,255,.35);margin-bottom:32px;min-height:18px">Esto puede tomar 2-5 minutos</div>
        <div style="background:rgba(255,255,255,.06);height:2px;border-radius:1px;overflow:hidden;margin-bottom:8px">
          <div id="overlay-barra" style="height:100%;background:linear-gradient(90deg,rgba(214,178,94,.4),#D6B25E);width:0%;transition:width 1s"></div>
        </div>
        <div id="overlay-porcentaje" style="font-size:11px;color:rgba(214,178,94,.5);text-align:right">0%</div>
        <p style="font-size:11px;color:rgba(255,255,255,.2);margin-top:24px">Puedes cerrar esta ventana — recibirás un correo cuando esté listo</p>
      </div>
    `;
    document.body.appendChild(overlay);

    const pasos = [
      { texto: "Redactando el guion…", detalle: "Creando el guion de ventas para tu negocio", pct: 15 },
      { texto: "Sintetizando la voz…", detalle: "Generando la narración en español colombiano", pct: 30 },
      { texto: "Buscando imágenes…", detalle: "Encontrando las imágenes perfectas para tu tema", pct: 45 },
      { texto: "Preparando la música…", detalle: "Ajustando el volumen y la mezcla de audio", pct: 60 },
      { texto: "Añadiendo subtítulos…", detalle: "Sincronizando el texto con la narración", pct: 75 },
      { texto: "Renderizando el video…", detalle: "Combinando todos los elementos en HD", pct: 88 },
      { texto: "Últimos toques…", detalle: "Aplicando la calidad final al video", pct: 95 },
    ];
    let pasoIdx = 0;
    const animarPasos = setInterval(() => {
      if (pasoIdx < pasos.length) {
        const p = pasos[pasoIdx];
        const el1 = document.getElementById("overlay-paso-actual");
        const el2 = document.getElementById("overlay-detalle");
        const bar = document.getElementById("overlay-barra");
        const pct = document.getElementById("overlay-porcentaje");
        if (el1) el1.textContent = p.texto;
        if (el2) el2.textContent = p.detalle;
        if (bar) bar.style.width = p.pct + "%";
        if (pct) pct.textContent = p.pct + "%";
        pasoIdx++;
      }
    }, 25000);

    boton.textContent = "Produciendo…";
    try {
      await API.pedir("/api/videos", {
        method: "POST",
        body: JSON.stringify({
          tema: this.estado.tema,
          guion: document.getElementById("guion-editable").value || this.estado.guion,
          terminos: this.estado.terminos,
          voz: document.getElementById("voz")?.value || this.estado.voz,
          duracion: this.estado.duracion,
          formato: this.estado.formato,
          fuente: this.estado.fuente,
                    subtitulosActivos: document.getElementById("subtitulos-activos").value === "1",
          subtitulosColor: this.estado.subtitulosColor,
          subtitulosFuente: this.estado.subtitulosFuente,
          bgmArchivo: document.getElementById("musica").value,
          bgmPremiumUrl: document.getElementById("musica-premium-url").value,
          bgmVolumen: Number(document.getElementById("volumen-musica").value) / 100,
          materiales: Array.from(document.querySelectorAll("#lista-materiales-wizard .opcion-musica"))
            .map(f => f.dataset.archivo).filter(Boolean),
          audioPersonalizado: document.getElementById("audio-personalizado").value,
          vozPremium: document.getElementById("voz-premium-elegida").value,
          sinNarracion: document.getElementById("sin-narracion").value === "1",
          sinMusica: document.getElementById("btn-musica-ninguna")?.classList.contains("activo") || false,
          imagenesSeleccionadas: this.estado.imagenesSeleccionadas || [],
          transicion: this.estado.transicion || "None",
        }),
      });
      // Resetear el wizard
      this.estado = {
        tema: "", duracion: "corto", formato: "9:16", fuente: "pexels",
        guion: "", terminos: [], voz: "es-CO-SalomeNeural",
        modoVoz: "lista", vozPremiumId: "", audioPropio: "",
        sinNarracion: false, musicaArchivo: "", musicaPremiumUrl: "",
        volumen: 20, subtitulosActivos: true,
        subtitulosColor: "#FFFFFF", subtitulosFuente: "clasica",
      };
      document.getElementById("tema").value = "";
      document.getElementById("guion-editable").value = "";
      this._mostrarPaso(1);
      // Video encolado — mostrar confirmación y pasar a Mis Videos
      clearInterval(animarPasos);
      const ov = document.getElementById("overlay-produciendo");
      const paso = document.getElementById("overlay-paso-actual");
      const detalle = document.getElementById("overlay-detalle");
      const bar = document.getElementById("overlay-barra");
      const pct = document.getElementById("overlay-porcentaje");
      if (paso) paso.textContent = "¡Producción iniciada!";
      if (detalle) detalle.textContent = "Pasando a Mis Videos para ver el progreso…";
      if (bar) bar.style.width = "30%";
      if (pct) pct.textContent = "Iniciando…";
      setTimeout(() => {
        if (ov) ov.remove();
        // Evento GA4: video producido
        if (typeof gtag !== "undefined") {
          gtag("event", "video_producido", { event_category: "produccion", value: 1 });
        }
        mostrarMensaje("Tu video entró a producción. Lo verás listo en la pestaña Mis videos.", "ok");
        Panel.cambiarPestana("videos");
        Panel.refrescarVideos();
      }, 1200);
    } catch (e) {
      // Quitar overlay si hay error
      const ov = document.getElementById("overlay-produciendo");
      if (ov) ov.remove();
      clearInterval(animarPasos);

      // Mensajes de error claros según el tipo
      let msgError = e.message;
      if (e.message.includes("motor") || e.message.includes("502")) {
        msgError = "El motor de producción está ocupado en este momento. Espera un minuto e inténtalo de nuevo.";
      } else if (e.message.includes("Pexels") || e.message.includes("imágenes")) {
        msgError = "No encontramos imágenes para ese tema. Intenta con palabras más generales o sube tus propias imágenes.";
      } else if (e.message.includes("guion") || e.message.includes("Groq")) {
        msgError = "No pudimos generar el guion. Verifica tu conexión e inténtalo de nuevo.";
      } else if (e.message.includes("límite") || e.message.includes("402")) {
        msgError = "Alcanzaste el límite de videos de tu plan. Actualiza tu membresía para seguir produciendo.";
      } else if (e.message.includes("canción") || e.message.includes("música")) {
        msgError = "No pudimos preparar la música seleccionada. Prueba con otro ánimo o sin música.";
      }
      mostrarMensaje(msgError, "err");
    } finally {
      this._produciendo = false;
      boton.disabled = false;
      boton.textContent = "🎬 PRODUCIR VIDEO";
    }
  },
};

// ============================================================
//  Panel — pestañas, voces, música, videos
// ============================================================
const VOCES_ESPANOL = [
  { valor: "es-CO-SalomeNeural",  genero: "M", nombre: "Salomé",    descripcion: "Natural y cálida",         pais: "Colombia · Recomendada" },
  { valor: "es-CO-GonzaloNeural", genero: "H", nombre: "Gonzalo",   descripcion: "Serio y profesional",      pais: "Colombia · Recomendada" },
  { valor: "es-VE-PaolaNeural",   genero: "M", nombre: "Paola",     descripcion: "Cálida y expresiva",       pais: "Venezuela" },
  { valor: "es-VE-SebastianNeural",genero: "H", nombre: "Sebastián", descripcion: "Seguro y fluido",         pais: "Venezuela" },
  { valor: "es-EC-AndreaNeural",  genero: "M", nombre: "Andrea",    descripcion: "Clara y cercana",          pais: "Ecuador" },
  { valor: "es-EC-LuisNeural",    genero: "H", nombre: "Luis",      descripcion: "Directo y confiable",      pais: "Ecuador" },
  { valor: "es-PE-CamilaNeural",  genero: "M", nombre: "Camila",    descripcion: "Dulce y articulada",       pais: "Perú" },
  { valor: "es-PE-AlexNeural",    genero: "H", nombre: "Alex",      descripcion: "Neutral y profesional",    pais: "Perú" },
  { valor: "es-CL-CatalinaNeural",genero: "M", nombre: "Catalina",  descripcion: "Enérgica y moderna",      pais: "Chile" },
  { valor: "es-CL-LorenzoNeural", genero: "H", nombre: "Lorenzo",   descripcion: "Formal y claro",           pais: "Chile" },
];

const Panel = {
  temporizador: null,
  iniciar() {
    if (!API.token()) { location.href = "login.html"; return; }
    document.getElementById("nombre-usuario").textContent = localStorage.getItem("viraliza_nombre") || "";
    document.getElementById("salir").onclick = () => API.cerrarSesion();

    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.onclick = () => this.cambiarPestana(b.dataset.tab);
    });

    // Pedir permisos de notificación
    if (typeof pedirPermisosNotificacion === "function") {
      setTimeout(pedirPermisosNotificacion, 3000);
    }

    // Onboarding — mostrar solo la primera vez
    setTimeout(() => {
      if (!localStorage.getItem('viraliza_onboarding')) {
        const modal = document.getElementById('modal-onboarding');
        if (modal) {
          modal.style.display = 'flex';
          console.log('[Onboarding] modal mostrado');
        }
      } else {
        console.log('[Onboarding] ya visto, no mostrar');
      }
    }, 1500);

    // Voces estándar
    // Reemplazar el select por tarjetas con botón de escuchar
    const contenedorVoz = document.getElementById("panel-voz-lista");
    if (contenedorVoz) {
      const audioPreview = document.createElement("audio");
      audioPreview.id = "reproductor-voz-estandar";
      audioPreview.style.display = "none";
      contenedorVoz.appendChild(audioPreview);

      const hiddenVoz = document.createElement("input");
      hiddenVoz.type = "hidden";
      hiddenVoz.id = "voz";
      hiddenVoz.value = "es-CO-SalomeNeural";
      contenedorVoz.appendChild(hiddenVoz);

      // Grid de tarjetas 2 columnas
      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0 8px;overflow:visible";
      contenedorVoz.appendChild(grid);

      VOCES_ESPANOL.forEach((v, idx) => {
        const tarjeta = document.createElement("div");
        tarjeta.dataset.valor = v.valor;
        const sel = idx === 0;
        tarjeta.style.cssText = "border:1px solid " + (sel ? "var(--gold)" : "rgba(255,255,255,.08)") + ";background:" + (sel ? "rgba(214,178,94,.08)" : "rgba(255,255,255,.02)") + ";padding:12px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;gap:8px";
        const esH = v.genero === "H";
        const ac = esH ? "rgba(94,140,214,.15)" : "rgba(214,94,140,.15)";
        const ab = esH ? "rgba(94,140,214,.3)" : "rgba(214,94,140,.3)";
        const ai = esH ? "♂" : "♀";
        const aic = esH ? "#5E8CD6" : "#D65E8C";
        tarjeta.innerHTML = `<div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:${ac};border:1px solid ${ab};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;color:${aic};font-weight:700">${ai}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--ink)">${v.nombre}</div><div style="font-size:11px;color:var(--muted);margin-top:1px">${v.descripcion}</div></div><div class="voz-chk" style="width:18px;height:18px;border-radius:50%;${sel ? "background:var(--gold);color:#000;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center" : "border:1px solid rgba(255,255,255,.15)"}">${sel ? "✓" : ""}</div></div><div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:10px;color:var(--muted)">${v.pais}</span><button class="btn-ev" type="button" style="background:rgba(214,178,94,.08);border:1px solid rgba(214,178,94,.25);color:var(--gold);font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:5px 10px;cursor:pointer;font-family:inherit">▶ Escuchar</button></div>`;
        tarjeta.onclick = (e) => {
          if (e.target.classList.contains("btn-ev")) return;
          document.querySelectorAll("#panel-voz-lista [data-valor]").forEach(t => {
            t.style.border = "1px solid rgba(255,255,255,.08)";
            t.style.background = "rgba(255,255,255,.02)";
            const ch = t.querySelector(".voz-chk");
            if (ch) { ch.style.cssText = "width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.15)"; ch.textContent = ""; }
          });
          tarjeta.style.border = "1px solid var(--gold)";
          tarjeta.style.background = "rgba(214,178,94,.08)";
          const ch = tarjeta.querySelector(".voz-chk");
          if (ch) { ch.style.cssText = "width:18px;height:18px;border-radius:50%;background:var(--gold);color:#000;font-weight:700;font-size:10px;display:flex;align-items:center;justify-content:center"; ch.textContent = "✓"; }
          document.getElementById("voz").value = v.valor;
          W.estado.voz = v.valor;
        };
        const btn = tarjeta.querySelector(".btn-ev");
        let cargando = false;
        btn.onclick = async (e) => {
          e.stopPropagation();
          if (cargando) return;
          const audio = document.getElementById("reproductor-voz-estandar");
          if (audio.dataset.actual === v.valor && !audio.paused) { audio.pause(); btn.textContent = "▶ Escuchar"; return; }
          document.querySelectorAll("#panel-voz-lista .btn-ev").forEach(b => b.textContent = "▶ Escuchar");
          btn.textContent = "Cargando…"; cargando = true;
          try {
            const r = await fetch("/api/voces/preview?voz=" + encodeURIComponent(v.valor), { headers: { Authorization: "Bearer " + API.token() } });
            if (!r.ok) throw new Error();
            audio.src = URL.createObjectURL(await r.blob());
            audio.dataset.actual = v.valor;
            audio.play();
            btn.textContent = "⏸ Pausar";
            audio.onended = () => { btn.textContent = "▶ Escuchar"; };
          } catch { btn.textContent = "Error"; setTimeout(() => { btn.textContent = "▶ Escuchar"; }, 2000); }
          finally { cargando = false; }
        };
        grid.appendChild(tarjeta);
      });
    }

    // Zona de subir narración — solo se abre al tocar la zona, no el contenedor
    const zonaSubir = document.getElementById("zona-subir-narracion");
    if (zonaSubir) {
      zonaSubir.onclick = (e) => {
        e.stopPropagation();
        document.getElementById("archivo-narracion").click();
      };
    }

    // Voces premium
    this.cargarVocesPremium();

    // Música estándar (canciones propias)
    this.cargarMusicaEstandar();

    // Subida de música propia
    const linkSubirMusica = document.getElementById("abrir-subir-musica");
    const inputMusica = document.getElementById("archivo-musica");
    if (linkSubirMusica && inputMusica) {
      linkSubirMusica.onclick = (e) => { e.preventDefault(); inputMusica.click(); };
      inputMusica.onchange = (e) => this.subirMusica(e.target.files[0]);
    }

    // Subida de narración propia
    const inputNarracion = document.getElementById("archivo-narracion");
    if (inputNarracion) {
      inputNarracion.onchange = (e) => this.subirNarracion(e.target.files[0]);
    }


    const inputMaterial = document.getElementById("archivo-material-wizard");
    if (inputMaterial) {
      inputMaterial.onchange = (e) => Panel.subirMaterialesWizard(Array.from(e.target.files));
    }

    this.cargar();
  },

  _actualizarEstadoBancos(hayMateriales) {
    const bancoBtns = document.querySelectorAll("[data-banco]");
    const bancoAviso = document.getElementById("banco-aviso");
    const limpiarBtn = document.getElementById("btn-limpiar-seleccion");
    if (hayMateriales) {
      bancoBtns.forEach(b => { b.style.opacity = "0.4"; b.style.pointerEvents = "none"; });
      if (bancoAviso) { bancoAviso.style.display = "flex"; bancoAviso.querySelector("span").textContent = "✓ Usarás tus archivos propios — el banco automático no aplica"; }
      if (limpiarBtn) limpiarBtn.style.display = "inline-block";
    } else {
      bancoBtns.forEach(b => { b.style.opacity = "1"; b.style.pointerEvents = "auto"; });
      if (bancoAviso) bancoAviso.style.display = "none";
      if (limpiarBtn) limpiarBtn.style.display = "none";
    }
  },

  async subirMaterialesWizard(archivos) {
    if (!archivos.length) return;
    const cont = document.getElementById("lista-materiales-wizard");
    const yaSubidos = cont.querySelectorAll(".opcion-musica").length;
    const cuantosFaltan = 8 - yaSubidos;
    if (cuantosFaltan <= 0) {
      mostrarMensaje("Ya tienes el máximo de 8 archivos propios para este video.", "err");
      return;
    }
    const aSubir = archivos.slice(0, cuantosFaltan);
    cont.style.display = "block";
    for (const archivo of aSubir) {
      try {
        const formData = new FormData();
        formData.append("file", archivo);
        const r = await fetch("/api/materiales", {
          method: "POST",
          headers: { Authorization: "Bearer " + API.token() },
          body: formData,
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "No pudimos subir " + archivo.name);
        const fila = document.createElement("div");
        fila.className = "opcion-musica";
        fila.dataset.archivo = j.archivo;
        fila.innerHTML = `
          <span class="nombre" style="font-size:13px">${archivo.name.replace(/</g,"&lt;")}</span>
          <button class="boton-eliminar" type="button" title="Eliminar">✕</button>
        `;
        fila.querySelector(".boton-eliminar").onclick = async (e) => {
          e.stopPropagation();
          try {
            await API.pedir(`/api/materiales/${encodeURIComponent(j.archivo)}`, { method: "DELETE" });
            fila.remove();
            const quedan = cont.querySelectorAll(".opcion-musica").length;
            if (!quedan) cont.style.display = "none";
            W._actualizarEstadoBancos(quedan > 0);
          } catch(err) { mostrarMensaje(err.message, "err"); }
        };
        cont.appendChild(fila);
      } catch (e) {
        mostrarMensaje(e.message, "err");
      }
    }
    this._actualizarEstadoBancos(cont.querySelectorAll(".opcion-musica").length > 0);
    if (aSubir.length < archivos.length) {
      mostrarMensaje(`Solo se subieron ${aSubir.length} de ${archivos.length} archivos (límite: 8).`, "err");
    }
  },

  cambiarPestana(nombre) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("activo", b.dataset.tab === nombre));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("activo", p.dataset.panel === nombre));
    if (nombre === "videos") {
      clearTimeout(this.temporizador);
      this.refrescarVideos();
      const badge = document.getElementById("badge-videos");
      if (badge) badge.style.display = "none";
    }
    if (nombre === "cuenta") {
      if (typeof cargarReferidos === "function") cargarReferidos();
    }
  },

  async cargar() {
    try {
      const yo = await API.pedir("/api/yo");
      if (!yo) return;
      this.pintarCuota(yo.cuota);
      if (yo.esAdmin) {
        const sesion = document.querySelector(".sesion");
        const enlace = document.createElement("a");
        enlace.href = "admin.html";
        enlace.textContent = "Administración";
        enlace.style.cssText = "color:var(--gold);font-size:12px;letter-spacing:1.5px;text-transform:uppercase";
        sesion.insertBefore(enlace, sesion.lastElementChild);
      }
      await this.refrescarVideos();

      // Banner límite 80%
      if (yo.cuota) {
        const pct = yo.cuota.usados / yo.cuota.limite;
        if (pct >= 0.8 && pct < 1) {
          const restantes = yo.cuota.limite - yo.cuota.usados;
          const banner = document.createElement('div');
          banner.style.cssText = 'background:rgba(214,178,94,.08);border:1px solid rgba(214,178,94,.25);padding:12px 20px;margin:0 0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
          banner.innerHTML = `
            <span style="font-size:12px;color:rgba(214,178,94,.9)">⚠ Te quedan <strong>${restantes} video${restantes!==1?'s':''}</strong> este mes en tu plan ${yo.cuota.plan}.</span>
            <button onclick="Panel.cambiarPestana('membresia')" style="background:#D6B25E;color:#09090B;border:none;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;white-space:nowrap">Subir de plan</button>
          `;
          const listaVideos = document.getElementById('lista-videos');
          if (listaVideos && listaVideos.parentNode) {
            listaVideos.parentNode.insertBefore(banner, listaVideos);
          }
        }
      }
    } catch (e) {
      mostrarMensaje(e.message, "err");
    }
  },

  pintarCuota(cuota) {
    document.getElementById("plan-nombre").textContent = "Membresía " + cuota.plan;
    document.getElementById("cuota-usados").textContent = cuota.usados;
    document.getElementById("cuota-limite").textContent = cuota.limite;
    this.pintarPlanes(cuota.plan);
    // Actualizar página Mi cuenta
    const elPlan = document.getElementById("cuenta-plan-nombre");
    const elUsados = document.getElementById("cuenta-usados");
    const elLimite = document.getElementById("cuenta-limite");
    const elRenovacion = document.getElementById("cuenta-renovacion");
    if (elPlan) elPlan.textContent = cuota.plan;
    if (elUsados) elUsados.textContent = cuota.usados;
    if (elLimite) elLimite.textContent = cuota.limite;
    const campoTrans = document.getElementById("campo-transiciones");
    if (campoTrans) {
      const planesConTrans = ["Signature","Élite","Elite"];
      campoTrans.style.display = planesConTrans.includes(cuota.plan) ? "block" : "none";
    }
    // Mostrar brief profesional si aplica
    const wizardPanel = document.querySelector('[data-panel="producir"]');
    const briefPanel = document.getElementById("panel-brief-profesional");
    if (cuota.plan === "Profesional") {
      if (wizardPanel) wizardPanel.style.display = "none";
      if (briefPanel) briefPanel.style.display = "block";
    } else {
      if (wizardPanel) wizardPanel.style.display = "";
      if (briefPanel) briefPanel.style.display = "none";
    }
    const cuentaRenovacion = document.getElementById("cuenta-renovacion");
    if (cuentaRenovacion) cuentaRenovacion.textContent = cuota.expira ? new Date(cuota.expira).toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}) : "Sin expiración";
    const cuentaPlanNombre = document.getElementById("cuenta-plan-nombre");
    if (cuentaPlanNombre) cuentaPlanNombre.textContent = cuota.plan || "—";
    const cuentaUsados = document.getElementById("cuenta-usados");
    const cuentaLimite = document.getElementById("cuenta-limite");
    if (cuentaUsados) cuentaUsados.textContent = cuota.usados || 0;
    if (cuentaLimite) cuentaLimite.textContent = cuota.limite || 0;
    // Actualizar contador en navbar
    const navUsados = document.getElementById("nav-usados");
    const navLimite = document.getElementById("nav-limite");
    if (navUsados) navUsados.textContent = cuota.usados;
    if (navLimite) navLimite.textContent = cuota.limite;
    if (elRenovacion) {
      if (cuota.expira) {
        const fecha = new Date(cuota.expira).toLocaleDateString("es-CO", {day:"numeric", month:"long", year:"numeric"});
        elRenovacion.textContent = fecha;
      } else {
        elRenovacion.textContent = cuota.plan === "Inicial" ? "Plan gratuito" : "Sin fecha · Plan manual";
      }
    }
  },

  async enviarBrief() {
    const negocio = document.getElementById("brief-negocio")?.value?.trim();
    const url = document.getElementById("brief-url")?.value?.trim();
    const tono = document.getElementById("brief-tono")?.value;
    const descripcion = document.getElementById("brief-descripcion")?.value?.trim();
    const btn = document.getElementById("btn-enviar-brief");
    if (!negocio || !descripcion) {
      mostrarMensaje("Completa el nombre del negocio y la descripción.", "err");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Enviando brief…";
    try {
      const r = await API.pedir("/api/brief-profesional", {
        method: "POST",
        body: JSON.stringify({ negocio, url, tono, descripcion })
      });
      mostrarMensaje("✓ Brief enviado. Te entregamos tu video en 24-48 horas.", "ok");
      btn.textContent = "Brief enviado ✓";
      document.getElementById("brief-negocio").value = "";
      document.getElementById("brief-descripcion").value = "";
    } catch(e) {
      mostrarMensaje(e.message, "err");
      btn.disabled = false;
      btn.textContent = "Enviar brief";
    }
  },

  cerrarOnboarding(irAProducir = false) {
    const modal = document.getElementById('modal-onboarding');
    if (modal) modal.style.display = 'none';
    localStorage.setItem('viraliza_onboarding', '1');
    if (irAProducir) {
      this.cambiarPestana('producir');
      W._mostrarPaso(1);
      setTimeout(() => {
        const input = document.getElementById('tema');
        if (input) input.focus();
      }, 200);
    }
  },

  async cancelarPlan() {
    if (!confirm("¿Seguro que quieres cancelar tu membresía? Conservarás el acceso hasta que venza el período actual.")) return;
    const boton = document.getElementById("btn-cancelar-plan");
    boton.disabled = true;
    boton.textContent = "Cancelando…";
    try {
      await API.pedir("/api/cuenta/cancelar", { method: "POST" });
      mostrarMensaje("Tu membresía fue cancelada. Conservas el acceso hasta que venza.", "ok");
      await this.cargar();
    } catch(e) {
      mostrarMensaje(e.message, "err");
      boton.disabled = false;
      boton.textContent = "Cancelar membresía";
    }
  },

  async pintarPlanes(planActual) {
    if (this._planesCargados && this._planes?.length >= 4) return this.actualizarBotonesPlan(planActual);
    try {
      const { planes } = await API.pedir("/api/planes");
      this._planes = planes;
      this._planesCargados = true;
    } catch { return; }
    const FEATURES = {
      esencial: [
        "15 videos al mes",
        "Sin marca de agua — 100% tu marca",
        "Voces profesionales en español",
        "Sube tu propia narración de voz",
        "Buscador visual de imágenes",
        "Sube tus propias imágenes y videos",
      ],
      signature: [
        "50 videos al mes",
        "Sin marca de agua — 100% tu marca",
        "Voces profesionales en español",
        "Sube tu propia narración de voz",
        "Buscador visual de imágenes",
        "✨ Transiciones cinematográficas",
      ],
      elite: [
        "150 videos al mes — producción máxima",
        "Sin marca de agua — 100% tu marca",
        "Voces profesionales en español",
        "Sube tu propia narración de voz",
        "Buscador visual de imágenes",
        "✨ Transiciones cinematográficas",
      ],
      profesional: [
        "3 videos cinematográficos al mes",
        "Producción profesional personalizada",
        "Capturas reales de tu negocio",
        "Entrega en 24-48 horas",
        "Versión 9:16 + 16:9 incluida",
        "Revisión incluida",
      ],
    };
    const cont = document.getElementById("lista-planes");
    cont.style.cssText = "padding:0;display:block";
    cont.innerHTML = `
    <div style="padding:44px;max-width:900px">
      <span style="font-size:9px;letter-spacing:4px;text-transform:uppercase;color:rgba(214,178,94,.5);display:block;margin-bottom:12px">Membresías</span>
      <div style="font-family:'Playfair Display',serif;font-size:36px;color:#F0EDE5;margin-bottom:6px;line-height:1.1">Elige tu nivel<br>de <em style="color:#D6B25E">producción</em></div>
      <p style="font-size:14px;color:rgba(255,255,255,.3);margin-bottom:48px;font-weight:300">Sin contratos. Sin permanencias. Cancela cuando quieras desde tu panel.</p>

      <!-- PLAN ESENCIAL -->
      <div style="border:1px solid rgba(255,255,255,.08);margin-bottom:12px;display:flex;align-items:stretch;overflow:hidden;transition:border-color .3s" onmouseover="this.style.borderColor='rgba(214,178,94,.2)'" onmouseout="this.style.borderColor='rgba(255,255,255,.08)'">
        <div style="width:6px;background:rgba(255,255,255,.1);flex-shrink:0"></div>
        <div style="flex:1;padding:28px 32px;display:flex;align-items:center;gap:40px">
          <div style="min-width:160px">
            <span style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,.3);display:block;margin-bottom:10px">Esencial</span>
            <div style="font-family:'Playfair Display',serif;font-size:32px;color:#F0EDE5">$39.900</div>
            <span style="font-size:11px;color:rgba(255,255,255,.2)">COP / mes</span>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px">
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> 15 videos al mes</span>
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Sin marca de agua</span>
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Voces profesionales</span>
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Tu propia narración</span>
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Buscador de imágenes</span>
            <span style="font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Tus propias imágenes</span>
          </div>
          <div style="flex-shrink:0">
            <button data-plan="esencial" type="button" style="background:none;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.4);padding:13px 28px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .2s" onmouseover="if(!this.disabled){this.style.borderColor='#D6B25E';this.style.color='#D6B25E'}" onmouseout="if(!this.disabled&&!this.dataset.actual){this.style.borderColor='rgba(255,255,255,.15)';this.style.color='rgba(255,255,255,.4)'}">Elegir Esencial</button>
          </div>
        </div>
      </div>

      <!-- PLAN SIGNATURE -->
      <div style="border:1px solid rgba(214,178,94,.25);margin-bottom:12px;display:flex;align-items:stretch;overflow:hidden;transition:border-color .3s" onmouseover="this.style.borderColor='rgba(214,178,94,.5)'" onmouseout="this.style.borderColor='rgba(214,178,94,.25)'">
        <div style="width:6px;background:rgba(214,178,94,.4);flex-shrink:0"></div>
        <div style="flex:1;padding:28px 32px;display:flex;align-items:center;gap:40px">
          <div style="min-width:160px">
            <span style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(214,178,94,.6);display:block;margin-bottom:10px">Signature</span>
            <div style="font-family:'Playfair Display',serif;font-size:32px;color:#F0EDE5">$89.900</div>
            <span style="font-size:11px;color:rgba(255,255,255,.2)">COP / mes</span>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px">
            <span style="font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> 50 videos al mes</span>
            <span style="font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Sin marca de agua</span>
            <span style="font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Voces profesionales</span>
            <span style="font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Tu propia narración</span>
            <span style="font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Buscador de imágenes</span>
            <span style="font-size:12px;color:#D6B25E;display:flex;align-items:center;gap:8px"><span style="font-size:10px">✨</span> Transiciones cinematográficas</span>
          </div>
          <div style="flex-shrink:0">
            <button data-plan="signature" type="button" style="background:none;border:1px solid rgba(214,178,94,.3);color:#D6B25E;padding:13px 28px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .2s" onmouseover="if(!this.disabled){this.style.background='rgba(214,178,94,.08)';this.style.borderColor='#D6B25E'}" onmouseout="if(!this.disabled&&!this.dataset.actual){this.style.background='none';this.style.borderColor='rgba(214,178,94,.3)'}">Elegir Signature</button>
          </div>
        </div>
      </div>

      <!-- PLAN ÉLITE -->
      <div style="border:1px solid rgba(214,178,94,.5);background:linear-gradient(135deg,rgba(214,178,94,.06) 0%,transparent 60%);display:flex;align-items:stretch;overflow:hidden;position:relative" onmouseover="this.style.borderColor='#D6B25E'" onmouseout="this.style.borderColor='rgba(214,178,94,.5)'">
        <div style="position:absolute;top:0;right:0;background:#D6B25E;color:#09090B;font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:5px 20px;z-index:1">RECOMENDADO</div>
        <div style="width:6px;background:#D6B25E;flex-shrink:0"></div>
        <div style="flex:1;padding:36px 32px;display:flex;align-items:center;gap:40px">
          <div style="min-width:160px">
            <span style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#D6B25E;display:block;margin-bottom:10px">Élite</span>
            <div style="font-family:'Playfair Display',serif;font-size:44px;color:#D6B25E;line-height:1">$199.900</div>
            <span style="font-size:11px;color:rgba(255,255,255,.2)">COP / mes</span>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px 24px">
            <span style="font-size:13px;color:#F0EDE5;font-weight:500;display:flex;align-items:center;gap:8px"><span style="color:#D6B25E">✓</span> 150 videos al mes</span>
            <span style="font-size:13px;color:#F0EDE5;font-weight:500;display:flex;align-items:center;gap:8px"><span style="color:#D6B25E">✓</span> Sin marca de agua</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Voces profesionales</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Tu propia narración</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Buscador de imágenes</span>
            <span style="font-size:13px;color:#D6B25E;font-weight:500;display:flex;align-items:center;gap:8px"><span>✨</span> Transiciones cinematográficas</span>
          </div>
          <div style="flex-shrink:0">
            <button data-plan="elite" type="button" style="background:#D6B25E;border:1px solid #D6B25E;color:#09090B;padding:15px 32px;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit;transition:all .2s" onmouseover="if(!this.disabled){this.style.background='#E8C96A';this.style.borderColor='#E8C96A'}" onmouseout="if(!this.disabled&&!this.dataset.actual){this.style.background='#D6B25E';this.style.borderColor='#D6B25E'}">Elegir Élite</button>
          </div>
        </div>
      </div>

      <!-- PLAN PROFESIONAL -->
      <div style="border:1px solid rgba(214,178,94,.4);margin-bottom:12px;display:flex;align-items:stretch;overflow:hidden;position:relative;background:linear-gradient(135deg,rgba(214,178,94,.06) 0%,transparent 60%)" onmouseover="this.style.borderColor='#D6B25E'" onmouseout="this.style.borderColor='rgba(214,178,94,.4)'">
        <div style="position:absolute;top:0;right:0;background:#D6B25E;color:#09090B;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 14px">NUEVO · PREMIUM</div>
        <div style="width:6px;background:#D6B25E;flex-shrink:0"></div>
        <div style="flex:1;padding:28px 32px;display:flex;align-items:center;gap:40px">
          <div style="min-width:160px">
            <span style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:rgba(214,178,94,.7);display:block;margin-bottom:10px">Profesional</span>
            <div style="font-family:'Playfair Display',serif;font-size:32px;color:#D6B25E">$149.000</div>
            <span style="font-size:11px;color:rgba(255,255,255,.2)">COP / mes</span>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px">
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> <strong style="color:#F0EDE5">3 videos</strong> profesionales/mes</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Producción humana + IA</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Capturas reales de tu negocio</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Entrega en 24-48 horas</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Versión 9:16 + 16:9</span>
            <span style="font-size:12px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:8px"><span style="color:#D6B25E;font-size:10px">✓</span> Revisión incluida</span>
          </div>
          <div style="flex-shrink:0">
            <button data-plan="profesional" type="button" style="background:#D6B25E;border:1px solid #D6B25E;color:#09090B;padding:13px 28px;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:inherit;font-weight:700;transition:all .2s" onmouseover="if(!this.disabled){this.style.background='#E8C96A'}" onmouseout="if(!this.disabled&&!this.dataset.actual){this.style.background='#D6B25E'}">Elegir Profesional</button>
          </div>
        </div>
      </div>
      <p style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,.2);display:flex;gap:20px;justify-content:center;flex-wrap:wrap">
        <span style="display:flex;align-items:center;gap:6px"><span style="color:#D6B25E">✓</span> Tarjeta crédito/débito</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="color:#D6B25E">✓</span> PSE</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="color:#D6B25E">✓</span> Nequi</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="color:#D6B25E">✓</span> Pesos colombianos</span>
      </p>
    </div>
    `;
    cont.querySelectorAll("button[data-plan]").forEach(b => {
      b.onclick = () => this.pagarPlan(b.dataset.plan, b);
    });
    this.actualizarBotonesPlan(planActual);
  },

  actualizarBotonesPlan(planActual) {
    document.querySelectorAll("#lista-planes button[data-plan]").forEach(b => {
      const plan = (this._planes||[]).find(p=>p.clave===b.dataset.plan);
      const esActual = plan?.nombre === planActual;
      b.textContent = esActual ? "✓ Plan actual" : `Elegir ${plan?.nombre||""}`;
      b.disabled = esActual;
      if (esActual) {
        b.style.background = "#D6B25E";
        b.style.color = "#09090B";
        b.style.borderColor = "#D6B25E";
        b.style.fontWeight = "700";
        b.style.cursor = "default";
        b.onmouseover = null;
        b.onmouseout = null;
        const card = b.closest(".plan-item");
        if (card) {
          card.style.borderColor = "#D6B25E";
          card.style.background = "rgba(214,178,94,.06)";
          // Agregar badge encima
          if (!card.querySelector(".plan-actual-badge")) {
            const badge = document.createElement("div");
            badge.className = "plan-actual-badge";
            badge.textContent = "✓ Tu plan actual";
            badge.style.cssText = "position:absolute;top:0;left:0;right:0;background:#D6B25E;color:#09090B;text-align:center;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding:6px;z-index:1";
            card.style.position = "relative";
            card.style.paddingTop = "42px";
            card.insertBefore(badge, card.firstChild);
          }
          // Ocultar el tier cuando es plan actual para no duplicar
          const tier = card.querySelector("span[style*='letra-spacing']") || card.querySelector("span:first-of-type");
        }
      } else {
        b.style.cursor = "pointer";
      }
    });
  },

  async pagarPlan(clave, boton) {
    limpiarMensaje();
    boton.disabled = true; boton.textContent = "Preparando pago…";
    try {
      const datos = await API.pedir("/api/pagos/iniciar", { method: "POST", body: JSON.stringify({ plan: clave }) });
      const form = document.createElement("form");
      form.method = "GET"; form.action = "https://checkout.wompi.co/p/";
      const campos = {
        "public-key": datos.llavePublica, currency: datos.moneda,
        "amount-in-cents": datos.montoEnCentavos, reference: datos.referencia,
        "signature:integrity": datos.firma, "redirect-url": datos.urlRedireccion,
      };
      Object.entries(campos).forEach(([n,v]) => {
        const i = document.createElement("input"); i.type="hidden"; i.name=n; i.value=v; form.appendChild(i);
      });
      document.body.appendChild(form); form.submit();
    } catch (e) {
      mostrarMensaje(e.message,"err"); boton.disabled=false; boton.textContent="Actualizar";
    }
  },

  async conectarRedes() {
    limpiarMensaje();
    const boton = document.getElementById("conectar-redes");
    boton.disabled = true; boton.textContent = "Generando enlace…";
    try {
      const datos = await API.pedir("/api/redes/conectar", { method: "POST" });
      window.open(datos.urlConexion, "_blank");
      mostrarMensaje("Se abrió una pestaña nueva para conectar tus redes.", "ok");
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false; boton.textContent = "Conectar mis redes";
    }
  },

  async cargarVocesPremium() {
    try {
      const { voces } = await API.pedir("/api/voces-premium");
      if (!voces || !voces.length) {
        const btn = document.querySelector('[data-modo="premium"]');
        if (btn) btn.style.display = "none";
        return;
      }
      const NOMBRES_IDIOMA = { en:"Inglés", es:"Español", fr:"Francés", de:"Alemán", pt:"Portugués", it:"Italiano" };
      const idiomas = [...new Set(voces.map(v=>v.idioma).filter(Boolean))].sort();
      const sel = document.getElementById("filtro-idioma-premium");
      if (sel) {
        sel.innerHTML = '<option value="">Todos los idiomas</option>' +
          idiomas.map(c=>`<option value="${c}">${NOMBRES_IDIOMA[c]||c}</option>`).join("");
        sel.onchange = () => this._pintarVocesPremium(sel.value ? voces.filter(v=>v.idioma===sel.value) : voces);
      }
      this._pintarVocesPremium(voces);
    } catch {
      const btn = document.querySelector('[data-modo="premium"]');
      if (btn) btn.style.display = "none";
    }
  },

  _pintarVocesPremium(voces) {
    const cont = document.getElementById("lista-voces-premium");
    if (!cont) return;
    cont.innerHTML = "";
    voces.forEach(v => {
      const fila = document.createElement("div");
      fila.className = "opcion-musica";
      fila.dataset.valor = v.id;
      const detalle = [v.acento, v.idioma].filter(Boolean).join(" · ");
      fila.innerHTML = `
        <span class="radio"></span>
        <span class="nombre">${v.nombre.replace(/</g,"&lt;")}
          ${detalle ? `<span style="color:var(--muted);font-size:12px">(${detalle})</span>` : ""}
        </span>
        ${v.muestra ? '<button class="boton-escuchar" type="button">Escuchar</button>' : ""}
      `;
      fila.querySelector(".nombre").onclick = fila.querySelector(".radio").onclick = () => {
        document.querySelectorAll("#lista-voces-premium .opcion-musica").forEach(f=>f.classList.remove("seleccionada"));
        fila.classList.add("seleccionada");
        document.getElementById("voz-premium-elegida").value = v.id;
        W.estado.vozPremiumId = v.id;
      };
      const escuchar = fila.querySelector(".boton-escuchar");
      if (escuchar) escuchar.onclick = (e) => {
        e.stopPropagation();
        const audio = document.getElementById("reproductor-voz-premium");
        if (audio.dataset.actual === v.muestra && !audio.paused) { audio.pause(); escuchar.textContent="Escuchar"; return; }
        document.querySelectorAll("#lista-voces-premium .boton-escuchar").forEach(b=>b.textContent="Escuchar");
        audio.src = v.muestra; audio.dataset.actual = v.muestra; audio.play();
        escuchar.textContent = "Pausar";
        audio.onended = () => { escuchar.textContent = "Escuchar"; };
      };
      cont.appendChild(fila);
    });
  },

  async cargarMusicaEstandar() {
    const cont = document.getElementById("lista-musica");
    if (!cont) return;
    // Opción aleatoria
    const aleatoria = document.createElement("div");
    aleatoria.className = "opcion-musica seleccionada";
    aleatoria.dataset.valor = "";
    aleatoria.innerHTML = `<span class="radio"></span><span class="nombre">Aleatoria (recomendado)</span>`;
    aleatoria.onclick = () => {
      document.querySelectorAll("#lista-musica .opcion-musica").forEach(f=>f.classList.remove("seleccionada"));
      aleatoria.classList.add("seleccionada");
      document.getElementById("musica").value = "";
      document.getElementById("musica-premium-url").value = "";
      W.estado.musicaArchivo = "";
      W.estado.musicaPremiumUrl = "";
    };
    cont.appendChild(aleatoria);

    try {
      const { propias } = await API.pedir("/api/musicas");
      if (propias && propias.length) {
        const enc = document.createElement("p");
        enc.className = "categoria-musica"; enc.textContent = "Tus canciones"; cont.appendChild(enc);
        propias.forEach(a => {
          const nombre = a.name || a.file || a;
          const archivo = a.file || nombre;
          const fila = document.createElement("div");
          fila.className = "opcion-musica"; fila.dataset.valor = archivo;
          fila.innerHTML = `
            <span class="radio"></span>
            <span class="nombre">${nombre.replace(/\.[^.]+$/,"").replace(/</g,"&lt;")}</span>
            <button class="boton-escuchar" type="button" style="background:rgba(214,178,94,.08);border:1px solid rgba(214,178,94,.3);color:var(--gold);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:7px 14px;cursor:pointer;white-space:nowrap;border-radius:2px;font-family:inherit">▶ Escuchar</button>
            <button class="boton-eliminar" type="button" title="Eliminar">✕</button>
          `;
          fila.querySelector(".nombre").onclick = fila.querySelector(".radio").onclick = () => {
            document.querySelectorAll("#lista-musica .opcion-musica").forEach(f=>f.classList.remove("seleccionada"));
            fila.classList.add("seleccionada");
            document.getElementById("musica").value = archivo;
            document.getElementById("musica-premium-url").value = "";
            W.estado.musicaArchivo = archivo;
            W.estado.musicaPremiumUrl = "";
          };
          const esc = fila.querySelector(".boton-escuchar");
          esc.onclick = (e) => {
            e.stopPropagation();
            const audio = document.getElementById("reproductor-musica");
            const url = `/api/musicas/${encodeURIComponent(archivo)}/escuchar?t=${API.token()}`;
            if (audio.dataset.actual === url && !audio.paused) { audio.pause(); esc.textContent="Escuchar"; return; }
            document.querySelectorAll(".boton-escuchar").forEach(b=>b.textContent="Escuchar");
            audio.src=url; audio.dataset.actual=url; audio.play();
            esc.textContent="Pausar"; audio.onended=()=>{esc.textContent="Escuchar";};
          };
          fila.querySelector(".boton-eliminar").onclick = async (e) => {
            e.stopPropagation();
            try {
              await API.pedir(`/api/musicas/${encodeURIComponent(archivo)}`, { method: "DELETE" });
              fila.remove(); mostrarMensaje("Canción eliminada.", "ok");
            } catch(err) { mostrarMensaje(err.message, "err"); }
          };
          cont.appendChild(fila);
        });
      }
    } catch { /* si falla, se queda solo "Aleatoria" */ }
  },

  async subirMusica(archivo) {
    if (!archivo) return;
    const ayuda = document.querySelector("#seccion-musica-estandar .ayuda");
    const textoOriginal = ayuda?.textContent || "";
    if (ayuda) ayuda.textContent = "Subiendo tu canción…";
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const r = await fetch(`/api/musicas?nombre=${encodeURIComponent(archivo.name)}`, {
        method: "POST", headers: { Authorization: "Bearer " + API.token() }, body: formData,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No pudimos subir la canción.");
      mostrarMensaje("Tu canción ya está lista.", "ok");
      // Recargar la lista
      document.getElementById("lista-musica").innerHTML = "";
      await this.cargarMusicaEstandar();
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      if (ayuda) ayuda.textContent = textoOriginal;
    }
  },

  async subirNarracion(archivo) {
    if (!archivo) return;
    const ayuda = document.getElementById("ayuda-narracion-propia");
    if (ayuda) { ayuda.style.display = "block"; ayuda.textContent = "Subiendo tu narración…"; }
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const r = await fetch("/api/narracion", {
        method: "POST", headers: { Authorization: "Bearer " + API.token() }, body: formData,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No pudimos subir tu narración.");
      document.getElementById("audio-personalizado").value = j.archivo;
      W.estado.audioPropio = j.archivo;
      if (ayuda) ayuda.textContent = `Listo: "${archivo.name}" queda como narración de este video.`;
      mostrarMensaje("Tu narración está lista.", "ok");
    } catch (e) {
      mostrarMensaje(e.message, "err");
      W.elegirModoVoz(document.querySelector('[data-modo="lista"]'));
    }
  },

  async refrescarVideos() {
    const datos = await API.pedir("/api/videos");
    if (!datos) return;
    this.pintarCuota(datos.cuota);
    this._todosLosVideos = datos.videos;
    this.pintarVideos(datos.videos);
    clearTimeout(this.temporizador);
    const hayProduciendo = datos.videos.some(v => v.estado === "produciendo");
    if (hayProduciendo) {
      this.temporizador = setTimeout(() => this.refrescarVideos(), 8000);
    }
    // Notificar cuando un video recién terminó
    if (this._videosProduciendo && !hayProduciendo) {
      const recienListo = datos.videos.find(v => v.estado === "listo");
      if (recienListo && typeof notificarVideoListo === "function") {
        notificarVideoListo(recienListo.tema);
      }
    }
    this._videosProduciendo = hayProduciendo;
    // Badge de notificación cuando termina un video
    const tabActiva = document.querySelector(".tab-btn.activo")?.dataset?.tab;
    const badge = document.getElementById("badge-videos");
    if (badge) {
      const hayListoNuevo = datos.videos.some(v => v.estado === "listo");
      if (hayListoNuevo && tabActiva !== "videos") {
        badge.style.display = "inline-flex";
      } else if (tabActiva === "videos") {
        badge.style.display = "none";
      }
    }
  },

  pintarVideos(videos) {
    const cont = document.getElementById("lista-videos");
    if (!videos.length) {
      cont.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:80px 20px">
          <div style="font-size:48px;margin-bottom:20px;opacity:.3">🎬</div>
          <div style="font-family:'Playfair Display',serif;font-size:22px;color:rgba(255,255,255,.4);margin-bottom:10px">Aún no tienes videos</div>
          <p style="font-size:14px;color:rgba(255,255,255,.2);margin-bottom:28px">Crea tu primer video en el paso 1 — tarda menos de 2 minutos.</p>
          <button onclick="Panel.cambiarPestana('producir')" style="background:#D6B25E;color:#09090B;border:none;padding:13px 32px;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer;font-family:inherit">Crear mi primer video →</button>
        </div>`;
      return;
    }
    const mensajesProduccion = [
      "Escribiendo el guion...", "Sintetizando la voz...",
      "Buscando las imágenes perfectas...", "Componiendo la música...",
      "Añadiendo subtítulos...", "Renderizando el video...",
      "Últimos toques...", "¡Casi listo!",
    ];
    cont.innerHTML = videos.map(v => {
      const fecha = new Date(v.creado_en||v.creado).toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
      const urlVideo = v.urls && v.urls[0] ? v.urls[0] : null;
      const idxMensaje = Math.min(Math.floor((v.progreso || 0) / 13), mensajesProduccion.length - 1);

      const DURACION_LABEL = { corto: "30 seg", medio: "60 seg", largo: "90 seg" };
      const durLabel = DURACION_LABEL[v.duracion] || v.duracion || "";

      if (v.estado === "produciendo") {
        return `
        <div style="background:#0A0A0D;border:1px solid rgba(214,178,94,.2);overflow:hidden;display:flex;flex-direction:column">
          <div style="background:rgba(214,178,94,.04);padding:24px;display:flex;align-items:center;gap:16px;flex:1">
            <div style="width:48px;height:48px;border:1px solid rgba(214,178,94,.3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;animation:spin 3s linear infinite">⚙️</div>
            <div style="flex:1">
              <p style="font-size:14px;color:#F0EDE5;margin-bottom:4px;font-weight:500">${v.tema.replace(/</g,"&lt;")}</p>
              <p style="font-size:11px;color:rgba(214,178,94,.6);letter-spacing:1px">${mensajesProduccion[idxMensaje]}</p>
            </div>
            <span style="font-size:13px;color:#D6B25E;font-family:'Playfair Display',serif">${v.progreso}%</span>
          </div>
          <div style="padding:0 24px 16px">
            <div style="background:rgba(255,255,255,.05);height:2px;border-radius:1px;overflow:hidden">
              <div style="height:100%;background:linear-gradient(90deg,rgba(214,178,94,.5),#D6B25E);width:${v.progreso}%;transition:width .5s;border-radius:1px"></div>
            </div>
            <p style="font-size:11px;color:rgba(255,255,255,.2);margin-top:8px;text-align:center">Tu video está siendo producido — puedes cerrar esta ventana y volver cuando quieras</p>
          </div>
        </div>`;
      }

      if (v.estado === "fallido") {
        return `
        <div style="background:#0A0A0D;border:1px solid rgba(232,72,85,.2);overflow:hidden">
          <div style="padding:24px;display:flex;align-items:center;gap:16px">
            <div style="width:48px;height:48px;border:1px solid rgba(232,72,85,.3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;color:#E84855">✗</div>
            <div style="flex:1">
              <p style="font-size:14px;color:#F0EDE5;margin-bottom:4px">${v.tema.replace(/</g,"&lt;")}</p>
              <p style="font-size:11px;color:rgba(232,72,85,.6)">La producción falló · ${fecha}</p>
            </div>
            <button data-eliminar="${v.id}" type="button" style="background:none;border:1px solid rgba(232,72,85,.3);color:#E84855;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:8px 16px;cursor:pointer;font-family:inherit;transition:all .2s">Eliminar</button>
          </div>
        </div>`;
      }

      // LISTO — tarjeta compacta profesional
      return `
      <div data-id="${v.id}" style="position:relative;border-radius:6px;overflow:hidden;background:#0A0A0D;border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:border-color .2s"
        onmouseover="this.querySelector('.vid-overlay').style.opacity='1';this.style.borderColor='rgba(214,178,94,.3)'"
        onmouseout="this.querySelector('.vid-overlay').style.opacity='0';this.style.borderColor='rgba(255,255,255,.06)'">
        <div style="position:relative;aspect-ratio:9/16;background:#111;overflow:hidden;max-height:240px" ${urlVideo ? `onclick="abrirModalVideo('${urlVideo}','${v.tema.replace(/'/g,"\'").replace(/</g,"&lt;")}')"` : ""}>
          ${urlVideo
            ? `<video src="${urlVideo}#t=0.001" preload="metadata" muted playsinline
                style="width:100%;height:100%;object-fit:cover;display:block"
                onmouseover="this.play()" onmouseout="this.pause();this.currentTime=0.001"></video>`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;color:rgba(255,255,255,.1)">🎬</div>`
          }
          <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.8);color:#D6B25E;font-size:8px;letter-spacing:1px;text-transform:uppercase;padding:3px 6px">${durLabel}</span>
          <span style="position:absolute;top:6px;right:6px;color:#69F0AE;font-size:11px;background:rgba(0,0,0,.6);padding:2px 5px;border-radius:50%">✓</span>
          <div class="vid-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,.8);opacity:0;transition:opacity .2s;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:6px;padding:12px">
            <a href="/api/videos/${v.id}/descargar?t=${API.token()}" onclick="event.stopPropagation()" download style="display:block;background:#D6B25E;color:#09090B;text-align:center;padding:8px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none">⬇ Descargar</a>
            <div style="display:flex;gap:6px">
              <button onclick="compartirVideo('${v.id}','${v.tema.replace(/'/g,String.fromCharCode(39)).replace(/</g,"&lt;")}');event.stopPropagation()" type="button" style="flex:1;background:rgba(255,255,255,.12);border:none;color:#fff;padding:7px;font-size:9px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:inherit">🔗</button>
              <button data-eliminar="${v.id}" type="button" style="background:rgba(232,72,85,.2);border:none;color:#E84855;padding:7px 10px;font-size:11px;cursor:pointer;font-family:inherit">✕</button>
            </div>
          </div>
        </div>
        <div style="padding:8px 10px 10px">
          <p style="font-size:11px;color:rgba(255,255,255,.8);line-height:1.3;margin-bottom:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${v.tema.replace(/</g,"&lt;")}</p>
          <p style="font-size:9px;color:rgba(255,255,255,.25)">${fecha}</p>
        </div>
      </div>`;
    });
    cont.querySelectorAll("button[data-eliminar]").forEach(b => {
      b.onclick = () => this.eliminarVideo(b.dataset.eliminar, b);
    });
  },

  async eliminarVideo(id, boton) {
    if (!confirm("¿Eliminar este video? Esta acción no se puede deshacer.")) return;
    boton.disabled = true;
    boton.textContent = "Eliminando…";
    try {
      await API.pedir(`/api/videos/${id}`, { method: "DELETE" });
      mostrarMensaje("Video eliminado.", "ok");
      await this.refrescarVideos();
    } catch(e) {
      mostrarMensaje(e.message, "err");
      boton.disabled = false;
      boton.textContent = "🗑 Eliminar";
    }
  },

  async publicarVideo(id, boton) {
    limpiarMensaje();
    boton.disabled=true; boton.textContent="Publicando…";
    try {
      await API.pedir(`/api/videos/${id}/publicar`, { method:"POST", body:JSON.stringify({}) });
      mostrarMensaje("Tu video se está publicando.", "ok");
    } catch(e) {
      mostrarMensaje(e.message,"err");
    } finally {
      boton.disabled=false; boton.textContent="Publicar";
    }
  },
};

// ============================================================
//  Admin
// ============================================================
const NOMBRES_PLAN = { inicial:"Inicial", esencial:"Esencial", signature:"Signature", elite:"Élite" };

const Admin = {
  iniciar() {
    if (!API.token()) { location.href = "login.html"; return; }
    document.getElementById("salir").onclick = () => API.cerrarSesion();
    this.cargarAnalytics();
    this.cargar();
  },
  async cargarAnalytics() {
    try {
      const d = await API.pedir("/api/admin/analytics");
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set("stat-total-usuarios", d.total);
      set("stat-usuarios-pagos", d.pagos);
      set("stat-videos-mes", d.videosMes);
      set("stat-ingresos", "$" + d.ingresos.toLocaleString("es-CO") + " COP");
      set("stat-plan-inicial", d.porPlan.inicial);
      set("stat-plan-esencial", d.porPlan.esencial);
      set("stat-plan-signature", d.porPlan.signature);
      set("stat-plan-elite", d.porPlan.elite);

      // Dibujar gráfico
      if (d.porDia) this.dibujarGrafico(d.porDia, d.usuariosPorDia);
    } catch(e) { console.error("Analytics:", e.message); }
  },



  dibujarGrafico(porDia, usuariosPorDia) {
    const canvas = document.getElementById("grafico-videos");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = 120;
    const W = canvas.width, H = canvas.height;
    const pad = { top: 10, right: 20, bottom: 30, left: 30 };
    const dias = Object.keys(porDia).sort();
    const valsV = dias.map(d => porDia[d]);
    const valsU = dias.map(d => (usuariosPorDia || {})[d] || 0);
    const maxVal = Math.max(...valsV, ...valsU, 1);
    const gW = W - pad.left - pad.right;
    const gH = H - pad.top - pad.bottom;
    const step = gW / (dias.length - 1);

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (gH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    }

    const dibujarLinea = (vals, color) => {
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = pad.left + i * step;
        const y = pad.top + gH - (v / maxVal) * gH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

      // Puntos
      vals.forEach((v, i) => {
        const x = pad.left + i * step;
        const y = pad.top + gH - (v / maxVal) * gH;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        if (v > 0) {
          ctx.fillStyle = "rgba(255,255,255,.6)";
          ctx.font = "10px Jost, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(v, x, y - 8);
        }
      });
    };

    dibujarLinea(valsV, "#D6B25E");
    dibujarLinea(valsU, "rgba(105,240,174,.7)");

    // Etiquetas de fechas
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.font = "9px Jost, sans-serif";
    ctx.textAlign = "center";
    dias.forEach((d, i) => {
      if (i % 2 === 0) {
        const x = pad.left + i * step;
        const label = d.slice(5); // MM-DD
        ctx.fillText(label, x, H - 8);
      }
    });
  },
  async cargar() {
    try {
      const { usuarios } = await API.pedir("/api/admin/usuarios");
      this.pintar(usuarios);
    } catch(e) {
      mostrarMensaje(e.message,"err");
      document.getElementById("cuerpo-tabla").innerHTML =
        `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">No se pudo cargar la lista.</td></tr>`;
    }
  },
  pintar(usuarios) {
    const cuerpo = document.getElementById("cuerpo-tabla");
    if (!usuarios.length) {
      cuerpo.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:40px">Todavía no hay usuarios.</td></tr>`;
      return;
    }
    cuerpo.innerHTML = usuarios.map(u => {
      const fecha = new Date(u.creadoEn).toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric"});
      const opciones = Object.entries(NOMBRES_PLAN)
        .map(([c,n])=>`<option value="${c}" ${c===u.plan?"selected":""}>${n}</option>`).join("");
      const refInfo = `<span style="font-family:'Playfair Display',serif;font-size:20px;color:var(--gold)">${u.referidosCount || 0}</span>${u.videosBonus ? `<br><span style="font-size:10px;color:rgba(255,255,255,.4)">+${u.videosBonus} bonus</span>` : ""}`;
      return `<tr data-id="${u.id}">
        <td>${(u.nombre||"(sin nombre)").replace(/</g,"&lt;")}</td>
        <td>${u.email.replace(/</g,"&lt;")}</td>
        <td><select class="selector-plan">${opciones}</select></td>
        <td>${u.videosEsteMes} / ${u.videosTotal}</td>
        <td>${refInfo}</td>
        <td style="color:rgba(255,255,255,.4);font-size:12px">${fecha}</td>
      </tr>`;
    }).join("");
    cuerpo.querySelectorAll("tr[data-id]").forEach(fila => {
      const sel = fila.querySelector(".selector-plan");
      sel.onchange = () => this.cambiarPlan(fila.dataset.id, sel.value, sel);
    });
  },
  async cambiarPlan(id, plan, sel) {
    limpiarMensaje(); sel.disabled=true;
    try {
      await API.pedir(`/api/admin/usuarios/${id}/plan`,{method:"PUT",body:JSON.stringify({plan})});
      mostrarMensaje("Membresía actualizada.","ok");
    } catch(e) {
      mostrarMensaje(e.message,"err");
    } finally { sel.disabled=false; }
  },
};

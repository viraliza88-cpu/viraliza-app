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
        cuerpo.nombre = document.getElementById("nombre").value;
        respuesta = await API.pedir("/api/registro", { method: "POST", body: JSON.stringify(cuerpo) });
      } else {
        respuesta = await API.pedir("/api/login", { method: "POST", body: JSON.stringify(cuerpo) });
      }
      API.guardarSesion(respuesta.token, respuesta.nombre);
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
    document.querySelectorAll("[data-fuente]:not([data-fuente='clasica']):not([data-fuente='ligera']):not([data-fuente='elegante']):not([data-fuente='moderna'])").forEach((b) => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    this.estado.fuente = btn.dataset.fuente;
  },

  // ---- Paso 3 ----
  async generarGuion() {
    const ta = document.getElementById("guion-editable");
    const loading = document.getElementById("guion-loading");
    ta.style.display = "none";
    loading.style.display = "block";
    document.getElementById("btn-regenerar").disabled = true;
    try {
      const datos = await API.pedir("/api/guion", {
        method: "POST",
        body: JSON.stringify({ tema: this.estado.tema, duracion: this.estado.duracion }),
      });
      this.estado.guion = datos.guion || "";
      this.estado.terminos = datos.terminos || [];
      ta.value = this.estado.guion;
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      ta.style.display = "block";
      loading.style.display = "none";
      document.getElementById("btn-regenerar").disabled = false;
    }
    if (this.pasoActual !== 3) this._mostrarPaso(3);
  },

  // ---- Paso 4: voz ----
  elegirModoVoz(btn) {
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
    const esPremium = modo === "premium";
    document.getElementById("btn-musica-premium").className = esPremium ? "btn" : "btn line";
    document.getElementById("btn-musica-estandar").className = esPremium ? "btn line" : "btn";
    document.getElementById("seccion-musica-premium").style.display = esPremium ? "block" : "none";
    document.getElementById("seccion-musica-estandar").style.display = esPremium ? "none" : "block";
    document.getElementById("btn-musica-premium").style.flex = "1";
    document.getElementById("btn-musica-estandar").style.flex = "1";
    document.getElementById("btn-musica-premium").style.fontSize = "12px";
    document.getElementById("btn-musica-estandar").style.fontSize = "12px";
  },

  async buscarAnimo(btn) {
    document.querySelectorAll("[data-animo]").forEach((b) => b.classList.remove("elegida"));
    btn.classList.add("elegida");
    const cont = document.getElementById("lista-musica-premium");
    cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">Buscando canciones ${btn.querySelector(".tarjeta-titulo").textContent.toLowerCase()}…</p>`;
    try {
      const r = await API.pedir(`/api/musicas/premium?animo=${btn.dataset.animo}`);
      const pistas = r?.pistas || [];
      if (!pistas.length) {
        cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">No encontramos canciones para ese ánimo. Prueba con otro.</p>`;
        return;
      }
      cont.innerHTML = "";
      pistas.forEach((p) => {
        const fila = document.createElement("div");
        fila.className = "opcion-musica";
        fila.dataset.url = p.muestra;
        fila.innerHTML = `
          <span class="radio"></span>
          <span class="nombre">${p.nombre.replace(/</g,"&lt;")}
            <span style="color:var(--muted);font-size:12px">— ${(p.artista||"").replace(/</g,"&lt;")}</span>
          </span>
          <button class="boton-escuchar" type="button">Escuchar</button>
        `;
        fila.querySelector(".nombre").onclick = fila.querySelector(".radio").onclick = () => {
          document.querySelectorAll("#lista-musica-premium .opcion-musica").forEach(f=>f.classList.remove("seleccionada"));
          fila.classList.add("seleccionada");
          this.estado.musicaPremiumUrl = p.muestra;
          this.estado.musicaArchivo = "";
          document.getElementById("musica-premium-url").value = p.muestra;
          document.getElementById("musica").value = "";
        };
        const escuchar = fila.querySelector(".boton-escuchar");
        escuchar.onclick = (e) => {
          e.stopPropagation();
          const audio = document.getElementById("reproductor-musica");
          if (audio.dataset.actual === p.muestra && !audio.paused) {
            audio.pause(); escuchar.textContent = "Escuchar"; return;
          }
          document.querySelectorAll(".boton-escuchar").forEach(b=>b.textContent="Escuchar");
          audio.src = p.muestra; audio.dataset.actual = p.muestra; audio.play();
          escuchar.textContent = "Pausar";
          audio.onended = () => { escuchar.textContent = "Escuchar"; };
        };
        cont.appendChild(fila);
      });
    } catch (e) {
      cont.innerHTML = `<p class="ayuda" style="margin:14px;text-align:center">No pudimos cargar la música en este momento.</p>`;
    }
  },

  // ---- Paso 4: subtítulos ----
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
    document.querySelectorAll("[data-fuente='clasica'],[data-fuente='ligera'],[data-fuente='elegante'],[data-fuente='moderna']")
      .forEach(b=>b.classList.remove("elegida"));
    btn.classList.add("elegida");
    this.estado.subtitulosFuente = btn.dataset.fuente;
    document.getElementById("subtitulos-fuente").value = btn.dataset.fuente;
    const mapaFuentes = {
      clasica: "inherit", ligera: "inherit",
      elegante: "Georgia, serif", moderna: "Impact, sans-serif",
    };
    document.getElementById("preview-subtitulo").style.fontFamily = mapaFuentes[btn.dataset.fuente] || "inherit";
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

    document.getElementById("resumen-grid").innerHTML = items.map(i => `
      <div class="resumen-item">
        <div class="resumen-item-label">${i.label}</div>
        <div class="resumen-item-valor">${String(i.valor).replace(/</g,"&lt;")}</div>
      </div>
    `).join("");
  },

  // ---- Producir ----
  async producir() {
    limpiarMensaje();
    const boton = document.getElementById("btn-producir");
    boton.disabled = true;
    boton.textContent = "Enviando a producción…";
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
      mostrarMensaje("Tu video entró a producción. Lo verás listo en la pestaña Mis videos.", "ok");
      Panel.cambiarPestana("videos");
      Panel.refrescarVideos();
    } catch (e) {
      mostrarMensaje(e.message, "err");
    } finally {
      boton.disabled = false;
      boton.textContent = "🎬 PRODUCIR VIDEO";
    }
  },
};

// ============================================================
//  Panel — pestañas, voces, música, videos
// ============================================================
const VOCES_ESPANOL = [
  { valor: "es-CO-SalomeNeural", etiqueta: "Salomé — Natural y cálida", pais: "🇨🇴 Colombia (Recomendada)" },
  { valor: "es-CO-GonzaloNeural", etiqueta: "Gonzalo — Serio y profesional", pais: "🇨🇴 Colombia (Recomendada)" },
  { valor: "es-MX-DaliaNeural", etiqueta: "Dalia — Energética y moderna", pais: "🌎 Latinoamérica" },
  { valor: "es-MX-JorgeNeural", etiqueta: "Jorge — Dinámico y confiable", pais: "🌎 Latinoamérica" },
  { valor: "es-AR-ElenaNeural", etiqueta: "Elena — Elegante y expresiva", pais: "🌎 Latinoamérica" },
  { valor: "es-AR-TomasNeural", etiqueta: "Tomas — Cercano y directo", pais: "🌎 Latinoamérica" },
  { valor: "es-ES-ElviraNeural", etiqueta: "Elvira — Clara y articulada", pais: "🌍 España" },
  { valor: "es-ES-AlvaroNeural", etiqueta: "Álvaro — Formal y seguro", pais: "🌍 España" },
  { valor: "es-US-PalomaNeural", etiqueta: "Paloma — Moderna y fresca", pais: "🌎 Bilingüe" },
  { valor: "es-US-AlonsoNeural", etiqueta: "Alonso — Versátil y neutral", pais: "🌎 Bilingüe" },
];

const Panel = {
  temporizador: null,
  iniciar() {
    if (!API.token()) { location.href = "login.html"; return; }
    document.getElementById("nombre-usuario").textContent = localStorage.getItem("viraliza_nombre") || "";
    document.getElementById("salir").onclick = () => API.cerrarSesion();
    document.getElementById("conectar-redes").onclick = () => this.conectarRedes();

    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.onclick = () => this.cambiarPestana(b.dataset.tab);
    });

    // Voces estándar
    // Reemplazar el select por tarjetas con botón de escuchar
    const contenedorVoz = document.getElementById("panel-voz-lista");
    if (contenedorVoz) {
      const audioPreview = document.createElement("audio");
      audioPreview.id = "reproductor-voz-estandar";
      audioPreview.style.display = "none";
      contenedorVoz.appendChild(audioPreview);

      const lista = document.createElement("div");
      lista.className = "canciones-lista";
      lista.style.maxHeight = "220px";
      contenedorVoz.appendChild(lista);

      const hiddenVoz = document.createElement("input");
      hiddenVoz.type = "hidden";
      hiddenVoz.id = "voz";
      hiddenVoz.value = "es-CO-SalomeNeural";
      contenedorVoz.appendChild(hiddenVoz);

      VOCES_ESPANOL.forEach((v, idx) => {
        const fila = document.createElement("div");
        fila.className = "opcion-musica" + (idx === 0 ? " seleccionada" : "");
        fila.dataset.valor = v.valor;
        fila.innerHTML = `
          <span class="radio"></span>
          <span class="nombre">${v.etiqueta} <span style="color:var(--muted);font-size:11px">${v.pais}</span></span>
          <button class="boton-escuchar" type="button">Escuchar</button>
        `;
        fila.querySelector(".nombre").onclick = fila.querySelector(".radio").onclick = () => {
          document.querySelectorAll("#panel-voz-lista .opcion-musica").forEach(f => f.classList.remove("seleccionada"));
          fila.classList.add("seleccionada");
          document.getElementById("voz").value = v.valor;
          W.estado.voz = v.valor;
        };
        const escuchar = fila.querySelector(".boton-escuchar");
        let cargando = false;
        escuchar.onclick = async (e) => {
          e.stopPropagation();
          if (cargando) return;
          const audio = document.getElementById("reproductor-voz-estandar");
          if (audio.dataset.actual === v.valor && !audio.paused) {
            audio.pause(); escuchar.textContent = "Escuchar"; return;
          }
          document.querySelectorAll("#panel-voz-lista .boton-escuchar").forEach(b => b.textContent = "Escuchar");
          escuchar.textContent = "Cargando…";
          cargando = true;
          try {
            const r = await fetch(`/api/voces/preview?voz=${encodeURIComponent(v.valor)}`, {
              headers: { Authorization: "Bearer " + API.token() }
            });
            if (!r.ok) throw new Error();
            const blob = await r.blob();
            audio.src = URL.createObjectURL(blob);
            audio.dataset.actual = v.valor;
            audio.play();
            escuchar.textContent = "Pausar";
            audio.onended = () => { escuchar.textContent = "Escuchar"; };
          } catch {
            escuchar.textContent = "Error";
            setTimeout(() => { escuchar.textContent = "Escuchar"; }, 2000);
          } finally {
            cargando = false;
          }
        };
        lista.appendChild(fila);
      });
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
            if (!cont.querySelectorAll(".opcion-musica").length) cont.style.display = "none";
          } catch(err) { mostrarMensaje(err.message, "err"); }
        };
        cont.appendChild(fila);
      } catch (e) {
        mostrarMensaje(e.message, "err");
      }
    }
    if (aSubir.length < archivos.length) {
      mostrarMensaje(`Solo se subieron ${aSubir.length} de ${archivos.length} archivos (límite: 8).`, "err");
    }
  },

  cambiarPestana(nombre) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("activo", b.dataset.tab === nombre));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("activo", p.dataset.panel === nombre));
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
    if (elRenovacion) {
      if (cuota.expira) {
        const fecha = new Date(cuota.expira).toLocaleDateString("es-CO", {day:"numeric", month:"long", year:"numeric"});
        elRenovacion.textContent = fecha;
      } else {
        elRenovacion.textContent = cuota.plan === "Inicial" ? "Plan gratuito" : "—";
      }
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
    if (this._planesCargados) return this.actualizarBotonesPlan(planActual);
    try {
      const { planes } = await API.pedir("/api/planes");
      this._planes = planes;
      this._planesCargados = true;
    } catch { return; }
    const cont = document.getElementById("lista-planes");
    cont.innerHTML = this._planes.map(p => `
      <article class="video">
        <div>
          <p class="tema">${p.nombre}</p>
          <p class="meta">${p.limite} videos al mes · $${p.precioCOP.toLocaleString("es-CO")} COP/mes</p>
        </div>
        <button class="btn" data-plan="${p.clave}" type="button">Actualizar</button>
      </article>
    `).join("");
    cont.querySelectorAll("button[data-plan]").forEach(b => {
      b.onclick = () => this.pagarPlan(b.dataset.plan, b);
    });
    this.actualizarBotonesPlan(planActual);
  },

  actualizarBotonesPlan(planActual) {
    document.querySelectorAll("#lista-planes button[data-plan]").forEach(b => {
      const esActual = (this._planes||[]).find(p=>p.clave===b.dataset.plan)?.nombre === planActual;
      b.textContent = esActual ? "Tu plan actual" : "Actualizar";
      b.disabled = esActual;
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
            <button class="boton-escuchar" type="button">Escuchar</button>
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
    this.pintarVideos(datos.videos);
    clearTimeout(this.temporizador);
    if (datos.videos.some(v=>v.estado==="produciendo")) {
      this.temporizador = setTimeout(() => this.refrescarVideos(), 8000);
    }
  },

  pintarVideos(videos) {
    const cont = document.getElementById("lista-videos");
    if (!videos.length) {
      cont.innerHTML = '<div class="vacio">Aquí aparecerán tus producciones.<br>Crea tu primer video para estrenar el estudio.</div>';
      return;
    }
    cont.innerHTML = videos.map(v => {
      const fecha = new Date(v.creado_en||v.creado).toLocaleDateString("es-CO",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
      const urlVideo = v.urls && v.urls[0] ? v.urls[0] : null;
      const estado = v.estado==="listo"
        ? '<span class="estado listo">✓ Listo</span>'
        : v.estado==="fallido"
          ? '<span class="estado fallido">✗ Falló</span>'
          : `<span class="estado produciendo">⏳ Produciendo · ${v.progreso}%</span>`;
      const barra = v.estado==="produciendo"
        ? `<div class="progreso"><i style="width:${v.progreso}%"></i></div>` : "";
      const preview = urlVideo
        ? `<div class="video-preview-wrap">
            <video src="${urlVideo}" preload="metadata" controls playsinline></video>
           </div>`
        : `<div class="video-sin-preview"><span>🎬</span></div>`;
      const badge = v.estado==="listo"
        ? `<span class="video-estado-badge listo">✓ Listo</span>`
        : v.estado==="fallido"
          ? `<span class="video-estado-badge fallido">✗ Falló</span>`
          : `<span class="video-estado-badge produciendo">⏳ ${v.progreso}%</span>`;
      const acciones = v.estado==="listo" ? `
        <div class="video-acciones">
          <a class="btn" href="/api/videos/${v.id}/descargar?t=${API.token()}">⬇ Descargar</a>
          <button class="btn line" data-publicar="${v.id}" type="button">📤 Publicar</button>
          <button class="btn line btn-eliminar-video" data-eliminar="${v.id}" type="button">✕</button>
        </div>` : v.estado==="fallido" ? `
        <div class="video-acciones">
          <button class="btn line btn-eliminar-video" data-eliminar="${v.id}" type="button">✕ Eliminar</button>
        </div>` : `<div class="video-acciones">${barra}</div>`;
      return `<article class="video">
        ${preview}
        <div class="video-info">
          <p class="tema">${v.tema.replace(/</g,"&lt;")}</p>
          <p class="meta">${v.duracion} · ${fecha}</p>
          ${badge}
        </div>
        ${acciones}
      </article>`;
    }).join("");
    cont.querySelectorAll("button[data-publicar]").forEach(b => {
      b.onclick = () => this.publicarVideo(b.dataset.publicar, b);
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
      mostrarMensaje("Tu video se envió a publicar en tus redes conectadas.", "ok");
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
    this.cargar();
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
      cuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">Todavía no hay usuarios.</td></tr>`;
      return;
    }
    cuerpo.innerHTML = usuarios.map(u => {
      const fecha = new Date(u.creadoEn).toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric"});
      const opciones = Object.entries(NOMBRES_PLAN)
        .map(([c,n])=>`<option value="${c}" ${c===u.plan?"selected":""}>${n}</option>`).join("");
      return `<tr data-id="${u.id}">
        <td>${(u.nombre||"(sin nombre)").replace(/</g,"&lt;")}</td>
        <td>${u.email.replace(/</g,"&lt;")}</td>
        <td><select class="selector-plan">${opciones}</select></td>
        <td>${u.videosEsteMes} / ${u.videosTotal}</td>
        <td>${fecha}</td>
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

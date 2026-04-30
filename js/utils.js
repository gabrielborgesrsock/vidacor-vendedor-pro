// utils.js - Funções utilitárias (sons, toast, tema, etc.)

// ==================== SONS ====================
function playSuccessSound() {
    try {
        let c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.connect(g); g.connect(c.destination);
        g.gain.value = 0.1; o.frequency.value = 523.25; o.start();
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.stop(c.currentTime + 0.15);
        setTimeout(() => { let o2 = c.createOscillator(); o2.type='sine'; o2.frequency.value=587.33; o2.connect(g); o2.start(); o2.stop(c.currentTime+0.15); }, 150);
    } catch(e) {}
}

function playMetaSound() {
    try {
        let c = new AudioContext(), g = c.createGain(); g.connect(c.destination); g.gain.value = 0.1;
        [523.25, 659.25, 783.99].forEach((f,i) => { let o = c.createOscillator(); o.type='triangle'; o.frequency.value=f; o.connect(g); o.start(c.currentTime+i*0.1); o.stop(c.currentTime+i*0.1+0.1); });
    } catch(e) {}
}

function playChatSound() {
    try {
        let c = new AudioContext(), g = c.createGain(); g.connect(c.destination); g.gain.value = 0.05;
        let o = c.createOscillator(); o.type='sine'; o.frequency.value=800; o.connect(g); o.start();
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.1); o.stop(c.currentTime+0.1);
    } catch(e) {}
}

// ==================== TOAST (com ícone) ====================
function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast-msg';
    const icons = { success: 'bi-check-circle-fill', error: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill' };
    t.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i>${msg}`;
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(t);
        setTimeout(() => t.remove(), 2500);
    }
}

// ==================== FORMATAÇÃO ====================
function formatPhone(input) {
    let v = input.value.replace(/\D/g,'');
    if (v.length > 11) v = v.slice(0,11);
    if (v.length > 7) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
    input.value = v;
}

// ==================== LIGHTBOX ====================
function openLightbox(src) {
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = `<span class="close-lb" onclick="this.parentElement.remove()">&times;</span><img src="${src}">`;
    lb.onclick = e => { if (e.target === lb) lb.remove(); };
    document.body.appendChild(lb);
}

// ==================== TEMA ====================
let themeInterval = null;
function setTheme() {
    const sel = document.getElementById('themeSelect');
    if (!sel) return;
    const mode = sel.value;
    // Salva no Firestore se logado
    if (usuarioLogado) {
        db.collection('vendedores').doc(`${usuarioLogado.unidade}_${usuarioLogado.numero}`).update({ tema: mode });
    }
    applyTheme(mode);
}

function applyTheme(mode) {
    if (themeInterval) { clearInterval(themeInterval); themeInterval = null; }
    if (mode === 'auto') {
        document.body.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => document.body.classList.toggle('dark', e.matches));
    } else if (mode === 'scheduled') {
        const check = () => { const h = new Date().getHours(); document.body.classList.toggle('dark', h < 6 || h >= 18); };
        check(); themeInterval = setInterval(check, 60000);
    } else {
        document.body.classList.toggle('dark', mode === 'dark');
    }
    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = mode;
    // O dashboard será recarregado após a troca de tema para atualizar gráficos, se necessário
    if (document.getElementById('dashboardScreen') && document.getElementById('dashboardScreen').classList.contains('active')) {
        if (typeof carregarDashboard === 'function') carregarDashboard();
    }
}

// ==================== CONEXÃO ====================
function monitorarConexao() {
    const banner = document.getElementById('offlineBanner');
    const indicator = document.getElementById('onlineIndicator');
    const update = () => {
        const online = navigator.onLine;
        if (banner) banner.style.display = online ? 'none' : 'block';
        if (indicator) {
            indicator.style.background = online ? '#00e676' : '#dc3545';
            indicator.title = online ? 'Online' : 'Offline';
        }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

// ==================== NAVEGAÇÃO ====================
const telas = ['dashboardScreen','listaScreen','cadastroScreen','detalheScreen','mapaScreen','ferramentasScreen'];
function mostrarTela(id) {
    telas.forEach(t => {
        const el = document.getElementById(t);
        if (el) el.classList.remove('active');
    });
    const nova = document.getElementById(id);
    if (nova) nova.classList.add('active');
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.screen === id);
    });
    // Dispara ações específicas da tela
    if (id === 'dashboardScreen') { if (typeof carregarDashboard === 'function') carregarDashboard(); if (typeof obterClima === 'function') obterClima(); }
    if (id === 'listaScreen' && typeof listarObras === 'function') listarObras();
    if (id === 'mapaScreen' && typeof iniciarMapa === 'function') iniciarMapa();
    if (id === 'cadastroScreen' && typeof resetForm === 'function') resetForm();
    if (id === 'ferramentasScreen' && typeof iniciarRecursosFerramentas === 'function') iniciarRecursosFerramentas();
    window.scrollTo(0, 0);
}
function navegarPara(id) {
    mostrarTela(id);
}
// app.js - Inicialização do app, variáveis globais e fallback

// ==================== VARIÁVEIS GLOBAIS ====================
let obras = [];
let metaVisitas = 5;
let chartStatusInstance, chartSemanalInstance, chartFunilInstance;
let usuarioLogado = null;
let unsubscribeObras = null;

// ==================== INICIALIZAÇÃO ====================
window.addEventListener('load', () => {
    // Monitora conexão internet
    if (typeof monitorarConexao === 'function') monitorarConexao();

    // Limpa localStorage preservando apenas o essencial
    const keepKeys = ['vidacorSession', 'themeMode'];
    Object.keys(localStorage).forEach(key => {
        if (!keepKeys.includes(key) && !key.startsWith('vidacorNome_')) {
            localStorage.removeItem(key);
        }
    });

    // Aplica tema salvo
    const themeMode = localStorage.getItem('themeMode') || 'light';
    if (typeof applyTheme === 'function') applyTheme(themeMode);

    // Configura data mínima no campo de próxima visita
    const dataInput = document.getElementById('dataVisitaObra');
    if (dataInput) dataInput.min = new Date().toISOString().split('T')[0];

    // Configura navegação por clique nos botões do menu inferior
    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => {
        b.addEventListener('click', () => {
            const screen = b.dataset.screen;
            if (screen && typeof navegarPara === 'function') navegarPara(screen);
        });
    });

    // Remove splash screen e inicia app
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }

        const session = localStorage.getItem('vidacorSession');
        if (session) {
            try {
                const u = JSON.parse(session);
                if (u && u.unidade && u.numero && u.nome) {
                    usuarioLogado = u;
                    const headerNome = document.getElementById('headerUserName');
                    if (headerNome) {
                        headerNome.textContent = u.nome;
                        headerNome.style.display = 'inline-block';
                    }
                    const painelCard = document.getElementById('painelGerenteCard');
                    if (painelCard) painelCard.style.display = u.numero === '01' ? 'block' : 'none';
                    if (typeof iniciarListenerObras === 'function') iniciarListenerObras();
                    if (typeof iniciarLocalizacaoObrigatoria === 'function') iniciarLocalizacaoObrigatoria();
                    if (typeof navegarPara === 'function') navegarPara('dashboardScreen');
                    return;
                }
            } catch (e) {
                // sessão inválida, prossegue para login
            }
        }
        if (typeof showLogin === 'function') showLogin();
    }, 1500);
});

// ==================== FALLBACK DE SEGURANÇA ====================
// Garante que a splash screen suma após 4 segundos mesmo se houver erro
setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash && splash.style.opacity !== '0') {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
        if (typeof showLogin === 'function') showLogin();
    }
}, 4000);
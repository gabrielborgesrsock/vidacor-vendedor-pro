// app.js - Inicialização do app (Firestore, sem localStorage)

let obras = [];
let metaVisitas = 5;
let chartStatusInstance, chartSemanalInstance, chartFunilInstance;
let usuarioLogado = null;
let unsubscribeObras = null;

window.addEventListener('load', () => {
    if (typeof monitorarConexao === 'function') monitorarConexao();

    // Aplica tema padrão até receber do Firestore
    applyTheme('light');

    const dataInput = document.getElementById('dataVisitaObra');
    if (dataInput) dataInput.min = new Date().toISOString().split('T')[0];

    document.querySelectorAll('.bottom-nav .nav-item').forEach(b => {
        b.addEventListener('click', () => {
            const screen = b.dataset.screen;
            if (screen && typeof navegarPara === 'function') navegarPara(screen);
        });
    });

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }

        // Tenta recuperar sessão do sessionStorage
        const session = sessionStorage.getItem('vidacorSession');
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

                    // Recupera tema do Firestore
                    db.collection('vendedores').doc(`${u.unidade}_${u.numero}`).get().then(doc => {
                        if (doc.exists && doc.data().tema) applyTheme(doc.data().tema);
                    });

                    // Recupera meta do Firestore
                    db.collection('vendedores').doc(`${u.unidade}_${u.numero}`).get().then(doc => {
                        if (doc.exists && doc.data().metaVisitas) {
                            metaVisitas = doc.data().metaVisitas;
                        }
                    });

                    if (typeof iniciarListenerObras === 'function') iniciarListenerObras();
                    if (typeof iniciarLocalizacaoObrigatoria === 'function') iniciarLocalizacaoObrigatoria();
                    if (typeof navegarPara === 'function') navegarPara('dashboardScreen');
                    return;
                }
            } catch (e) {}
        }
        if (typeof showLogin === 'function') showLogin();
    }, 1500);
});

// Fallback de segurança
setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (splash && splash.style.opacity !== '0') {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 500);
        if (typeof showLogin === 'function') showLogin();
    }
}, 4000);
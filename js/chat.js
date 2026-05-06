// chat.js - Módulo de chat da equipe + vendedores online

let unsubscribeChat = null;
let lastReadTimestamp = Date.now();

// ==================== INICIAR CHAT (TELA CHAT SCREEN) ====================
function iniciarChat() {
    if (!usuarioLogado) return;
    if (unsubscribeChat) unsubscribeChat();

    // Listener de mensagens (últimas 50)
    unsubscribeChat = db.collection('chat')
        .orderBy('timestamp', 'asc')
        .limit(50)
        .onSnapshot(snap => {
            const container = document.getElementById('chatMessages');
            if (!container) return;
            container.innerHTML = '';
            snap.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement('div');
                div.className = 'chat-message';
                const isMe = msg.numero === usuarioLogado.numero && msg.unidade === usuarioLogado.unidade;
                div.style.cssText = isMe ? 'background:rgba(62,59,159,0.15);' : '';
                div.innerHTML = `<strong>${isMe ? 'Você' : msg.nome} (${msg.unidade} - ${msg.numero}):</strong> ${msg.texto}<br><small class="text-muted">${new Date(msg.timestamp).toLocaleTimeString('pt-BR')}</small>`;
                container.appendChild(div);
            });
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            atualizarBadgeNaoLidas();
        });

    // Listener de "digitando..."
    const digitandoRef = db.collection('chat_digitando');
    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('focus', () => {
            digitandoRef.doc(usuarioLogado.unidade + '_' + usuarioLogado.numero).set({
                nome: usuarioLogado.nome,
                timestamp: Date.now()
            });
        });
        input.addEventListener('blur', () => {
            digitandoRef.doc(usuarioLogado.unidade + '_' + usuarioLogado.numero).delete();
        });
    }
    digitandoRef.onSnapshot(snap => {
        const digitando = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (d.nome !== usuarioLogado.nome && (Date.now() - d.timestamp < 10000)) {
                digitando.push(d.nome);
            }
        });
        const el = document.getElementById('digitandoIndicator');
        if (el) el.innerHTML = digitando.length ? `${digitando.join(', ')} digitando...` : '';
    });

    // Atualiza vendedores online (movido para cá)
    atualizarVendedoresOnline();

    lastReadTimestamp = Date.now();
}

// ==================== VENDEDORES ONLINE ====================
function atualizarVendedoresOnline() {
    const container = document.getElementById('onlineVendedores');
    if (!container || !usuarioLogado) return;
    db.collection('localizacoes')
        .onSnapshot(snap => {
            const agora = Date.now();
            const online = [];
            snap.forEach(doc => {
                const d = doc.data();
                if (agora - d.timestamp < 10 * 60 * 1000) {
                    online.push(`${d.nome} (${d.unidade} - ${d.numero})`);
                }
            });
            container.innerHTML = online.length
                ? online.map(n => `<div><span class="online-dot"></span>${n}</div>`).join('')
                : '<small class="text-muted">Nenhum vendedor online no momento.</small>';
        });
}

// ==================== ENVIAR MENSAGEM ====================
function enviarMensagem() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto || !usuarioLogado) return;
    input.value = '';
    db.collection('chat').add({
        unidade: usuarioLogado.unidade,
        numero: usuarioLogado.numero,
        nome: usuarioLogado.nome,
        texto,
        timestamp: Date.now()
    }).then(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        playChatSound();
    }).catch(() => showToast('Erro ao enviar mensagem.', 'error'));
}

// ==================== BADGE DE NÃO LIDAS ====================
function atualizarBadgeNaoLidas() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const mensagens = container.querySelectorAll('.chat-message');
    let naoLidas = 0;
    mensagens.forEach(m => {
        const timestamp = parseInt(m.dataset.timestamp);
        if (timestamp > lastReadTimestamp) naoLidas++;
    });
    const badge = document.getElementById('badgeChat');
    if (badge) {
        badge.textContent = naoLidas;
        badge.style.display = naoLidas > 0 ? 'flex' : 'none';
    }
}

// ==================== APAGAR MENSAGEM ====================
async function apagarMensagem(id) {
    if (!confirm('Apagar sua mensagem?')) return;
    try {
        await db.collection('chat').doc(id).delete();
    } catch (e) {
        showToast('Erro ao apagar.', 'error');
    }
}

// ==================== CITAÇÃO ====================
let mensagemCitada = null;
function citarMensagem(texto) {
    mensagemCitada = texto;
    const preview = document.getElementById('citacaoPreview');
    if (preview) {
        preview.innerHTML = `Respondendo: "${texto}" <span onclick="cancelarCitacao()" style="cursor:pointer; color:red;">✕</span>`;
        preview.style.display = 'block';
    }
    document.getElementById('chatInput').focus();
}
function cancelarCitacao() {
    mensagemCitada = null;
    const preview = document.getElementById('citacaoPreview');
    if (preview) preview.style.display = 'none';
}

// Atalho Enter
document.addEventListener('keypress', e => {
    if (e.target && e.target.id === 'chatInput' && e.key === 'Enter') {
        enviarMensagem();
    }
});
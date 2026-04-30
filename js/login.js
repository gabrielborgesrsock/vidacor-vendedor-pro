// login.js - Tela de login e autenticação do vendedor

// ==================== EXIBIR LOGIN ====================
function showLogin() {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.innerHTML = `
        <div class="glass-card" style="width:90%;max-width:400px;padding:30px;color:var(--text-primary);background:var(--card-bg);">
            <div class="text-center mb-3">
                <img src="logo-vidacor.png" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="max-width:80px; display:block; margin:0 auto;" />
                <div style="display:none;"><svg width="50" height="50" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="var(--vidacor-yellow)"/><text x="50%" y="50%" dy=".3em" text-anchor="middle" fill="var(--vidacor-primary)" font-size="22" font-weight="bold">VT</text></svg></div>
            </div>
            <h4 class="text-center mb-4">VIDACOR VENDEDOR PRO</h4>
            <label class="form-label fw-bold">Unidade Vidacor</label>
            <select id="loginUnidade" class="form-select rounded-pill mb-3" onchange="atualizarSelectNumero()">
                <option value="">Selecione...</option>
                <option value="Treze de Maio">Treze de Maio</option>
                <option value="Pres. Vargas">Pres. Vargas</option>
                <option value="João Fiusa">João Fiusa</option>
                <option value="S. S. Paraíso">S. S. Paraíso</option>
                <option value="Fábrica">Fábrica</option>
            </select>
            <label class="form-label fw-bold">Número do vendedor</label>
            <select id="loginNumero" class="form-select rounded-pill mb-3" onchange="preencherNomeEdicao()">
                <option value="">Escolha...</option>
            </select>
            <label class="form-label fw-bold">Seu Nome</label>
            <input type="text" id="loginNome" class="form-control rounded-pill mb-4" placeholder="Digite seu nome">
            <button class="btn btn-vidacor w-100 rounded-pill py-2" onclick="efetuarLogin()">Entrar</button>
        </div>`;
}

// ==================== ATUALIZAR SELECT DE NÚMERO ====================
function atualizarSelectNumero() {
    const unidade = document.getElementById('loginUnidade').value;
    const select = document.getElementById('loginNumero');
    if (!select) return;
    select.innerHTML = '<option value="">Escolha...</option>';
    for (let i = 1; i <= 5; i++) {
        const num = i.toString().padStart(2,'0');
        const nomeSalvo = localStorage.getItem(`vidacorNome_${unidade}_${num}`) || '(Sem Nome)';
        const cargo = num === '01' ? 'Gerente - ' : '';
        select.innerHTML += `<option value="${num}">${num} - ${cargo}${nomeSalvo}</option>`;
    }
    preencherNomeEdicao();
}

// ==================== PREENCHER NOME AUTOMATICAMENTE ====================
function preencherNomeEdicao() {
    const unidade = document.getElementById('loginUnidade').value;
    const numero = document.getElementById('loginNumero').value;
    const nomeInput = document.getElementById('loginNome');
    if (unidade && numero && nomeInput) {
        nomeInput.value = localStorage.getItem(`vidacorNome_${unidade}_${numero}`) || '';
    } else if (nomeInput) {
        nomeInput.value = '';
    }
}

// ==================== EFETUAR LOGIN ====================
function efetuarLogin() {
    const unidade = document.getElementById('loginUnidade')?.value;
    const numero = document.getElementById('loginNumero')?.value;
    const nome = document.getElementById('loginNome')?.value.trim();
    if (!unidade || !numero) return showToast('Selecione unidade e número.');
    if (!nome) return showToast('Informe seu nome.');
    
    usuarioLogado = { unidade, numero, nome };
    localStorage.setItem('vidacorSession', JSON.stringify(usuarioLogado));
    localStorage.setItem(`vidacorNome_${unidade}_${numero}`, nome);
    
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
    
    const headerNome = document.getElementById('headerUserName');
    if (headerNome) {
        headerNome.textContent = nome;
        headerNome.style.display = 'inline-block';
    }
    
    if (typeof iniciarListenerObras === 'function') iniciarListenerObras();
    if (typeof iniciarLocalizacaoObrigatoria === 'function') iniciarLocalizacaoObrigatoria();
    navegarPara('dashboardScreen');
    showToast(`Bem-vindo(a), ${nome}! 👋`);
    
    const painelCard = document.getElementById('painelGerenteCard');
    if (painelCard) painelCard.style.display = numero === '01' ? 'block' : 'none';
}

// ==================== TROCAR VENDEDOR ====================
function trocarVendedor() {
    if (!confirm('Deseja desconectar?')) return;
    if (typeof unsubscribeObras === 'function' && unsubscribeObras) unsubscribeObras();
    if (typeof unsubscribeChat === 'function' && unsubscribeChat) unsubscribeChat();
    if (typeof unsubscribeEquipe === 'function' && unsubscribeEquipe) unsubscribeEquipe();
    if (watchIdLoc) { navigator.geolocation.clearWatch(watchIdLoc); watchIdLoc = null; }
    localStorage.removeItem('vidacorSession');
    usuarioLogado = null;
    obras = [];
    
    const headerNome = document.getElementById('headerUserName');
    if (headerNome) headerNome.style.display = 'none';
    
    showLogin();
}
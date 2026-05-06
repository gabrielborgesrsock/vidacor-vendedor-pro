// ferramentas.js - Calculadora, tema, painel do gerente, GPS, fotos, voz, autocomplete

let watchIdLoc = null;
let fotosTemp = [];

function iniciarRecursosFerramentas() {
    // Nada específico necessário ao abrir a tela
}

// ==================== CALCULADORA ====================
document.addEventListener('DOMContentLoaded', () => {
    const calcularBtn = document.getElementById('calcular-btn');
    if (calcularBtn) {
        calcularBtn.addEventListener('click', () => {
            const area = parseFloat(document.getElementById('area-wall')?.value);
            const rend = parseFloat(document.getElementById('textura-tipo')?.value);
            if (isNaN(area) || area <= 0) {
                const resultado = document.getElementById('resultado-wallcril');
                if (resultado) resultado.innerHTML = '<p style="color:#ffaa00">⚠️ Insira uma área válida.</p>';
                return;
            }
            const nome = document.getElementById('textura-tipo')?.selectedOptions[0]?.text?.split(' (')[0] || '';
            const peso = area * rend, selador = peso * 0.1;
            const resultado = document.getElementById('resultado-wallcril');
            if (resultado) {
                resultado.innerHTML = `
                    <hr style="border-color:rgba(255,255,255,0.3);">
                    <p>📐 Área: <strong>${area.toFixed(2)} m²</strong></p>
                    <p>🎨 Textura: <strong>${nome}</strong></p>
                    <p>⚖️ Peso textura: <strong>${peso.toFixed(2)} kg</strong></p>
                    <p>🛢️ Barricas textura (30kg): <strong>${Math.ceil(peso/30)}</strong></p>
                    <p>🧴 Selador: <strong>${selador.toFixed(2)} kg</strong></p>
                    <p>🛢️ Barricas selador (25kg): <strong>${Math.ceil(selador/25)}</strong></p>`;
            }
        });
    }

    // Cancelar formulário
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            if (document.getElementById('nomeObra')?.value && !confirm('Descartar alterações?')) return;
            navegarPara('listaScreen');
        });
    }

    // Enviar formulário de obra
    const formObra = document.getElementById('formObra');
    if (formObra) {
        formObra.addEventListener('submit', async function(e) {
            e.preventDefault();
            const nomeInput = document.getElementById('nomeObra');
            const endInput = document.getElementById('enderecoObra');
            if (!nomeInput || !endInput) return;
            if (!nomeInput.value.trim()) {
                nomeInput.classList.add('form-error');
                showToast('Nome obrigatório.', 'error');
                return;
            }
            if (!endInput.value.trim()) {
                endInput.classList.add('form-error');
                showToast('Endereço obrigatório.', 'error');
                return;
            }
            nomeInput.classList.remove('form-error');
            endInput.classList.remove('form-error');

            const btnSalvar = document.getElementById('btnSalvar');
            const btnText = document.getElementById('btnSalvarText');
            const btnSpinner = document.getElementById('btnSalvarSpinner');
            if (btnSalvar) btnSalvar.disabled = true;
            if (btnText) btnText.textContent = 'Salvando...';
            if (btnSpinner) btnSpinner.classList.remove('d-none');

            const id = document.getElementById('editId')?.value || null;
            const numero = document.getElementById('numeroObra')?.value || '';
            const obraData = {
                firestoreId: id,
                nome: nomeInput.value.trim(),
                endereco: endInput.value.trim() + (numero ? ', ' + numero : ''),
                contato: document.getElementById('contatoObra')?.value || '',
                telefone: document.getElementById('telefoneObra')?.value || '',
                observacoes: document.getElementById('observacoesObra')?.value || '',
                estagio: document.getElementById('estagioObra')?.value || 'prospecção',
                status: document.getElementById('statusObra')?.value || 'pendente',
                clientePotencial: document.getElementById('clientePotencial')?.checked || false,
                coords: document.getElementById('coordsObra')?.value || '',
                dataProximaVisita: document.getElementById('dataVisitaObra')?.value || '',
                fotos: fotosTemp,   // as fotos ficam aqui só para o salvador usar na subcoleção
                dataCriacao: id ? null : Date.now()
            };

            // Não salvamos mais as fotos no campo oculto do documento
            try {
                await salvarObra(obraData);
                navegarPara('listaScreen');
            } catch (err) {
                // erro já tratado em salvarObra
            } finally {
                if (btnSalvar) btnSalvar.disabled = false;
                if (btnText) btnText.textContent = '💾 Salvar Obra';
                if (btnSpinner) btnSpinner.classList.add('d-none');
            }
        });
    }
});

// ==================== PAINEL DO GERENTE ====================
function abrirPainelGerente() {
    const hoje = new Date().toISOString().split('T')[0];
    const vendedores = {};
    obras.forEach(o => {
        if (!vendedores[o.criadoPorNumero]) vendedores[o.criadoPorNumero] = { nome: o.criadoPorNome, visitasHoje: 0, fechadasMes: 0, total: 0 };
        vendedores[o.criadoPorNumero].total++;
        if (o.dataAtualizacao && o.dataAtualizacao.startsWith(hoje) && o.status === 'visitada') vendedores[o.criadoPorNumero].visitasHoje++;
        if (o.status === 'fechada' && o.dataAtualizacao && new Date(o.dataAtualizacao).getMonth() === new Date().getMonth()) vendedores[o.criadoPorNumero].fechadasMes++;
    });
    let html = '<table class="table table-sm table-striped"><thead><tr><th>Nº</th><th>Nome</th><th>Total</th><th>Visitas Hoje</th><th>Fechadas Mês</th></tr></thead><tbody>';
    Object.keys(vendedores).sort().forEach(num => {
        html += `<tr><td>${num}</td><td>${vendedores[num].nome || '(Sem Nome)'}</td><td>${vendedores[num].total}</td><td>${vendedores[num].visitasHoje}</td><td>${vendedores[num].fechadasMes}</td></tr>`;
    });
    html += '</tbody></table>';
    const conteudo = document.getElementById('gerenteConteudo');
    if (conteudo) {
        conteudo.innerHTML = html || '<p>Sem dados.</p>';
        new bootstrap.Modal(document.getElementById('modalGerente')).show();
    }
}

// ==================== GPS ====================
async function obterLocalizacao() {
    const btn = document.getElementById('gpsBtn');
    if (!btn) return;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.disabled = true;
    if (!navigator.geolocation) {
        showToast('GPS não suportado.', 'error');
        btn.innerHTML = '<i class="bi bi-geo-alt"></i>';
        btn.disabled = false;
        return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
        document.getElementById('coordsObra').value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`);
            const data = await res.json();
            if (data?.address) {
                let logradouro = data.address.road || data.display_name.split(',')[0] || '';
                if (data.address.house_number && logradouro.includes(data.address.house_number))
                    logradouro = logradouro.replace(data.address.house_number, '').trim();
                document.getElementById('enderecoObra').value = logradouro;
                if (data.address.house_number) document.getElementById('numeroObra').value = data.address.house_number;
                showToast('Endereço preenchido automaticamente!', 'success');
            }
        } catch (e) { showToast('Coordenadas obtidas.', 'info'); }
        btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
        btn.disabled = false;
    }, () => {
        showToast('Erro ao obter localização.', 'error');
        btn.innerHTML = '<i class="bi bi-geo-alt"></i>';
        btn.disabled = false;
    }, { enableHighAccuracy: true });
}

// ==================== BUSCA POR VOZ ====================
function toggleVoiceSearch() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return showToast('Reconhecimento de voz não suportado.', 'error');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.onresult = e => {
        document.getElementById('buscaObra').value = e.results[0][0].transcript;
        listarObras();
    };
    recognition.onerror = () => showToast('Erro no reconhecimento de voz.', 'error');
    recognition.start();
    showToast('Fale o nome da obra...', 'info');
}

// ==================== AUTOCOMPLETE ENDEREÇO ====================
let autocompleteTimer;
function autocompleteEndereco(val) {
    clearTimeout(autocompleteTimer);
    const list = document.getElementById('autocompleteList');
    if (!list) return;
    if (val.length < 3) { list.style.display = 'none'; return; }
    autocompleteTimer = setTimeout(async () => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=br`);
            const data = await res.json();
            if (data.length) {
                list.innerHTML = data.map(d => `<div onclick="selecionarEndereco('${d.display_name.replace(/'/g, "\\'")}', ${d.lat}, ${d.lon})">${d.display_name}</div>`).join('');
                list.style.display = 'block';
            } else list.style.display = 'none';
        } catch (e) { list.style.display = 'none'; }
    }, 500);
}
function selecionarEndereco(endereco, lat, lng) {
    document.getElementById('enderecoObra').value = endereco;
    document.getElementById('coordsObra').value = `${lat}, ${lng}`;
    document.getElementById('autocompleteList').style.display = 'none';
}

// ==================== FOTOS ====================
function previewFotos(input) {
    const container = document.getElementById('fotosPreview');
    if (!container) return;
    const files = Array.from(input.files).slice(0, 3);
    fotosTemp = [];
    container.innerHTML = '';
    document.getElementById('fotoCount').textContent = `${files.length}/3`;
    files.forEach(f => {
        resizeImage(f, 800, b64 => {
            fotosTemp.push(b64);
            const img = document.createElement('img'); img.src = b64; img.className = 'img-thumb'; container.appendChild(img);
        });
    });
}
function resizeImage(file, maxW, cb) {
    const r = new FileReader();
    r.onload = e => {
        const i = new Image();
        i.onload = () => {
            let c = document.createElement('canvas'), w = i.width, h = i.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(i, 0, 0, w, h);
            cb(c.toDataURL('image/jpeg', 0.8));
        };
        i.src = e.target.result;
    };
    r.readAsDataURL(file);
}

// ==================== RESET FORMULÁRIO ====================
function resetForm() {
    const form = document.getElementById('formObra');
    if (form) form.reset();
    document.getElementById('fotosPreview').innerHTML = '';
    document.getElementById('fotosBase64').value = '';
    document.getElementById('editId').value = '';
    document.getElementById('numeroObra').value = '';
    document.getElementById('dataVisitaObra').min = new Date().toISOString().split('T')[0];
    document.getElementById('gpsBtn').innerHTML = '<i class="bi bi-geo-alt"></i>';
    document.getElementById('autocompleteList').style.display = 'none';
    document.getElementById('cadastroTitle').textContent = '🆕 Cadastrar Obra';
    document.querySelectorAll('.form-error').forEach(el => el.classList.remove('form-error'));
    fotosTemp = [];
}

// ==================== LOCALIZAÇÃO OBRIGATÓRIA ====================
function iniciarLocalizacaoObrigatoria() {
    if (!usuarioLogado || !navigator.geolocation) return;
    if (watchIdLoc) { navigator.geolocation.clearWatch(watchIdLoc); watchIdLoc = null; }
    const syncIcon = document.getElementById('locSyncIcon');
    if (syncIcon) syncIcon.style.display = 'inline-block';
    watchIdLoc = navigator.geolocation.watchPosition(pos => {
        db.collection('localizacoes').doc(`${usuarioLogado.unidade}_${usuarioLogado.numero}`).set({
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            nome: usuarioLogado.nome, numero: usuarioLogado.numero,
            unidade: usuarioLogado.unidade, timestamp: Date.now()
        }).then(() => { if (syncIcon) syncIcon.style.display = 'none'; })
          .catch(() => { if (syncIcon) syncIcon.style.display = 'none'; });
    }, err => { if (syncIcon) syncIcon.style.display = 'none'; }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 });
}
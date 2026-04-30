// obras.js - CRUD de obras, listagem, detalhes e replicação

// ==================== FIRESTORE LISTENER ====================
function iniciarListenerObras() {
    if (!usuarioLogado || !usuarioLogado.unidade) return;
    if (unsubscribeObras) unsubscribeObras();
    unsubscribeObras = db.collection('obras')
        .where('unidade', '==', usuarioLogado.unidade)
        .onSnapshot(snapshot => {
            obras = [];
            snapshot.forEach(doc => obras.push({ ...doc.data(), firestoreId: doc.id }));
            atualizarTelaAtual();
            atualizarFiltrosVendedor();
        }, err => showToast('Erro ao carregar obras. Verifique conexão.'));
}

// ==================== ATUALIZAR FILTROS DE VENDEDOR ====================
function atualizarFiltrosVendedor() {
    const vendedoresSet = new Set();
    obras.forEach(o => vendedoresSet.add(o.criadoPorNumero + ' - ' + (o.criadoPorNome || '')));
    const html = '<option value="">Todos os vendedores</option>' +
        Array.from(vendedoresSet).sort().map(v => `<option value="${v.split(' - ')[0]}">${v}</option>`).join('');
    const filtroLista = document.getElementById('filtroVendedor');
    const filtroMapa = document.getElementById('mapFiltroVendedor');
    if (filtroLista) filtroLista.innerHTML = html;
    if (filtroMapa) filtroMapa.innerHTML = html;
}

// ==================== ATUALIZAR TELA ATUAL ====================
function atualizarTelaAtual() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    if (active.id === 'dashboardScreen' && typeof carregarDashboard === 'function') carregarDashboard();
    else if (active.id === 'listaScreen' && typeof listarObras === 'function') listarObras();
    else if (active.id === 'mapaScreen') { adicionarMarcadores(); adicionarMarcadoresEquipe(); }
    else if (active.id === 'ferramentasScreen' && typeof iniciarRecursosFerramentas === 'function') iniciarRecursosFerramentas();
}

// ==================== CRUD ====================
async function salvarObra(obraData) {
    const obraParaSalvar = {
        ...obraData,
        unidade: usuarioLogado.unidade,
        criadoPorNome: usuarioLogado.nome,
        criadoPorNumero: usuarioLogado.numero,
        criadoPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`,
        dataAtualizacao: new Date().toISOString()
    };
    try {
        if (obraData.firestoreId) {
            await db.collection('obras').doc(obraData.firestoreId).update(obraParaSalvar);
        } else {
            await db.collection('obras').add(obraParaSalvar);
        }
        showToast('Obra salva com sucesso! ✅');
        playSuccessSound();
    } catch(e) {
        showToast('Erro ao salvar: ' + e.message);
        throw e;
    }
}

async function excluirObra(firestoreId, nome) {
    if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
        await db.collection('obras').doc(firestoreId).delete();
        showToast('Obra excluída.');
        navegarPara('listaScreen');
    } catch(e) {
        showToast('Erro ao excluir.');
    }
}

// ==================== LISTAGEM ====================
function getObrasFiltradas() {
    const txt = document.getElementById('buscaObra')?.value.toLowerCase() || '';
    const st = document.getElementById('filtroStatus')?.value || '';
    const est = document.getElementById('filtroEstagio')?.value || '';
    const ord = document.getElementById('ordenacaoLista')?.value || 'recentes';
    const verArq = document.getElementById('mostrarArquivadas')?.checked || false;
    const filtroVend = document.getElementById('filtroVendedor')?.value || '';
    const filtroData = document.getElementById('filtroDataVisita')?.value || '';
    const agora = new Date();

    let ativas = obras.filter(o => {
        if (!verArq && o.status === 'fechada' && o.dataAtualizacao && (agora - new Date(o.dataAtualizacao)) > 30*24*3600*1000) return false;
        const matchTexto = !txt || (o.nome || '').toLowerCase().includes(txt) || (o.endereco || '').toLowerCase().includes(txt);
        const matchStatus = !st || o.status === st;
        const matchEstagio = !est || o.estagio === est;
        const matchVend = !filtroVend || o.criadoPorNumero === filtroVend;
        const matchData = !filtroData || (o.ultimaVisitaData && o.ultimaVisitaData.startsWith(filtroData));
        return matchTexto && matchStatus && matchEstagio && matchVend && matchData;
    });

    // Ordenação assíncrona para "mais próximas"
    if (ord === 'maisProximas' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            ativas.sort((a, b) => {
                const [latA, lngA] = (a.coords || '0,0').split(',').map(Number);
                const [latB, lngB] = (b.coords || '0,0').split(',').map(Number);
                return haversine(pos.coords.latitude, pos.coords.longitude, latA, lngA) -
                       haversine(pos.coords.latitude, pos.coords.longitude, latB, lngB);
            });
            listarObras(); // re-renderiza após ordenação
        });
    }

    switch(ord) {
        case 'recentes':    ativas.sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao)); break;
        case 'antigas':     ativas.sort((a,b) => new Date(a.dataCriacao) - new Date(b.dataCriacao)); break;
        case 'nomeAZ':      ativas.sort((a,b) => (a.nome||'').localeCompare(b.nome||'')); break;
        case 'nomeZA':      ativas.sort((a,b) => (b.nome||'').localeCompare(a.nome||'')); break;
        case 'proxVis':     ativas.sort((a,b) => (a.dataProximaVisita||'9999') > (b.dataProximaVisita||'9999') ? 1 : -1); break;
        case 'proxVisDesc': ativas.sort((a,b) => (b.dataProximaVisita||'0000') > (a.dataProximaVisita||'0000') ? 1 : -1); break;
    }
    return ativas;
}

function listarObras() {
    const container = document.getElementById('listaObrasContainer');
    if (!container) return;
    const obrasF = getObrasFiltradas();
    if (!obrasF.length) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Nenhuma obra encontrada.</p></div>';
        return;
    }
    container.innerHTML = obrasF.map(o => {
        const badge = o.clientePotencial ? ' ⭐' : '';
        const isNova = (new Date() - new Date(o.dataCriacao)) < 86400000;
        const novidade = isNova ? '<span class="badge bg-warning text-dark ms-1">NOVA</span>' : '';
        const podeEditar = o.criadoPorNumero === usuarioLogado.numero || usuarioLogado.numero === '01';
        let visitColor = 'gray', visitText = 'Nunca visitada';
        if (o.ultimaVisitaData) {
            const diff = (new Date() - new Date(o.ultimaVisitaData)) / (1000*60*60*24);
            if (diff < 1) { visitColor = '#00e676'; visitText = 'Visitada hoje'; }
            else if (diff < 3) { visitColor = '#ffc107'; visitText = '2-3 dias'; }
            else if (diff < 7) { visitColor = '#ff9800'; visitText = '4-7 dias'; }
            else { visitColor = '#f44336'; visitText = '+7 dias'; }
        }
        const telLimpo = (o.telefone||'').replace(/\D/g,'');
        const contatoIcons = telLimpo ? `
            <span class="card-icons ms-2">
                <a href="tel:${telLimpo}" onclick="event.stopPropagation();" title="Ligar"><i class="bi bi-telephone"></i></a>
                <a href="https://wa.me/55${telLimpo}" target="_blank" onclick="event.stopPropagation();" title="WhatsApp"><i class="bi bi-whatsapp"></i></a>
            </span>` : '';
        return `<div class="card-obra" onclick="verDetalhe('${o.firestoreId}')">
            <div class="d-flex align-items-start justify-content-between">
                <div>
                    <span class="visit-indicator" style="background:${visitColor};" title="${visitText}"></span>
                    <strong>${o.nome}${badge}${novidade}</strong>
                    <div class="text-muted small mt-1">${o.endereco}</div>
                    <div class="mt-1"><small class="badge bg-secondary me-1">${o.estagio}</small><small class="badge" style="background:${visitColor}">${o.status}</small>${contatoIcons}</div>
                </div>
            </div>
            ${podeEditar ? `<div class="mt-2 d-flex gap-2">
                <button class="btn btn-sm btn-warning rounded-pill" onclick="event.stopPropagation(); visitaRapida('${o.firestoreId}')">✅ Visitar</button>
                <button class="btn btn-sm btn-success rounded-pill" onclick="event.stopPropagation(); fecharRapido('${o.firestoreId}')">🤝 Fechar</button>
                <button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="event.stopPropagation(); replicarObra('${o.firestoreId}')" title="Replicar"><i class="bi bi-files"></i></button>
            </div>` : ''}
        </div>`;
    }).join('');
}

function copiarEndereco(endereco) {
    navigator.clipboard.writeText(endereco).then(() => showToast('Endereço copiado! 📋'));
}

// ==================== AÇÕES RÁPIDAS ====================
function visitaRapida(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    const now = new Date().toISOString();
    db.collection('obras').doc(firestoreId).update({
        status: 'visitada', dataAtualizacao: now,
        ultimaVisitaData: now,
        ultimaVisitaPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`
    }).then(() => { playSuccessSound(); showToast('Obra visitada! ✅'); })
      .catch(() => showToast('Erro ao atualizar.'));
}

function fecharRapido(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    const now = new Date().toISOString();
    db.collection('obras').doc(firestoreId).update({
        status: 'fechada', dataAtualizacao: now,
        ultimaVisitaPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`
    }).then(() => { playSuccessSound(); showToast('Obra fechada! 🎉'); })
      .catch(() => showToast('Erro ao atualizar.'));
}

function replicarObra(firestoreId) {
    const original = obras.find(o => o.firestoreId === firestoreId);
    if (!original) return;
    const novaObra = { ...original, firestoreId: null, nome: original.nome + ' (cópia)',
        dataCriacao: new Date().toISOString(), criadoPorNome: usuarioLogado.nome,
        criadoPorNumero: usuarioLogado.numero, criadoPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}` };
    salvarObra(novaObra).then(() => showToast('Obra replicada!')).catch(() => {});
}

// ==================== DETALHES DA OBRA ====================
function verDetalhe(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    const fotosHtml = (obra.fotos||[]).map(f => `<img src="${f}" class="img-thumb" loading="lazy" onclick="openLightbox('${f}')">`).join('');
    const podeEditar = obra.criadoPorNumero === usuarioLogado.numero || usuarioLogado.numero === '01';
    const tel = (obra.telefone||'').replace(/\D/g,'');
    const contatoIcons = tel ? `
        <a href="tel:${tel}" class="btn btn-sm btn-outline-success me-1"><i class="bi bi-telephone"></i> Ligar</a>
        <a href="https://wa.me/55${tel}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-whatsapp"></i> WhatsApp</a>` : '';
    const detalheDiv = document.getElementById('detalheConteudo');
    if (!detalheDiv) return;
    detalheDiv.innerHTML = `
        <h4>${obra.nome} ${obra.clientePotencial ? '⭐' : ''}</h4>
        ${fotosHtml ? `<div class="mb-3">${fotosHtml}</div>` : ''}
        <div class="glass-card">
            <p class="mb-1"><strong>📍 Endereço:</strong> <span style="cursor:pointer;color:var(--vidacor-primary);" onclick="copiarEndereco('${obra.endereco.replace(/'/g,"\\'")}')">
                ${obra.endereco} <i class="bi bi-clipboard"></i></span></p>
            <p class="mb-1"><strong>👤 Contato:</strong> ${obra.contato||'-'}</p>
            ${tel ? `<p class="mb-2">${contatoIcons}</p>` : ''}
            <p class="mb-1"><strong>📝 Obs:</strong> ${obra.observacoes||'-'}</p>
            <p class="mb-1"><strong>🏗️ Estágio:</strong> ${obra.estagio} &nbsp; <strong>Status:</strong> ${obra.status}</p>
            <p class="mb-1"><strong>📅 Próx. visita:</strong> ${obra.dataProximaVisita ? new Date(obra.dataProximaVisita+'T00:00:00').toLocaleDateString('pt-BR') : 'Não definida'}</p>
            <p class="mb-0"><small class="text-muted">Criado por: ${obra.criadoPor||'---'} · Última visita: ${obra.ultimaVisitaPor||'---'}</small></p>
        </div>
        ${obra.coords ? `<div class="d-flex gap-2 mb-3">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${obra.coords}" target="_blank" class="btn btn-outline-primary rounded-pill flex-fill">🗺️ Como chegar</a>
            <button class="btn btn-outline-secondary rounded-pill flex-fill" onclick="verNoMapa('${obra.firestoreId}')">📍 Ver no mapa</button>
        </div>` : ''}
        ${podeEditar ? `<div class="d-flex gap-2 flex-wrap mb-3">
            <button class="btn btn-outline-primary rounded-pill" onclick="editarObra('${obra.firestoreId}')">✏️ Editar</button>
            <button class="btn btn-outline-danger rounded-pill" onclick="excluirObra('${obra.firestoreId}', '${obra.nome.replace(/'/g,"\\'")}')">🗑️ Excluir</button>
            <button class="btn btn-outline-secondary rounded-pill" onclick="replicarObra('${obra.firestoreId}')"><i class="bi bi-files"></i> Replicar</button>
        </div>` : ''}
        ${obra.historico?.length ? `<div class="glass-card"><h6>📋 Histórico</h6>${obra.historico.map(h => `<div class="small mb-1">${new Date(h.data).toLocaleString('pt-BR')}: ${h.descricao}</div>`).join('')}</div>` : ''}
    `;
    navegarPara('detalheScreen');
}

function editarObra(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    document.getElementById('cadastroTitle').textContent = '✏️ Editar Obra';
    document.getElementById('editId').value = obra.firestoreId;
    document.getElementById('nomeObra').value = obra.nome;
    const partes = (obra.endereco||'').split(',');
    document.getElementById('enderecoObra').value = partes[0]?.trim() || '';
    document.getElementById('numeroObra').value = partes.length > 1 ? partes.slice(1).join(',').trim() : '';
    document.getElementById('contatoObra').value = obra.contato || '';
    document.getElementById('telefoneObra').value = obra.telefone || '';
    document.getElementById('observacoesObra').value = obra.observacoes || '';
    document.getElementById('estagioObra').value = obra.estagio;
    document.getElementById('statusObra').value = obra.status;
    document.getElementById('clientePotencial').checked = obra.clientePotencial || false;
    document.getElementById('coordsObra').value = obra.coords || '';
    document.getElementById('dataVisitaObra').value = obra.dataProximaVisita || '';
    const prev = document.getElementById('fotosPreview');
    if (prev) prev.innerHTML = (obra.fotos||[]).map(f => `<img src="${f}" class="img-thumb">`).join('');
    document.getElementById('fotosBase64').value = JSON.stringify(obra.fotos || []);
    document.getElementById('fotoCount').textContent = `${(obra.fotos||[]).length}/3`;
    navegarPara('cadastroScreen');
}
// obras.js - CRUD de obras, visualização GLOBAL, sem botão Replicar

const OBRAS_POR_PAGINA = 20;
let ultimoDocumento = null;
let obrasPagina = [];
let unsubscribeAtualizacoes = null;

function iniciarListenerObras() {
    if (!usuarioLogado) return;
    if (unsubscribeObras) unsubscribeObras();
    carregarPagina(1);
}

async function carregarPagina(direcao) {
    let query = db.collection('obras')
        .orderBy('dataCriacao', 'desc')
        .limit(OBRAS_POR_PAGINA);

    if (direcao === 2 && ultimoDocumento) {
        query = query.startAfter(ultimoDocumento);
    }

    try {
        const snapshot = await query.get();
        if (snapshot.empty) {
            if (direcao === 1) showToast('Nenhuma obra cadastrada.', 'info');
            return;
        }

        obrasPagina = [];
        snapshot.forEach(doc => obrasPagina.push({ ...doc.data(), firestoreId: doc.id }));
        ultimoDocumento = snapshot.docs[snapshot.docs.length - 1];

        obras = obrasPagina;
        atualizarTelaAtual();
        atualizarFiltrosVendedor();

        ativarListenerHibrido();
    } catch (e) {
        showToast('Erro ao carregar obras. Verifique o índice composto no Firestore.', 'error');
        console.error(e);
    }
}

function ativarListenerHibrido() {
    if (unsubscribeAtualizacoes) unsubscribeAtualizacoes();

    const idsExibidos = obrasPagina.map(o => o.firestoreId);
    if (idsExibidos.length === 0) return;

    unsubscribeAtualizacoes = db.collection('obras')
        .where(firebase.firestore.FieldPath.documentId(), 'in', idsExibidos)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const updatedDoc = { ...change.doc.data(), firestoreId: change.doc.id };
                    const index = obrasPagina.findIndex(o => o.firestoreId === change.doc.id);
                    if (index !== -1) {
                        obrasPagina[index] = updatedDoc;
                        obras = obrasPagina;
                        listarObras();
                        atualizarFiltrosVendedor();
                    }
                } else if (change.type === 'removed') {
                    obrasPagina = obrasPagina.filter(o => o.firestoreId !== change.doc.id);
                    obras = obrasPagina;
                    listarObras();
                    atualizarFiltrosVendedor();
                }
            });
        }, error => console.error('Erro no listener híbrido:', error));
}

async function carregarMaisObras() {
    if (!ultimoDocumento) return;
    try {
        const snapshot = await db.collection('obras')
            .orderBy('dataCriacao', 'desc')
            .startAfter(ultimoDocumento)
            .limit(OBRAS_POR_PAGINA)
            .get();

        if (snapshot.empty) {
            showToast('Todas as obras foram carregadas.', 'info');
            return;
        }

        snapshot.forEach(doc => obrasPagina.push({ ...doc.data(), firestoreId: doc.id }));
        ultimoDocumento = snapshot.docs[snapshot.docs.length - 1];
        obras = obrasPagina;
        listarObras();
        ativarListenerHibrido();
    } catch (e) {
        showToast('Erro ao carregar mais obras.', 'error');
    }
}

function atualizarFiltrosVendedor() {
    const vendedoresSet = new Set();
    obrasPagina.forEach(o => vendedoresSet.add(o.criadoPorNumero + ' - ' + (o.criadoPorNome || '')));
    const html = '<option value="">Todos os vendedores</option>' +
        Array.from(vendedoresSet).sort().map(v => `<option value="${v.split(' - ')[0]}">${v}</option>`).join('');
    document.getElementById('filtroVendedor').innerHTML = html;
    document.getElementById('mapFiltroVendedor').innerHTML = html;

    const unidadesSet = new Set();
    obrasPagina.forEach(o => unidadesSet.add(o.unidade));
    const htmlUnidades = '<option value="">Todas as unidades</option>' +
        Array.from(unidadesSet).sort().map(u => `<option value="${u}">${u}</option>`).join('');
    document.getElementById('filtroUnidade').innerHTML = htmlUnidades;
    document.getElementById('mapFiltroUnidade').innerHTML = htmlUnidades;
}

function atualizarTelaAtual() {
    const active = document.querySelector('.screen.active');
    if (!active) return;
    if (active.id === 'dashboardScreen') carregarDashboard();
    else if (active.id === 'listaScreen') listarObras();
    else if (active.id === 'mapaScreen') { adicionarMarcadores(); adicionarMarcadoresEquipe(); }
    else if (active.id === 'ferramentasScreen') iniciarRecursosFerramentas();
}

async function salvarObra(obraData) {
    const now = Date.now();
    const obraParaSalvar = {
        nome: obraData.nome,
        endereco: obraData.endereco,
        contato: obraData.contato || '',
        telefone: obraData.telefone || '',
        observacoes: obraData.observacoes || '',
        estagio: obraData.estagio,
        status: obraData.status,
        clientePotencial: obraData.clientePotencial || false,
        coords: obraData.coords || '',
        dataProximaVisita: obraData.dataProximaVisita || '',
        unidade: usuarioLogado.unidade,
        criadoPorNome: usuarioLogado.nome,
        criadoPorNumero: usuarioLogado.numero,
        criadoPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`,
        dataCriacao: obraData.dataCriacao || now,
        dataAtualizacao: now
    };

    // Remove campo 'fotos' do documento principal, fotos ficam apenas na subcoleção
    const fotosParaSalvar = obraData.fotos || [];
    delete obraParaSalvar.fotos;

    try {
        let obraRef;
        if (obraData.firestoreId) {
            obraRef = db.collection('obras').doc(obraData.firestoreId);
            await obraRef.update(obraParaSalvar);
            showToast('Obra atualizada!', 'success');
        } else {
            obraRef = await db.collection('obras').add(obraParaSalvar);
            showToast('Obra cadastrada com sucesso!', 'success');
        }

        // Salva as fotos na subcoleção, se houver novas
        if (fotosParaSalvar.length > 0) {
            const fotosRef = obraRef.collection('fotos');
            for (const base64 of fotosParaSalvar) {
                await fotosRef.add({ base64, dataCriacao: now });
            }
        }

        const historicoRef = obraRef.collection('historico');
        await historicoRef.add({
            descricao: obraData.firestoreId ? 'Obra editada' : 'Obra criada',
            data: now
        });

        playSuccessSound();
        return obraRef.id;
    } catch (e) {
        showToast('Erro ao salvar: ' + e.message, 'error');
        throw e;
    }
}

async function excluirObra(firestoreId, nome) {
    if (!confirm(`Excluir "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
        await excluirSubcolecoes(firestoreId);
        await db.collection('obras').doc(firestoreId).delete();
        showToast('Obra excluída.', 'success');
        navegarPara('listaScreen');
    } catch (e) {
        showToast('Erro ao excluir.', 'error');
    }
}

async function excluirSubcolecoes(firestoreId) {
    const obraRef = db.collection('obras').doc(firestoreId);
    const fotosSnapshot = await obraRef.collection('fotos').get();
    fotosSnapshot.forEach(doc => doc.ref.delete());
    const histSnapshot = await obraRef.collection('historico').get();
    histSnapshot.forEach(doc => doc.ref.delete());
}

function getObrasFiltradas() {
    const txt = document.getElementById('buscaObra')?.value.toLowerCase() || '';
    const st = document.getElementById('filtroStatus')?.value || '';
    const est = document.getElementById('filtroEstagio')?.value || '';
    const ord = document.getElementById('ordenacaoLista')?.value || 'recentes';
    const verArq = document.getElementById('mostrarArquivadas')?.checked || false;
    const filtroVend = document.getElementById('filtroVendedor')?.value || '';
    const filtroData = document.getElementById('filtroDataVisita')?.value || '';
    const filtroUnidade = document.getElementById('filtroUnidade')?.value || '';
    const agora = Date.now();
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;

    let ativas = obras.filter(o => {
        if (!verArq && o.status === 'fechada' && o.dataAtualizacao && (agora - o.dataAtualizacao) > trintaDiasMs) return false;

        const matchTexto = !txt || (o.nome || '').toLowerCase().includes(txt) || (o.endereco || '').toLowerCase().includes(txt);
        const matchStatus = !st || o.status === st;
        const matchEstagio = !est || o.estagio === est;
        const matchVend = !filtroVend || o.criadoPorNumero === filtroVend;

        let matchData = true;
        if (filtroData) {
            if (!o.ultimaVisitaData) {
                matchData = false;
            } else {
                const dataVisita = new Date(o.ultimaVisitaData);
                const dataFiltro = new Date(filtroData + 'T00:00:00');
                matchData = dataVisita.toDateString() === dataFiltro.toDateString();
            }
        }

        const matchUnidade = !filtroUnidade || o.unidade === filtroUnidade;
        return matchTexto && matchStatus && matchEstagio && matchVend && matchData && matchUnidade;
    });

    switch (ord) {
        case 'recentes': ativas.sort((a, b) => (b.dataCriacao || 0) - (a.dataCriacao || 0)); break;
        case 'antigas':  ativas.sort((a, b) => (a.dataCriacao || 0) - (b.dataCriacao || 0)); break;
        case 'nomeAZ':   ativas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')); break;
        case 'nomeZA':   ativas.sort((a, b) => (b.nome || '').localeCompare(a.nome || '')); break;
        case 'proxVis':  ativas.sort((a, b) => (a.dataProximaVisita || '9999') > (b.dataProximaVisita || '9999') ? 1 : -1); break;
        case 'proxVisDesc': ativas.sort((a, b) => (b.dataProximaVisita || '0000') > (a.dataProximaVisita || '0000') ? 1 : -1); break;
    }
    return ativas;
}

function listarObras() {
    const container = document.getElementById('listaObrasContainer');
    if (!container) return;
    container.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

    const obrasF = getObrasFiltradas();
    if (!obrasF.length) {
        container.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Nenhuma obra encontrada.</p></div>';
        return;
    }

    container.innerHTML = obrasF.map(o => {
        const badge = o.clientePotencial ? ' ⭐' : '';
        const isNova = (Date.now() - (o.dataCriacao || 0)) < 86400000;
        const novidade = isNova ? '<span class="badge bg-warning text-dark ms-1">NOVA</span>' : '';
        const podeEditar = o.criadoPorNumero === usuarioLogado.numero || usuarioLogado.numero === '01';
        let visitColor = 'gray', visitText = 'Nunca visitada';
        if (o.ultimaVisitaData) {
            const diff = (Date.now() - o.ultimaVisitaData) / (1000 * 60 * 60 * 24);
            if (diff < 1) { visitColor = '#00e676'; visitText = 'Visitada hoje'; }
            else if (diff < 3) { visitColor = '#ffc107'; visitText = '2-3 dias'; }
            else if (diff < 7) { visitColor = '#ff9800'; visitText = '4-7 dias'; }
            else { visitColor = '#f44336'; visitText = '+7 dias'; }
        }
        const telLimpo = (o.telefone || '').replace(/\D/g, '');
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
                    <div class="text-muted small mt-1">${o.endereco} <span class="badge bg-light text-dark ms-1">${o.unidade}</span></div>
                    <div class="mt-1"><small class="badge status-badge ${o.status}">${o.status}</small>${contatoIcons}</div>
                </div>
            </div>
            ${podeEditar ? `<div class="mt-2 d-flex gap-2">
                <button class="btn btn-sm btn-warning rounded-pill" onclick="event.stopPropagation(); visitaRapida('${o.firestoreId}')">✅ Visitar</button>
                <button class="btn btn-sm btn-success rounded-pill" onclick="event.stopPropagation(); fecharRapido('${o.firestoreId}')">🤝 Fechar</button>
            </div>` : ''}
        </div>`;
    }).join('');

    if (obrasPagina.length >= OBRAS_POR_PAGINA) {
        container.insertAdjacentHTML('beforeend', `
            <div class="text-center mt-2">
                <button class="btn btn-outline-primary rounded-pill" onclick="carregarMaisObras()">Carregar mais obras</button>
            </div>`);
    }
}

async function visitaRapida(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    const now = Date.now();
    await db.collection('obras').doc(firestoreId).update({
        status: 'visitada',
        dataAtualizacao: now,
        ultimaVisitaData: now,
        ultimaVisitaPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`
    });
    await db.collection('obras').doc(firestoreId).collection('historico').add({
        descricao: 'Obra visitada',
        data: now
    });
    playSuccessSound();
    showToast('Obra visitada!', 'success');
}

async function fecharRapido(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    const now = Date.now();
    await db.collection('obras').doc(firestoreId).update({
        status: 'fechada',
        dataAtualizacao: now,
        ultimaVisitaPor: `${usuarioLogado.numero} - ${usuarioLogado.nome}`
    });
    await db.collection('obras').doc(firestoreId).collection('historico').add({
        descricao: 'Obra fechada',
        data: now
    });
    playSuccessSound();
    showToast('Obra fechada! 🎉', 'success');
}

async function verDetalhe(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;

    let fotosHtml = '';
    try {
        const fotosSnapshot = await db.collection('obras').doc(firestoreId).collection('fotos').get();
        fotosSnapshot.forEach(doc => {
            fotosHtml += `<img src="${doc.data().base64}" class="img-thumb" loading="lazy" onclick="openLightbox('${doc.data().base64}')">`;
        });
    } catch (e) { /* sem fotos */ }

    let historicoHtml = '';
    try {
        const histSnapshot = await db.collection('obras').doc(firestoreId).collection('historico').orderBy('data', 'desc').get();
        histSnapshot.forEach(doc => {
            const h = doc.data();
            const data = h.data ? new Date(h.data).toLocaleString('pt-BR') : '';
            historicoHtml += `<div class="small mb-1">${data}: ${h.descricao}</div>`;
        });
    } catch (e) { /* sem histórico */ }

    const podeEditar = obra.criadoPorNumero === usuarioLogado.numero || usuarioLogado.numero === '01';
    const tel = (obra.telefone || '').replace(/\D/g, '');
    const contatoIcons = tel ? `
        <a href="tel:${tel}" class="btn btn-sm btn-outline-success me-1"><i class="bi bi-telephone"></i> Ligar</a>
        <a href="https://wa.me/55${tel}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-whatsapp"></i> WhatsApp</a>` : '';
    const detalheDiv = document.getElementById('detalheConteudo');
    if (!detalheDiv) return;
    detalheDiv.innerHTML = `
        <h4>${obra.nome} ${obra.clientePotencial ? '⭐' : ''}</h4>
        ${fotosHtml ? `<div class="mb-3">${fotosHtml}</div>` : ''}
        <div class="glass-card">
            <p class="mb-1"><strong>📍 Endereço:</strong> <span style="cursor:pointer;color:var(--vidacor-primary);" onclick="copiarEndereco('${obra.endereco.replace(/'/g,"\\'")}')">${obra.endereco} <i class="bi bi-clipboard"></i></span></p>
            <p class="mb-1"><strong>👤 Contato:</strong> ${obra.contato || '-'}</p>
            ${tel ? `<p class="mb-2">${contatoIcons}</p>` : ''}
            <p class="mb-1"><strong>📝 Obs:</strong> ${obra.observacoes || '-'}</p>
            <p class="mb-1"><strong>🏗️ Estágio:</strong> ${obra.estagio} &nbsp; <strong>Status:</strong> ${obra.status}</p>
            <p class="mb-1"><strong>📅 Próx. visita:</strong> ${obra.dataProximaVisita ? new Date(obra.dataProximaVisita + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não definida'}</p>
            <p class="mb-0"><small class="text-muted">Criado por: ${obra.criadoPor || '---'} · Última visita: ${obra.ultimaVisitaPor || '---'}</small></p>
        </div>
        ${obra.coords ? `<div class="d-flex gap-2 mb-3">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${obra.coords}" target="_blank" class="btn btn-outline-primary rounded-pill flex-fill">🗺️ Como chegar</a>
            <button class="btn btn-outline-secondary rounded-pill flex-fill" onclick="verNoMapa('${obra.firestoreId}')">📍 Ver no mapa</button>
        </div>` : ''}
        ${podeEditar ? `<div class="d-flex gap-2 flex-wrap mb-3">
            <button class="btn btn-outline-primary rounded-pill" onclick="editarObra('${obra.firestoreId}')">✏️ Editar</button>
            <button class="btn btn-outline-danger rounded-pill" onclick="excluirObra('${obra.firestoreId}', '${obra.nome.replace(/'/g,"\\'")}')">🗑️ Excluir</button>
        </div>` : ''}
        ${historicoHtml ? `<div class="glass-card"><h6>📋 Histórico</h6>${historicoHtml}</div>` : ''}
    `;
    navegarPara('detalheScreen');
}

function editarObra(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra) return;
    document.getElementById('cadastroTitle').textContent = '✏️ Editar Obra';
    document.getElementById('editId').value = obra.firestoreId;
    document.getElementById('nomeObra').value = obra.nome;
    const partes = (obra.endereco || '').split(',');
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
    if (prev) {
        prev.innerHTML = '';
        db.collection('obras').doc(firestoreId).collection('fotos').get().then(snapshot => {
            const fotos = [];
            snapshot.forEach(doc => {
                fotos.push(doc.data().base64);
                prev.innerHTML += `<img src="${doc.data().base64}" class="img-thumb">`;
            });
            document.getElementById('fotosBase64').value = JSON.stringify(fotos);
            document.getElementById('fotoCount').textContent = `${fotos.length}/3`;
        });
    }
    navegarPara('cadastroScreen');
}
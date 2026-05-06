// dashboard.js - Dashboard com gráficos, clima e resumo (filtrado por vendedor)

let resumosMostrados = []; // substitui o localStorage

function carregarDashboard() {
    // Filtra apenas obras relacionadas ao vendedor logado
    const minhasObras = usuarioLogado
        ? obras.filter(o => o.criadoPorNumero === usuarioLogado.numero ||
                           (o.ultimaVisitaPor && o.ultimaVisitaPor.startsWith(usuarioLogado.numero + ' -')))
        : [];

    const eixoColor = getComputedStyle(document.body).getPropertyValue('--chart-text').trim() || '#333';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,0.1)';
    const hoje = new Date();

    // Gráfico semanal (visitas dentro das obras do vendedor)
    const semana = [], visitasPorDia = Array(7).fill(0);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(d.getDate() - i);
        semana.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }) + ' ' + d.getDate());
    }
    minhasObras.forEach(o => {
        if (o.status === 'visitada' && o.dataAtualizacao) {
            const dataVisita = new Date(o.dataAtualizacao);
            const dia = dataVisita.toDateString();
            for (let i = 0; i < 7; i++) {
                const d = new Date(hoje);
                d.setDate(d.getDate() - i);
                if (d.toDateString() === dia) visitasPorDia[6 - i]++;
            }
        }
    });
    if (chartSemanalInstance) chartSemanalInstance.destroy();
    chartSemanalInstance = new Chart(document.getElementById('chartSemanal').getContext('2d'), {
        type: 'bar',
        data: { labels: semana, datasets: [{ data: visitasPorDia, backgroundColor: '#3E3B9F', borderRadius: 8, label: 'Visitas' }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: eixoColor } }, y: { beginAtZero: true, ticks: { stepSize: 1, color: eixoColor }, grid: { color: gridColor } } } }
    });

    // Funil de estágios (obras do vendedor)
    const estagios = ['prospecção', 'fundação', 'estrutura', 'acabamento', 'finalizada'];
    const contagemEst = estagios.map(e => minhasObras.filter(o => o.estagio === e && o.status !== 'fechada').length);
    if (chartFunilInstance) chartFunilInstance.destroy();
    chartFunilInstance = new Chart(document.getElementById('chartFunil').getContext('2d'), {
        type: 'bar',
        data: { labels: estagios, datasets: [{ data: contagemEst, backgroundColor: '#3E3B9F', borderRadius: 8 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, color: eixoColor }, grid: { color: gridColor } }, y: { ticks: { color: eixoColor } } } }
    });

    // Contadores (obras do vendedor)
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
    const ativas = minhasObras.filter(o => {
        if (o.status === 'fechada' && o.dataAtualizacao) {
            const dataAtualizacao = new Date(o.dataAtualizacao);
            if ((hoje - dataAtualizacao) > trintaDiasMs) return false;
        }
        return true;
    });
    const vHoje = ativas.filter(o => {
        if (o.status !== 'visitada' || !o.dataAtualizacao) return false;
        const dataVisita = new Date(o.dataAtualizacao);
        return dataVisita.toDateString() === hoje.toDateString();
    }).length;

    document.getElementById('countVisitas').textContent = vHoje;
    document.getElementById('countPendentes').textContent = ativas.filter(o => o.status === 'pendente').length;
    document.getElementById('countProspeccao').textContent = ativas.filter(o => o.estagio === 'prospecção').length;
    document.getElementById('countFechadas').textContent = ativas.filter(o => o.status === 'fechada').length;

    // Meta circular
    const pct = Math.min((vHoje / metaVisitas) * 100, 100);
    const progressCircle = document.querySelector('.progress-circle');
    if (progressCircle) progressCircle.style.strokeDashoffset = 251.2 - (251.2 * pct / 100);
    const metaTexto = document.getElementById('metaTextoCircular');
    if (metaTexto) metaTexto.textContent = `${vHoje}/${metaVisitas}`;
    if (vHoje >= metaVisitas) playMetaSound();

    // Gráfico de status (obras do vendedor)
    const pend = ativas.filter(o => o.status === 'pendente').length;
    const visit = ativas.filter(o => o.status === 'visitada').length;
    const fech = ativas.filter(o => o.status === 'fechada').length;
    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(document.getElementById('chartStatus').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['Pendente', 'Visitada', 'Fechada'], datasets: [{ data: [pend, visit, fech], backgroundColor: ['#6c757d', '#ffc107', '#28a745'] }] },
        options: { plugins: { legend: { position: 'bottom', labels: { color: eixoColor } } } }
    });

    // Próximas visitas (obras do vendedor)
    const proximas = ativas.filter(o => o.status !== 'fechada' && o.dataProximaVisita).sort((a, b) => new Date(a.dataProximaVisita) - new Date(b.dataProximaVisita)).slice(0, 5);
    const proximasDiv = document.getElementById('proximasObrasList');
    if (proximasDiv) {
        proximasDiv.innerHTML = proximas.length
            ? proximas.map(o => `<div class="card-obra" onclick="verDetalhe('${o.firestoreId}')"><strong>${o.nome}</strong><br><small>📅 ${new Date(o.dataProximaVisita + 'T00:00:00').toLocaleDateString('pt-BR')} · ${o.endereco}</small></div>`).join('')
            : '<p class="text-muted small">Nenhuma visita agendada.</p>';
    }

    // Resumo semanal (segunda-feira) — agora usando memória, sem localStorage
    if (hoje.getDay() === 1 && !resumosMostrados.includes(hoje.toDateString())) {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - 7);
        const fechadasSemana = minhasObras.filter(o => {
            if (o.status !== 'fechada' || !o.dataAtualizacao) return false;
            const dataFechamento = new Date(o.dataAtualizacao);
            return dataFechamento >= inicioSemana && dataFechamento <= hoje;
        });
        if (fechadasSemana.length) {
            showToast(`📊 Semana anterior: ${fechadasSemana.length} obra(s) fechada(s).`, 'info');
            resumosMostrados.push(hoje.toDateString());
        }
    }

    // Badge de pendentes (global, não se limita ao vendedor)
    const pendentes = obras.filter(o => o.status === 'pendente').length;
    const badge = document.getElementById('badgePendentes');
    if (badge) {
        badge.textContent = pendentes;
        badge.style.display = pendentes > 0 ? 'flex' : 'none';
    }

    // Atualizar filtro de unidades (global)
    atualizarFiltroUnidades();
}

function atualizarFiltroUnidades() {
    const unidadesSet = new Set();
    obras.forEach(o => unidadesSet.add(o.unidade));
    const html = '<option value="">Todas as unidades</option>' +
        Array.from(unidadesSet).sort().map(u => `<option value="${u}">${u}</option>`).join('');
    document.getElementById('filtroUnidade').innerHTML = html;
    document.getElementById('mapFiltroUnidade').innerHTML = html;
}

async function obterClima() {
    if (!navigator.geolocation) return;
    const weatherIcons = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 80: '🌦️', 81: '🌦️', 82: '🌦️', 95: '⛈️', 96: '⛈️', 97: '⛈️' };
    const weatherDesc = { 0: 'Céu limpo', 1: 'Predominantemente limpo', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Nevoeiro', 48: 'Nevoeiro', 51: 'Chuvisco leve', 53: 'Chuvisco moderado', 55: 'Chuvisco denso', 61: 'Chuva leve', 63: 'Chuva moderada', 65: 'Chuva forte', 71: 'Neve leve', 73: 'Neve moderada', 75: 'Neve forte', 80: 'Pancadas leves', 81: 'Pancadas moderadas', 82: 'Pancadas fortes', 95: 'Tempestade', 96: 'Tempestade c/ granizo', 97: 'Tempestade forte' };
    navigator.geolocation.getCurrentPosition(async pos => {
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`);
            const data = await res.json();
            const code = data.current_weather.weathercode;
            document.getElementById('climaTemp').textContent = data.current_weather.temperature + '°C';
            document.getElementById('climaIcon').textContent = weatherIcons[code] || '🌡️';
            document.getElementById('climaDesc').textContent = weatherDesc[code] || 'Clima indisponível';
        } catch (e) {
            document.getElementById('climaDesc').textContent = 'Clima indisponível';
        }
    });
}
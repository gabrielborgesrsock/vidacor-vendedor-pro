// mapa.js - Mapa interativo com Leaflet, lojas fixas, localização e roteirização

const lojasVidacor = [
    { nome: "Treze de Maio", lat: -21.1779, lng: -47.7895, end: "Av. Treze de Maio, 651", tel: "(16) 3968-5600", wpp: "5516993233800" },
    { nome: "Pres. Vargas", lat: -21.2027, lng: -47.8098, end: "Av. Presidente Vargas, 2144", tel: "(16) 3913-8800", wpp: "5516993233800" },
    { nome: "João Fiusa", lat: -21.2157, lng: -47.8054, end: "Av. Prof. João Fiusa, 2360", tel: "(16) 3323-8600", wpp: "5516993233800" },
    { nome: "S. S. Paraíso", lat: -20.9263, lng: -46.9860, end: "Praça Abadia, 85", tel: "(35) 3558-5703", wpp: "5535988755300" },
    { nome: "Fábrica", lat: -21.1426, lng: -47.7838, end: "Av. Dezenove de Junho, 505", tel: "(16) 3913-8001", wpp: "5516993233800" }
];

let mapa, userMarker, markerCluster, tileLayerPadrao, tileLayerSatelite, currentLayer = 'padrao', lojasLayer;
let markersEquipe = [];
let unsubscribeEquipe = null;

function iniciarMapa() {
    if (!mapa) {
        mapa = L.map('map', { zoomControl: false }).setView([-21.178, -47.806], 14); // note: zoomControl: false remove os botões nativos

        const isDark = document.body.classList.contains('dark');
        tileLayerPadrao = L.tileLayer(isDark ?
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
            'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(mapa);
        tileLayerSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });

        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let cls = 'marker-cluster-small';
                if (count > 10) cls = 'marker-cluster-medium';
                if (count > 20) cls = 'marker-cluster-large';
                return L.divIcon({
                    html: `<div class="${cls}"><span>${count}</span></div>`,
                    className: 'marker-cluster',
                    iconSize: L.point(40, 40)
                });
            }
        });
        mapa.addLayer(markerCluster);

        lojasLayer = L.layerGroup().addTo(mapa);
        lojasVidacor.forEach(loja => {
            const icon = L.divIcon({
                html: '<div class="loja-icon">🏪</div>',
                className: '',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            const marker = L.marker([loja.lat, loja.lng], { icon });
            marker.bindPopup(`<b>🏪 Loja ${loja.nome}</b><br>${loja.end}<br>📞 <a href="tel:${loja.tel}">${loja.tel}</a><br>💬 <a href="https://wa.me/${loja.wpp}" target="_blank">WhatsApp</a>`);
            lojasLayer.addLayer(marker);
        });

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const iniciais = usuarioLogado ? usuarioLogado.nome.substring(0,2).toUpperCase() : 'VC';
                const userIcon = L.divIcon({
                    html: `<div class="user-marker">${iniciais}</div>`,
                    className: '',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });
                userMarker = L.marker([pos.coords.latitude, pos.coords.longitude], { icon: userIcon })
                    .addTo(mapa).bindPopup('📍 Você está aqui');
                mapa.setView([pos.coords.latitude, pos.coords.longitude], 14);
            });
        }

        mapa.on('contextmenu', async e => {
            document.getElementById('coordsObra').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
            try {
                let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&addressdetails=1`);
                let data = await res.json();
                if (data?.address) {
                    let logradouro = data.address.road || data.display_name.split(',')[0] || '';
                    if (data.address.house_number && logradouro.includes(data.address.house_number))
                        logradouro = logradouro.replace(data.address.house_number, '').trim();
                    document.getElementById('enderecoObra').value = logradouro;
                    if (data.address.house_number) document.getElementById('numeroObra').value = data.address.house_number;
                }
            } catch(ex) {}
            navegarPara('cadastroScreen');
        });

        const observer = new MutationObserver(() => {
            const dark = document.body.classList.contains('dark');
            if (currentLayer === 'padrao') {
                mapa.removeLayer(tileLayerPadrao);
                tileLayerPadrao = L.tileLayer(dark ?
                    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
                    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
                }).addTo(mapa);
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } else {
        mapa.invalidateSize();
    }
    adicionarMarcadores();
    adicionarMarcadoresEquipe();
    if (userMarker && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]));
    }
}

function adicionarMarcadores() {
    if (!markerCluster) return;
    markerCluster.clearLayers();
    const fP = document.getElementById('mapFiltroPendente')?.checked ?? true;
    const fV = document.getElementById('mapFiltroVisitada')?.checked ?? true;
    const fF = document.getElementById('mapFiltroFechada')?.checked ?? true;
    const filtroVend = document.getElementById('mapFiltroVendedor')?.value || '';
    const filtroUnidade = document.getElementById('mapFiltroUnidade')?.value || '';

    const colorMap = {
        pendente: 'var(--clr-pendente)',
        visitada: 'var(--clr-visitada)',
        fechada:  'var(--clr-fechada)'
    };

    obras.forEach(o => {
        if (!o.coords) return;
        if (!fP && o.status === 'pendente') return;
        if (!fV && o.status === 'visitada') return;
        if (!fF && o.status === 'fechada') return;
        if (filtroVend && o.criadoPorNumero !== filtroVend) return;
        if (filtroUnidade && o.unidade !== filtroUnidade) return;
        const [lat, lng] = o.coords.split(',').map(Number);
        if (isNaN(lat)) return;

        const color = colorMap[o.status] || 'var(--clr-pendente)';
        const icon = L.divIcon({
            html: `<div class="obra-marker" style="background:${color};"></div>`,
            className: '',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        const marker = L.marker([lat, lng], { icon });
        marker.on('click', function(e) {
            const vizinhos = obras.filter(v => {
                if (!v.coords || v.firestoreId === o.firestoreId) return false;
                const [vLat, vLng] = v.coords.split(',').map(Number);
                const dist = haversine(lat, lng, vLat, vLng);
                return dist <= 0.01;
            });

            if (vizinhos.length > 0) {
                let html = `<div style="max-height:200px; overflow-y:auto;">
                    <strong>${o.nome}</strong> (${o.status})<br>
                    <small>${o.endereco} · ${o.unidade}</small>
                    <hr style="margin:4px 0;">
                    <strong>Obras no mesmo local:</strong><br>`;
                vizinhos.forEach(v => {
                    html += `<div style="font-size:0.85rem; margin-bottom:2px;">
                        • <strong>${v.nome}</strong> (${v.status})<br>
                        <small>${v.endereco} · ${v.unidade}</small>
                    </div>`;
                });
                html += '</div>';
                marker.unbindPopup();
                marker.bindPopup(html, { maxWidth: 300, className: 'custom-popup' }).openPopup();
            } else {
                marker.unbindPopup();
                marker.bindPopup(`
                    <div style="padding:8px;">
                        <strong>${o.nome}</strong><br>
                        <small>${o.endereco} · ${o.unidade}</small><br>
                        <span class="status-badge ${o.status}">${o.status}</span>
                        <div class="mt-2 d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="verDetalhe('${o.firestoreId}')">Detalhes</button>
                            ${o.coords ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${o.coords}" target="_blank" class="btn btn-sm btn-outline-success rounded-pill">Rota</a>` : ''}
                        </div>
                    </div>
                `, { className: 'custom-popup' }).openPopup();
            }
        });
        markerCluster.addLayer(marker);
    });
}

function adicionarMarcadoresEquipe() {
    if (!mapa || !usuarioLogado) return;
    if (unsubscribeEquipe) { unsubscribeEquipe(); unsubscribeEquipe = null; }
    let markersEquipeLocal = [];
    unsubscribeEquipe = db.collection('localizacoes')
        .where('unidade', '==', usuarioLogado.unidade)
        .onSnapshot(snapshot => {
            markersEquipeLocal.forEach(m => mapa.removeLayer(m));
            markersEquipeLocal = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.numero === usuarioLogado.numero) return;
                const agora = Math.round((Date.now() - data.timestamp) / 60000);
                const tempo = agora < 1 ? 'agora' : `há ${agora} min`;
                const iniciais = data.nome ? data.nome.substring(0,2).toUpperCase() : '??';
                const icon = L.divIcon({
                    html: `<div style="width:22px;height:22px;border-radius:50%;background:#3E3B9F;color:white;font-size:0.55rem;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${iniciais}</div>`,
                    className: '',
                    iconSize: [22,22],
                    iconAnchor: [11,11]
                });
                const marker = L.marker([data.lat, data.lng], { icon })
                    .addTo(mapa)
                    .bindPopup(`<b>👤 ${data.nome}</b> (${data.numero})<br><small>Atualizado ${tempo}</small>`);
                markersEquipeLocal.push(marker);
            });
        });
}

function filtrarMarcadores() { adicionarMarcadores(); }
function centralizarUsuario() {
    navigator.geolocation.getCurrentPosition(pos => {
        if (mapa) mapa.setView([pos.coords.latitude, pos.coords.longitude], 16);
    });
}
function alternarCamada() {
    const select = document.getElementById('mapLayerSelect');
    if (!select) return;
    const layer = select.value;
    if (layer === 'satelite' && currentLayer !== 'satelite') {
        mapa.removeLayer(tileLayerPadrao); tileLayerSatelite.addTo(mapa); currentLayer = 'satelite';
    } else if (layer === 'padrao' && currentLayer !== 'padrao') {
        mapa.removeLayer(tileLayerSatelite); tileLayerPadrao.addTo(mapa); currentLayer = 'padrao';
    }
}
function abrirStreetView() {
    const c = mapa.getCenter();
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat},${c.lng}`, '_blank');
}
function toggleMapConfig() {
    document.getElementById('mapConfigDrawer').classList.toggle('open');
}
function verNoMapa(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra || !obra.coords) return showToast('Obra sem coordenadas.');
    const [lat, lng] = obra.coords.split(',').map(Number);
    if (isNaN(lat)) return;
    navegarPara('mapaScreen');
    setTimeout(() => { if (mapa) mapa.setView([lat, lng], 17); }, 500);
}
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function roteirizarDoMapa() {
    const pendentes = obras.filter(o => o.coords && o.status === 'pendente');
    if (pendentes.length < 2) return showToast('Mínimo 2 obras pendentes.');
    const waypoints = pendentes.map(o => o.coords.replace(',','%2C')).join('%7C');
    window.open(`https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${waypoints}`, '_blank');
}
function roteirizarSelecionadas() {
    const filtradas = getObrasFiltradas().filter(o => o.coords);
    if (filtradas.length < 2) return showToast('Mínimo 2 obras com coordenadas.');
    const waypoints = filtradas.map(o => o.coords.replace(',','%2C')).join('%7C');
    window.open(`https://www.google.com/maps/dir/?api=1&travelmode=driving&waypoints=${waypoints}`, '_blank');
}
function verObrasProximas() {
    if (!navigator.geolocation) return showToast('GPS não suportado.');
    navigator.geolocation.getCurrentPosition(pos => {
        const comCoords = obras.filter(o => o.coords && o.status !== 'fechada');
        if (!comCoords.length) return showToast('Nenhuma obra com localização.');
        comCoords.sort((a, b) => {
            const [latA, lngA] = a.coords.split(',').map(Number);
            const [latB, lngB] = b.coords.split(',').map(Number);
            return haversine(pos.coords.latitude, pos.coords.longitude, latA, lngA) -
                   haversine(pos.coords.latitude, pos.coords.longitude, latB, lngB);
        });
        navegarPara('mapaScreen');
        setTimeout(() => {
            if (mapa) {
                const bounds = comCoords.slice(0, 5).map(o => o.coords.split(',').map(Number));
                mapa.fitBounds(bounds, { padding: [30, 30] });
            }
        }, 600);
    }, () => showToast('Erro ao obter localização.'), { enableHighAccuracy: true });
}
async function buscarNoMapa() {
    const q = document.getElementById('buscaMapa')?.value; if (!q) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.length) mapa.setView([data[0].lat, data[0].lon], 16);
        else showToast('Endereço não encontrado.');
    } catch(e) { showToast('Erro ao buscar endereço.'); }
}
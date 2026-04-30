// mapa.js - Mapa interativo com Leaflet, lojas fixas, localização e roteirização

// ==================== LOJAS FIXAS ====================
const lojasVidacor = [
    { nome: "Treze de Maio", lat: -21.1779, lng: -47.7895, end: "Av. Treze de Maio, 651", tel: "(16) 3968-5600", wpp: "5516993233800" },
    { nome: "Pres. Vargas", lat: -21.2027, lng: -47.8098, end: "Av. Presidente Vargas, 2144", tel: "(16) 3913-8800", wpp: "5516993233800" },
    { nome: "João Fiusa", lat: -21.2157, lng: -47.8054, end: "Av. Prof. João Fiusa, 2360", tel: "(16) 3323-8600", wpp: "5516993233800" },
    { nome: "S. S. Paraíso", lat: -20.9263, lng: -46.9860, end: "Praça Abadia, 85", tel: "(35) 3558-5703", wpp: "5535988755300" },
    { nome: "Fábrica", lat: -21.1426, lng: -47.7838, end: "Av. Dezenove de Junho, 505", tel: "(16) 3913-8001", wpp: "5516993233800" }
];

// ==================== VARIÁVEIS DO MAPA ====================
let mapa, userMarker, markerCluster, tileLayerPadrao, tileLayerSatelite, currentLayer = 'padrao', lojasLayer;
let markersEquipe = [];
let unsubscribeEquipe = null;

// ==================== INICIALIZAÇÃO DO MAPA ====================
function iniciarMapa() {
    if (!mapa) {
        mapa = L.map('map', { zoomControl: false }).setView([-21.178, -47.806], 14);
        L.control.zoom({ position: 'bottomright' }).addTo(mapa);
        tileLayerPadrao = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
        }).addTo(mapa);
        tileLayerSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 });
        markerCluster = L.markerClusterGroup({ maxClusterRadius: 50 });
        mapa.addLayer(markerCluster);
        lojasLayer = L.layerGroup().addTo(mapa);
        lojasVidacor.forEach(loja => {
            const marker = L.marker([loja.lat, loja.lng], { icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png', iconSize: [25,41] }) });
            marker.bindPopup(`<b>🏪 Loja ${loja.nome}</b><br>${loja.end}<br>📞 <a href="tel:${loja.tel}">${loja.tel}</a><br>💬 <a href="https://wa.me/${loja.wpp}" target="_blank">WhatsApp</a>`);
            lojasLayer.addLayer(marker);
        });
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                userMarker = L.marker([pos.coords.latitude, pos.coords.longitude], {
                    icon: L.divIcon({ className: 'pulse-marker', iconSize: [20,20], iconAnchor: [10,10] })
                }).addTo(mapa).bindPopup('📍 Você está aqui');
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
    } else {
        mapa.invalidateSize();
    }
    adicionarMarcadores();
    adicionarMarcadoresEquipe();
    if (userMarker && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]));
    }
}

// ==================== MARCADORES DE OBRAS ====================
function adicionarMarcadores() {
    if (!markerCluster) return;
    markerCluster.clearLayers();
    const fP = document.getElementById('mapFiltroPendente')?.checked ?? true;
    const fV = document.getElementById('mapFiltroVisitada')?.checked ?? true;
    const fF = document.getElementById('mapFiltroFechada')?.checked ?? true;
    const filtroVend = document.getElementById('mapFiltroVendedor')?.value || '';
    obras.forEach(o => {
        if (!o.coords) return;
        if (!fP && o.status === 'pendente') return;
        if (!fV && o.status === 'visitada') return;
        if (!fF && o.status === 'fechada') return;
        if (filtroVend && o.criadoPorNumero !== filtroVend) return;
        const [lat, lng] = o.coords.split(',').map(Number); if (isNaN(lat)) return;
        const icons = {
            pendente: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            visitada: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
            fechada:  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
        };
        const marker = L.marker([lat, lng], { icon: L.icon({ iconUrl: icons[o.status] || icons.pendente, iconSize: [25,41] }) });
        marker.bindPopup(`<strong>${o.nome}</strong><br>${o.endereco}<br>Status: ${o.status}<br><small>Por: ${o.criadoPor||'---'}</small><br><button class="btn btn-sm btn-outline-primary mt-1" onclick="verDetalhe('${o.firestoreId}')">Ver detalhes</button>`);
        markerCluster.addLayer(marker);
    });
}

// ==================== MARCADORES DA EQUIPE ====================
function adicionarMarcadoresEquipe() {
    if (!mapa || !usuarioLogado) return;
    if (unsubscribeEquipe) { unsubscribeEquipe(); unsubscribeEquipe = null; }
    let markersEquipeLocais = [];
    unsubscribeEquipe = db.collection('localizacoes')
        .where('unidade', '==', usuarioLogado.unidade)
        .onSnapshot(snapshot => {
            markersEquipeLocais.forEach(m => mapa.removeLayer(m)); markersEquipeLocais = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.numero === usuarioLogado.numero) return;
                const agora = Math.round((Date.now() - data.timestamp) / 60000);
                const tempo = agora < 1 ? 'agora' : `há ${agora} min`;
                const m = L.marker([data.lat, data.lng], {
                    icon: L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png', iconSize: [25,41] })
                }).bindPopup(`<b>👤 ${data.nome}</b> (${data.numero})<br><small>Atualizado ${tempo}</small>`).addTo(mapa);
                markersEquipeLocais.push(m);
            });
        });
}

function filtrarMarcadores() { adicionarMarcadores(); }

// ==================== CONTROLES DO MAPA ====================
function centralizarUsuario() {
    navigator.geolocation.getCurrentPosition(pos => { if (mapa) mapa.setView([pos.coords.latitude, pos.coords.longitude], 16); });
}

function alternarCamada() {
    if (currentLayer === 'padrao') {
        mapa.removeLayer(tileLayerPadrao); tileLayerSatelite.addTo(mapa); currentLayer = 'satelite';
        document.getElementById('layerToggle').innerHTML = '<i class="bi bi-globe2"></i>';
    } else {
        mapa.removeLayer(tileLayerSatelite); tileLayerPadrao.addTo(mapa); currentLayer = 'padrao';
        document.getElementById('layerToggle').innerHTML = '<i class="bi bi-map"></i>';
    }
}

function abrirStreetView() { const c = mapa.getCenter(); window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c.lat},${c.lng}`, '_blank'); }

function toggleFullscreen() {
    const elem = document.getElementById('mapContainer');
    if (!document.fullscreenElement) elem.requestFullscreen().catch(() => showToast('Erro ao abrir tela cheia.'));
    else document.exitFullscreen();
}

function verNoMapa(firestoreId) {
    const obra = obras.find(o => o.firestoreId === firestoreId);
    if (!obra || !obra.coords) return showToast('Obra sem coordenadas.');
    const [lat, lng] = obra.coords.split(',').map(Number);
    if (isNaN(lat)) return;
    navegarPara('mapaScreen');
    setTimeout(() => { if (mapa) mapa.setView([lat, lng], 17); }, 500);
}

// ==================== ROTEIRIZAÇÃO ====================
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function roteirizarDoMapa() {
    const pendentes = obras.filter(o => o.coords && o.status === 'pendente');
    if (pendentes.length < 2) return showToast('Mínimo 2 obras pendentes com coordenadas.');
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
    showToast('Buscando obras próximas...');
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
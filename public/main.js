let todosLogs = [];
let logsFiltrados = []; // Nova variável para facilitar a paginação
let logsRealtime = [];
let logsHistorico = [];
let paginaAtual = 1;
const logsPorPagina = 50;
const socket = io();

// Escuta atualização em tempo real do nó via WebSocket
socket.on('atualizacao_logs', (data) => {
    console.log("📡 Dados recebidos via WebSocket");
    processarLogs(data);
});

window.carregarTodosLogs = async function () {
    try {
        document.getElementById('deviceIdInput').value = ''; 
        const response = await fetch('/api/logs');
        const data = await response.json();
        processarLogs(data);
    } catch (err) {
        console.error('Erro ao carregar logs:', err);
    }
};

window.buscarLogs = function () {
    paginaAtual = 1; // Reseta para a primeira página ao buscar
    const termoBusca = document.getElementById('deviceIdInput').value.toLowerCase();
    filtrarERenderizar(termoBusca);
};

// Removemos a função atualizarLimite antiga, pois agora é fixo em 50 por página
window.exportarCSV = function () {
    if (todosLogs.length === 0) return alert("Não há logs para exportar!");
    const cabecalho = ["Device ID", "Realtime", "Dispositivo", "Modelo", "CPU", "RAM", "Wi-Fi", "Dados Moveis", "Timestamp", "Status Adicional"];
    const linhas = todosLogs.map(log => {
        return [
            log.deviceId || "",
            log.isRealtime ? "SIM" : "NAO",
            log.nomeDispositivo || log.device || "",
            log.modelo || "",
            log.cpu || "",
            log.ram || "",
            log.wifi || "",
            log.dadosMoveis || "",
            log.timestamp || "",
            log.status || ""
        ].map(coluna => `"${String(coluna).replace(/"/g, '""')}"`).join(",");
    });
    const csvString = cabecalho.join(",") + "\n" + linhas.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "historico_devices.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function converterTimestamp(ts) {
    if (!ts) return 0;
    const partes = ts.split('_');
    if (partes.length !== 2) return 0;
    const diaMesAno = partes[0].split('-');
    const horaMinSeg = partes[1].split(':');
    return new Date(diaMesAno[2], diaMesAno[1] - 1, diaMesAno[0], horaMinSeg[0], horaMinSeg[1], horaMinSeg[2]).getTime();
}

function processarLogs(data) {
    if (!data) return;
    todosLogs = [];

    for (const deviceKey in data) {
        const deviceData = data[deviceKey];
        if (deviceKey === "TESTE_BOTAO") {
            todosLogs.push({ deviceId: deviceKey, isRealtime: true, nomeDispositivo: deviceData.device, modelo: "Botão de Teste", status: deviceData.status, timestamp: deviceData.timestamp });
            continue;
        }
        if (deviceData.status_realtime) {
            todosLogs.push({ deviceId: deviceKey, isRealtime: true, ...deviceData.status_realtime });
        }
        if (deviceData.historico) {
            for (const logKey in deviceData.historico) {
                todosLogs.push({ deviceId: deviceKey, isRealtime: false, ...deviceData.historico[logKey] });
            }
        }
    }

    todosLogs.sort((a, b) => converterTimestamp(b.timestamp) - converterTimestamp(a.timestamp));
    filtrarERenderizar(document.getElementById('deviceIdInput').value.toLowerCase());
}

// ✅ Nova função para gerenciar o filtro e a paginação
function filtrarERenderizar(termoBusca = "") {
    logsFiltrados = todosLogs.filter(log => {
        const id = (log.deviceId || "").toLowerCase();
        const nome = (log.nomeDispositivo || log.device || "").toLowerCase();
        const modelo = (log.modelo || "").toLowerCase();
        return id.includes(termoBusca) || nome.includes(termoBusca) || modelo.includes(termoBusca);
    });

    // Separar os logs de realtime e histórico
    logsRealtime = logsFiltrados.filter(log => log.isRealtime);
    logsHistorico = logsFiltrados.filter(log => !log.isRealtime);

    renderizarLogs();
}

function criarElementoLog(log) {
    const div = document.createElement('div');
    div.className = 'log';
    let alertaRAM = "";
    let estiloExtra = "";

    if (log.ram) {
        const valores = log.ram.match(/(\d+(\.\d+)?)/g);
        if (valores && valores.length >= 2) {
            const atual = parseFloat(valores[0]);
            const total = parseFloat(valores[1]);
            const percentual = (atual / total) * 100;
            if (percentual >= 75) {
                alertaRAM = `<div style="color: #ff0000; font-weight: bold; margin-top: 5px; border: 2px solid red; padding: 5px; background: #fff;">⚠️ ALERTA: RAM > 75% (${percentual.toFixed(1)}%)</div>`;
                estiloExtra = "border-left: 10px solid #ff0000 !important; background-color: #fff0f0;";
            }
        }
    }

    if (log.isRealtime && !estiloExtra) {
        div.style.borderLeft = "5px solid #00ff00";
    } else if (estiloExtra) {
        div.style.cssText = estiloExtra;
    }

    div.innerHTML = `
        <div style="margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee;">
            <strong>Nome: ${log.nomeDispositivo || log.device || 'Sem Nome'}</strong> <br>
            <small>Modelo: ${log.modelo || 'N/A'} | ID: ${log.deviceId}</small><br>
            <span>🕒 ${log.timestamp} ${log.isRealtime ? ' <b>(AGORA)</b>' : ''}</span><br>
            <b>CPU:</b> ${log.cpu || '-'} | <b>RAM:</b> ${log.ram || '-'}<br>
            <b>Wi-Fi:</b> ${log.wifi || '-'} | <b>Dados Móveis:</b> ${log.dadosMoveis || '-'}<br>
            ${alertaRAM}
        </div>
    `;
    return div;
}

function renderizarLogs() {
    const logContainer = document.getElementById('log-container');
    const realtimeContainer = document.getElementById('realtime-container');
    const paginationContainer = document.getElementById('pagination');
    logContainer.innerHTML = '';
    if (realtimeContainer) realtimeContainer.innerHTML = '';
    paginationContainer.innerHTML = '';

    // ✅ Renderizar logs Realtime (sem paginação, mostra todos os ativos)
    if (logsRealtime.length === 0 && realtimeContainer) {
        realtimeContainer.innerHTML = '<p style="text-align: center; color: #777;">Nenhum dispositivo em tempo real no momento.</p>';
    } else if (realtimeContainer) {
        logsRealtime.forEach(log => {
            realtimeContainer.appendChild(criarElementoLog(log));
        });
    }

    // ✅ Cálculo de fatias para a página atual (apenas para o Histórico)
    const inicio = (paginaAtual - 1) * logsPorPagina;
    const fim = inicio + logsPorPagina;
    const logsExibicao = logsHistorico.slice(inicio, fim);

    logsExibicao.forEach(log => {
        logContainer.appendChild(criarElementoLog(log));
    });

    renderizarBotoesPaginacao();
}

// ✅ Função para criar os botões de Próximo/Anterior
function renderizarBotoesPaginacao() {
    const paginationContainer = document.getElementById('pagination');
    const totalPaginas = Math.ceil(logsHistorico.length / logsPorPagina);

    if (totalPaginas <= 1) return;

    const btnAnterior = document.createElement('button');
    btnAnterior.innerText = "Anterior";
    btnAnterior.disabled = paginaAtual === 1;
    btnAnterior.onclick = () => { paginaAtual--; renderizarLogs(); window.scrollTo(0,0); };

    const spanInfo = document.createElement('span');
    spanInfo.innerText = ` Página ${paginaAtual} de ${totalPaginas} `;
    spanInfo.style.margin = "0 15px";

    const btnProximo = document.createElement('button');
    btnProximo.innerText = "Próximo";
    btnProximo.disabled = paginaAtual === totalPaginas;
    btnProximo.onclick = () => { paginaAtual++; renderizarLogs(); window.scrollTo(0,0); };

    paginationContainer.appendChild(btnAnterior);
    paginationContainer.appendChild(spanInfo);
    paginationContainer.appendChild(btnProximo);
}

window.onload = () => window.carregarTodosLogs();
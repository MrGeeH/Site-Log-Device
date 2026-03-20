let todosLogs = [];
let limiteExibicao = 50;
const socket = io();

// Escuta atualização em tempo real do nó
// CORREÇÃO: Alterado de 'atualizacao_geral' para 'atualizacao_logs' para combinar com o index.js
socket.on('atualizacao_logs', (data) => {
    console.log("📡 Dados recebidos via WebSocket");
    processarLogs(data);
});

window.carregarTodosLogs = async function () {
    try {
        document.getElementById('deviceIdInput').value = ''; // Limpa a busca
        const response = await fetch('/api/logs');
        const data = await response.json();
        processarLogs(data);
    } catch (err) {
        console.error('Erro ao carregar logs:', err);
    }
};

// Funções da UI (Buscar, Limite, CSV) que estavam faltando
window.buscarLogs = function () {
    const termoBusca = document.getElementById('deviceIdInput').value.toLowerCase();
    renderizarLogs(termoBusca);
};

window.atualizarLimite = function () {
    const limiteValue = document.getElementById('limitSelect').value;
    limiteExibicao = limiteValue === 'all' ? Infinity : parseInt(limiteValue);
    renderizarLogs(document.getElementById('deviceIdInput').value.toLowerCase());
};

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

// Converte a data enviada pelo Android (dd-MM-yyyy_HH:mm:ss) para milissegundos para ordenação
function converterTimestamp(ts) {
    if (!ts) return 0;
    const partes = ts.split('_');
    if (partes.length !== 2) return 0;
    const diaMesAno = partes[0].split('-');
    const horaMinSeg = partes[1].split(':');
    if (diaMesAno.length !== 3 || horaMinSeg.length !== 3) return 0;
    return new Date(diaMesAno[2], diaMesAno[1] - 1, diaMesAno[0], horaMinSeg[0], horaMinSeg[1], horaMinSeg[2]).getTime();
}

function processarLogs(data) {
    if (!data) return;
    todosLogs = [];

    for (const deviceKey in data) {
        const deviceData = data[deviceKey];
        
        // Trata o log de TESTE_BOTAO enviado pelo MainActivity.kt especificamente
        if (deviceKey === "TESTE_BOTAO") {
            todosLogs.push({
                deviceId: deviceKey,
                isRealtime: true,
                nomeDispositivo: deviceData.device,
                modelo: "Botão de Teste",
                status: deviceData.status,
                timestamp: deviceData.timestamp
            });
            continue;
        }

        // 1. Pega o status em tempo real (Opcional: você pode mostrar isso em destaque)
        if (deviceData.status_realtime) {
            todosLogs.push({
                deviceId: deviceKey,
                isRealtime: true,
                ...deviceData.status_realtime
            });
        }

        // 2. Pega o histórico
        if (deviceData.historico) {
            for (const logKey in deviceData.historico) {
                todosLogs.push({
                    deviceId: deviceKey,
                    isRealtime: false,
                    ...deviceData.historico[logKey]
                });
            }
        }
    }

    // Ordenar por data corretamente usando a função de parse
    todosLogs.sort((a, b) => {
        return converterTimestamp(b.timestamp) - converterTimestamp(a.timestamp);
    });

    renderizarLogs(document.getElementById('deviceIdInput').value.toLowerCase());
}

function renderizarLogs(termoBusca = "") {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = '';

    // Aplica o filtro de busca e o limite de itens selecionado na interface
    const logsFiltrados = todosLogs.filter(log => log.deviceId.toLowerCase().includes(termoBusca) || (log.nomeDispositivo && log.nomeDispositivo.toLowerCase().includes(termoBusca)));
    const logsExibicao = logsFiltrados.slice(0, limiteExibicao);

    logsExibicao.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log';
        // Se for o log de tempo real, adiciona uma bordinha ou tag
        if (log.isRealtime) div.style.borderLeft = "5px solid #00ff00";

        div.innerHTML = `
            <div style="margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee;">
                <strong>Nome: ${log.nomeDispositivo || log.device || 'Sem Nome'}</strong> <br>
                <small>Modelo: ${log.modelo} | ID: ${log.deviceId}</small><br>
                <span>🕒 ${log.timestamp} ${log.isRealtime ? ' (AGORA)' : ''}</span><br>
                <b>CPU:</b> ${log.cpu || '-'} | <b>RAM:</b> ${log.ram || '-'}<br>
                <b>Wi-Fi:</b> ${log.wifi || '-'}<br>
                <b>Móveis:</b> ${log.dadosMoveis || '-'}<br>
                ${log.status ? `<b>Status:</b> ${log.status}` : ''}
            </div>
        `;
        logContainer.appendChild(div);
    });
    
    if(logsExibicao.length === 0) {
        logContainer.innerHTML = '<p>Nenhum log encontrado para exibição.</p>';
    }
}

window.onload = () => window.carregarTodosLogs();
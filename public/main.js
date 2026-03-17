let todosLogs = [];
const socket = io();

// Escuta atualização em tempo real do novo nó
socket.on('atualizacao_geral', (data) => {
    console.log("📡 Dados recebidos via WebSocket");
    processarLogs(data);
});

window.carregarTodosLogs = async function () {
    try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        processarLogs(data);
    } catch (err) {
        console.error('Erro ao carregar logs:', err);
    }
};

function processarLogs(data) {
    if (!data) return;
    todosLogs = [];

    for (const deviceKey in data) {
        const deviceData = data[deviceKey];
        
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

    // Ordenar por data (mais recente primeiro)
    todosLogs.sort((a, b) => {
        return b.timestamp.localeCompare(a.timestamp);
    });

    renderizarLogs();
}

function renderizarLogs() {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = '';

    todosLogs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log';
        // Se for o log de tempo real, adiciona uma bordinha ou tag
        if (log.isRealtime) div.style.borderLeft = "5px solid #00ff00";

        div.innerHTML = `
            <div style="margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee;">
                <strong>Nome: ${log.nomeDispositivo || 'Sem Nome'}</strong> <br>
                <small>Modelo: ${log.modelo} | ID: ${log.deviceId}</small><br>
                <span>🕒 ${log.timestamp} ${log.isRealtime ? ' (AGORA)' : ''}</span><br>
                <b>CPU:</b> ${log.cpu} | <b>RAM:</b> ${log.ram}<br>
                <b>Wi-Fi:</b> ${log.wifi}<br>
                <b>Móveis:</b> ${log.dadosMoveis}
            </div>
        `;
        logContainer.appendChild(div);
    });
}

window.onload = () => window.carregarTodosLogs();
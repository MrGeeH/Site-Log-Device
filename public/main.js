let todosLogs = [];
let limiteExibicao = 50;
const socket = io();

// Escuta atualização em tempo real do nó via WebSocket
socket.on('atualizacao_logs', (data) => {
    console.log("📡 Dados recebidos via WebSocket");
    processarLogs(data);
});

window.carregarTodosLogs = async function () {
    try {
        document.getElementById('deviceIdInput').value = ''; 
        const response = await fetch('/api/logs'); //
        const data = await response.json();
        processarLogs(data);
    } catch (err) {
        console.error('Erro ao carregar logs:', err);
    }
};

// ✅ BUSCA GLOBAL: Filtra por ID, Nome ou Modelo
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

        if (deviceData.status_realtime) {
            todosLogs.push({
                deviceId: deviceKey,
                isRealtime: true,
                ...deviceData.status_realtime
            });
        }

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

    todosLogs.sort((a, b) => {
        return converterTimestamp(b.timestamp) - converterTimestamp(a.timestamp);
    });

    renderizarLogs(document.getElementById('deviceIdInput').value.toLowerCase());
}

function renderizarLogs(termoBusca = "") {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = '';

    // Filtro Global: ID, Nome ou Modelo
    const logsFiltrados = todosLogs.filter(log => {
        const id = (log.deviceId || "").toLowerCase();
        const nome = (log.nomeDispositivo || log.device || "").toLowerCase();
        const modelo = (log.modelo || "").toLowerCase();
        return id.includes(termoBusca) || nome.includes(termoBusca) || modelo.includes(termoBusca);
    });

    const logsExibicao = logsFiltrados.slice(0, limiteExibicao);

    logsExibicao.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log';
        
        let alertaRAM = "";
        let estiloExtra = "";

        // ✅ LÓGICA DE TESTE: Limite alterado para 50%
        if (log.ram) {
            const valores = log.ram.match(/(\d+(\.\d+)?)/g);
            if (valores && valores.length >= 2) {
                const atual = parseFloat(valores[0]);
                const total = parseFloat(valores[1]);
                const percentual = (atual / total) * 100;

                // Alterado de 80 para 50 para fins de teste
                if (percentual >= 50) {
                    alertaRAM = `<div style="color: #ff0000; font-weight: bold; margin-top: 5px; border: 2px solid red; padding: 5px; background: #fff;">⚠️ TESTE: CONSUMO > 50% (${percentual.toFixed(1)}%)</div>`;
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
                <b>Wi-Fi:</b> ${log.wifi || '-'} | <b>Móveis:</b> ${log.dadosMoveis || '-'}<br>
                ${log.status ? `<b>Status:</b> ${log.status}` : ''}
                ${alertaRAM}
            </div>
        `;
        logContainer.appendChild(div);
    });
    
    if(logsExibicao.length === 0) {
        logContainer.innerHTML = '<p>Nenhum log encontrado para exibição.</p>';
    }
}

window.onload = () => window.carregarTodosLogs();
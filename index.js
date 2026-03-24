const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const { Server } = require('socket.io');

// --- CORREÇÃO NA TRATAÇÃO DA CHAVE PRIVADA ---
// O Render e outros serviços de nuvem costumam adicionar aspas extras ou 
// falhar na leitura de \n. Esta função garante a limpeza da string.
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '');
};

// Configuração do Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.PROJECT_ID,
      clientEmail: process.env.CLIENT_EMAIL,
      privateKey: formatPrivateKey(process.env.PRIVATE_KEY),
    }),
    databaseURL: "https://logdesempenhodevice-default-rtdb.firebaseio.com",
  });
  console.log("✅ Firebase Admin inicializado com sucesso.");
} catch (error) {
  console.error("❌ Erro ao inicializar Firebase Admin:", error.message);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public')); 

const db = admin.database();
const logsRef = db.ref('logs_devices'); 

// ✅ WebSocket: Notificar quando qualquer dado mudar
logsRef.on('value', (snapshot) => {
  const data = snapshot.val();
  console.log('🔄 Dados atualizados no Firebase, enviando via Socket...');
  io.emit('atualizacao_logs', data); 
});

// ✅ Rota REST: Pegar todos os logs com proteção de Timeout
app.get('/api/logs', async (req, res) => {
  // Criamos um timer para a requisição não ficar "Pending" para sempre
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error("⚠️ Timeout: Firebase demorou muito para responder.");
      res.status(504).json({ error: 'Timeout na resposta do Firebase' });
    }
  }, 10000); // 10 segundos

  try {
    const snapshot = await logsRef.once('value');
    clearTimeout(timeout);
    const data = snapshot.val();
    res.json(data || {});
  } catch (error) {
    clearTimeout(timeout);
    console.error("❌ Erro ao buscar logs:", error);
    res.status(500).json({ error: 'Erro interno ao buscar logs' });
  }
});

// ✅ Rota REST: Dispositivo específico
app.get('/api/logs/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const snapshot = await db.ref(`logs_devices/${deviceId}`).once('value');
    
    if (!snapshot.exists()) {
        return res.status(404).json({ error: "Dispositivo não encontrado" });
    }
    
    res.json(snapshot.val());
  } catch (error) {
    console.error("❌ Erro ao buscar device:", error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

// ✅ WebSocket: Gerenciamento de conexão
io.on('connection', (socket) => {
  console.log('🔌 Novo cliente conectado ao WebSocket');
  
  // Envia carga inicial para o cliente não começar vazio
  logsRef.once('value').then((snapshot) => {
    socket.emit('atualizacao_logs', snapshot.val());
  }).catch(err => console.error("Erro no envio inicial via Socket:", err));
});

// ✅ Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Monitorando nó: logs_devices`);
});
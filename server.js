import express from 'express';
import cors from 'cors';
import mqtt from 'mqtt';
import sql from 'mssql';
import {Aedes} from 'aedes';              
import net from 'net';                  
import http from 'http';                 
import wsStream from 'websocket-stream'; 

const app = express();
app.use(cors());
app.use(express.json());


// 1. KONFIGURASI MICROSOFT SQL SERVER

const sqlConfig = {
    user: 'sa',               
    password: 'M45UK_SQL',    
    server: 'topswspu401',
    database: 'DB_WCP4',            
    options: {
        encrypt: false,             
        trustServerCertificate: true
    }
};

let pool;

async function connectDB() {
    try {
        pool = await sql.connect(sqlConfig);
        console.log("Node.js terhubung ke Microsoft SQL Server (db_wcp4)");
    } catch (err) {
        console.error(" Gagal koneksi ke MSSQL:", err.message);
    }
}
connectDB();


app.post('/api/auth/register', async (req, res) => {
    const { username, password, full_name, question, answer } = req.body;
    try {
        await pool.request()
            .input('user', sql.VarChar, username)
            .input('pass', sql.VarChar, password)
            .input('fname', sql.VarChar, full_name)
            .input('sq', sql.VarChar, question)
            .input('sa', sql.VarChar, answer)
            .query(`INSERT INTO users (username, password, full_name, security_question, security_answer, role, status) 
                    VALUES (@user, @pass, @fname, @sq, @sa, 'crew', 'pending')`);
        res.json({ status: 'success', message: 'Registrasi berhasil! Menunggu persetujuan SPV.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Username sudah digunakan!' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.request()
            .input('user', sql.VarChar, username)
            .input('pass', sql.VarChar, password)
            .query(`SELECT id, username, full_name, role, status FROM users WHERE username = @user AND password = @pass`);
        
        if (result.recordset.length === 0) return res.status(401).json({ status: 'error', message: 'Username atau Password salah!' });
        
        const user = result.recordset[0];
        if (user.status === 'pending') return res.status(403).json({ status: 'error', message: 'Akun Anda masih berstatus PENDING. Hubungi SPV HSE.' });
        
        res.json({ status: 'success', data: user });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.post('/api/auth/verify-security', async (req, res) => {
    const { username, answer } = req.body;
    try {
        const result = await pool.request()
            .input('user', sql.VarChar, username)
            .input('sa', sql.VarChar, answer)
            .query(`SELECT id FROM users WHERE username = @user AND security_answer = @sa`);
            
        if (result.recordset.length > 0) res.json({ status: 'success', message: 'Identitas cocok. Hubungi SPV.' });
        else res.status(401).json({ status: 'error', message: 'Jawaban salah atau user tidak ditemukan' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT id, username, full_name, role, status FROM users WHERE role = 'crew'");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/approve', async (req, res) => {
    try {
        await pool.request().input('id', sql.Int, req.body.id).query("UPDATE users SET status = 'active' WHERE id = @id");
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/users/delete', async (req, res) => {
    try {
        await pool.request().input('id', sql.Int, req.body.id).query("DELETE FROM users WHERE id = @id");
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/users/reset', async (req, res) => {
    try {
        await pool.request().input('id', sql.Int, req.body.id).query("UPDATE users SET password = 'top12345' WHERE id = @id");
        res.json({ status: 'success', message: 'top12345' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});


const TELEGRAM_TOKEN = 'GANTI_DENGAN_TOKEN_BOTFATHER'; 
const CHAT_ID = 'GANTI_DENGAN_CHAT_ID_GRUP'; 

async function sendTelegramAlert(message) {
    if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'GANTI_DENGAN_TOKEN_BOTFATHER') return;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' }) });
    } catch (e) { console.error("Gagal kirim Telegram:", e.message); }
}

let isOfflineAlerted = false;
let isTankAlerted = false;


const aedesBroker = await Aedes.createBroker(); 

// ---> 4A. JALUR TCP (UNTUK ESP32 & NODE.JS) <---
const serverAedesTCP = net.createServer(aedesBroker.handle);
const TCP_PORT = 8888; // BISA DIUBAH BEBAS (Contoh: 8888). Pastikan di ESP32 juga disamakan!

serverAedesTCP.listen(TCP_PORT, () => {
    console.log(`Lokal MQTT Broker (Jalur TCP untuk ESP32) berjalan di port ${TCP_PORT}`);
});

// ---> 4B. JALUR WEBSOCKET (UNTUK DASHBOARD WEBSITE) <---
const httpServer = http.createServer();
wsStream.createServer({ server: httpServer }, aedesBroker.handle);
const WS_PORT = 8084; // Port untuk koneksi Web/Browser (Bisa diubah bebas)

httpServer.listen(WS_PORT, () => {
    console.log(`Lokal MQTT Broker (Jalur WebSocket untuk Web) berjalan di port ${WS_PORT}`);
});

// ---> 4C. NODE.JS CLIENT KONEK KE BROKER LOKAL SENDIRI <---
const mqttClient = mqtt.connect(`mqtt://localhost:${TCP_PORT}`, {
    clientId: 'NodeServer-' + Math.random().toString(16).substring(2, 8)
});

mqttClient.on('connect', () => {
    console.log('Node.js terhubung ke Local MQTT Broker');
    mqttClient.subscribe('pt_top/dosing/site_a/data');
    mqttClient.subscribe('pt_top/dosing/site_a/status'); 
});

let lastRainSession = 0;

mqttClient.on('message', async (topic, message) => {
    if (topic === 'pt_top/dosing/site_a/status') {
        const statusEsp = message.toString();
        if (statusEsp === 'offline' && !isOfflineAlerted) {
            sendTelegramAlert("*WCP 4 ALERT: ESP32 OFFLINE!*\n\nKoneksi sistem ke panel kontrol terputus.");
            isOfflineAlerted = true;
        } else if (statusEsp === 'online' && isOfflineAlerted) {
            sendTelegramAlert("*WCP 4 INFO: ESP32 ONLINE*\n\nKoneksi jaringan ke panel kontrol telah pulih.");
            isOfflineAlerted = false;
        }
    }
    
    if (topic === 'pt_top/dosing/site_a/data') {
        try {
            const payload = JSON.parse(message.toString());
            
            // Simpan log hujan ke MSSQL
            if (payload.save_log && payload.log_id !== lastRainSession) {
                lastRainSession = payload.log_id;
                const now = new Date().toLocaleString('id-ID'); 
                
                await pool.request()
                    .input('mulai', sql.VarChar, payload.waktu_mulai || now)
                    .input('selesai', sql.VarChar, now)
                    .input('durasi', sql.Int, payload.durasi || 0)
                    .input('total', sql.Float, payload.total_hujan || 0)
                    .query(`INSERT INTO rain_logs (waktu_mulai, waktu_selesai, durasi_menit, total_hujan) VALUES (@mulai, @selesai, @durasi, @total)`);
                console.log("Log hujan disimpan ke MSSQL.");
            }

            if (payload.main_10 === false || payload.main_10 === 0) {
                if (!isTankAlerted) {
                    sendTelegramAlert("*WCP 4 WARNING: TANGKI KRITIS!*\n\nVolume Tangki Utama (1200L) kosong.");
                    isTankAlerted = true;
                }
            } else { isTankAlerted = false; }
        } catch (e) { console.error("Format MQTT Error:", e.message); }
    }
});


app.get('/api/logs', async (req, res) => {
    try {
        const result = await pool.request().query("SELECT TOP 50 * FROM rain_logs ORDER BY id DESC");
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(3000, () => { console.log(' Server API Express berjalan di http://localhost:3000'); });
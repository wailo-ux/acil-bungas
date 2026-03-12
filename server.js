import express from 'express';
import cors from 'cors';
import mqtt from 'mqtt';
import sqlite3 from 'sqlite3'; 
import { open } from 'sqlite'; 
import { Aedes } from 'aedes';              
import net from 'net';                  
import http from 'http';                 
import wsStream from 'websocket-stream'; 
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname untuk ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// 1. KONFIGURASI SQLITE
let db;

async function connectDB() {
    try {
        // Membuka database file lokal (otomatis membuat folder/file jika belum ada)
        db = await open({
            filename: './database/db_wcp4.sqlite',
            driver: sqlite3.Database
        });
        
        // Setup tabel otomatis jika belum ada saat start
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                security_question TEXT,
                security_answer TEXT,
                role TEXT,
                status TEXT DEFAULT 'pending'
            );
            CREATE TABLE IF NOT EXISTS rain_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                waktu_mulai TEXT,
                waktu_selesai TEXT,
                durasi_menit INTEGER,
                total_hujan REAL
            );
        `);
        
        console.log("Node.js terhubung ke SQLite (db_wcp4.sqlite)");
    } catch (err) {
        console.error(" Gagal koneksi ke SQLite:", err.message);
    }
}
connectDB();

// --- ROUTING API BACKEND ---

app.post('/api/auth/register', async (req, res) => {
    const { username, password, full_name, question, answer } = req.body;
    try {
        await db.run(`INSERT INTO users (username, password, full_name, security_question, security_answer, role, status) 
                VALUES (?, ?, ?, ?, ?, 'crew', 'pending')`, [username, password, full_name, question, answer]);
        res.json({ status: 'success', message: 'Registrasi berhasil! Menunggu persetujuan SPV.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Username sudah digunakan!' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get(`SELECT id, username, full_name, role, status FROM users WHERE username = ? AND password = ?`, [username, password]);
        
        if (!user) return res.status(401).json({ status: 'error', message: 'Username atau Password salah!' });
        if (user.status === 'pending') return res.status(403).json({ status: 'error', message: 'Akun Anda masih berstatus PENDING. Hubungi SPV HSE.' });
        
        res.json({ status: 'success', data: user });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.post('/api/auth/verify-security', async (req, res) => {
    const { username, answer } = req.body;
    try {
        const user = await db.get(`SELECT id FROM users WHERE username = ? AND security_answer = ?`, [username, answer]);
            
        if (user) res.json({ status: 'success', message: 'Identitas cocok. Hubungi SPV.' });
        else res.status(401).json({ status: 'error', message: 'Jawaban salah atau user tidak ditemukan' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, full_name, role, status FROM users WHERE role = 'crew'");
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/approve', async (req, res) => {
    try {
        await db.run("UPDATE users SET status = 'active' WHERE id = ?", [req.body.id]);
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/users/delete', async (req, res) => {
    try {
        await db.run("DELETE FROM users WHERE id = ?", [req.body.id]);
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.post('/api/users/reset', async (req, res) => {
    try {
        await db.run("UPDATE users SET password = 'top12345' WHERE id = ?", [req.body.id]);
        res.json({ status: 'success', message: 'top12345' });
    } catch (err) { res.status(500).json({ status: 'error' }); }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logs = await db.all("SELECT * FROM rain_logs ORDER BY id DESC LIMIT 50");
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- TELEGRAM & MQTT BROKER ---

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

const serverAedesTCP = net.createServer(aedesBroker.handle);
const TCP_PORT = 8888; 

serverAedesTCP.listen(TCP_PORT, () => {
    console.log(`Lokal MQTT Broker (Jalur TCP untuk ESP32) berjalan di port ${TCP_PORT}`);
});

const httpServer = http.createServer();
wsStream.createServer({ server: httpServer }, aedesBroker.handle);
const WS_PORT = 8084; 

httpServer.listen(WS_PORT, () => {
    console.log(`Lokal MQTT Broker (Jalur WebSocket untuk Web) berjalan di port ${WS_PORT}`);
});

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
            
            // Simpan log hujan ke SQLite
            if (payload.save_log && payload.log_id !== lastRainSession) {
                lastRainSession = payload.log_id;
                const now = new Date().toLocaleString('id-ID'); 
                
                await db.run(`INSERT INTO rain_logs (waktu_mulai, waktu_selesai, durasi_menit, total_hujan) VALUES (?, ?, ?, ?)`, 
                    [payload.waktu_mulai || now, now, payload.durasi || 0, payload.total_hujan || 0]);
                console.log("Log hujan disimpan ke SQLite.");
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


// --- INTEGRASI FRONTEND VUE (UNTUK DEPLOY) ---

// Menyajikan folder 'dist' sebagai file statis HTML/CSS/JS
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback Route: Jika user refresh halaman di browser, tetap arahkan ke index.html Vue
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Jalankan Server Utama
app.listen(3000, '0.0.0.0', () => { 
    console.log('Server Web & API berjalan di port 3000'); 
});
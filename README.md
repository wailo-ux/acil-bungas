# Dashboard Monitoring & Dosing Automation WCP 4
**Project Owner:** Tim HSE - Turangga Resources (Telen Orbit Prima)
**Stack:** Vue.js (Frontend), Node.js (Backend), Microsoft SQL Server (Database), MQTT (IoT)

Aplikasi ini adalah sistem monitoring *real-time* dan otomasi kontrol untuk *dosing* Flocculant & Alum di WCP 4. Sistem terintegrasi dengan panel kontrol ESP32 di lapangan menggunakan protokol MQTT dan mencatat riwayat curah hujan serta operasional ke dalam Microsoft SQL Server.

---

##  Persiapan Sistem (Prerequisites)
Sebelum melakukan *deployment*, pastikan komputer Server (Windows Server) sudah ter-install:
1. **Node.js** (Rekomendasi versi 18 LTS atau lebih baru).
2. **Microsoft SQL Server** & **SQL Server Management Studio (SSMS)**.
3. **PM2** (Process Manager untuk Node.js). Jika belum, install melalui CMD/Terminal dengan perintah: `npm install -g pm2`

---

## 🚀 Panduan Deployment (Step-by-Step)

### Langkah 1: Setup Database (MSSQL)
1. Buka aplikasi **SQL Server Management Studio (SSMS)** di Server.
2. Login menggunakan akun administrator database (sa / Windows Authentication).
3. Buka file `database/setup_wcp4.sql` yang ada di dalam *repository* ini.
4. Jalankan (*Execute*) *script* tersebut untuk membuat *database* `db_wcp4`, tabel `users`, dan tabel `rain_logs` secara otomatis.
5. Pastikan membuat *User Login* MSSQL khusus untuk aplikasi ini (contoh: username `wcp_user`, password `password123`) dan berikan akses `db_owner` ke *database* `db_wcp4`.

### Langkah 2: Konfigurasi Koneksi Aplikasi
1. Buka file `server.js` menggunakan *text editor* (Notepad/VS Code).
2. Cari bagian **"1. KONFIGURASI MICROSOFT SQL SERVER"** (sekitar baris awal).
3. Ubah detail koneksi sesuai dengan kredensial *server* lokal:
   ```javascript
   const sqlConfig = {
       user: 'username_dari_IT',      // Ganti dengan username MSSQL server
       password: 'password_dari_IT',  // Ganti dengan password MSSQL server
       server: 'localhost',           // Gunakan IP Server atau 'localhost'
       database: 'db_wcp4',
       options: { trustServerCertificate: true }
   };

async function connectDB() {
    try {
        db = await open({
            filename: './database/db_wcp4.sqlite',
            driver: sqlite3.Database
        });
        
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
        
        // --- TAMBAHKAN KODE INI UNTUK MEMBUAT AKUN ADMIN OTOMATIS ---
        const adminExists = await db.get("SELECT id FROM users WHERE username = 'shetopsolid'");
        if (!adminExists) {
            await db.run(`INSERT INTO users (username, password, full_name, role, status) 
                          VALUES ('shetopsolid', 'turanggaA1', 'Super Admin HSE', 'spv', 'active')`);
            console.log("Akun Super Admin default (shetopsolid) berhasil dibuat di SQLite.");
        }
        // -------------------------------------------------------------
        
        console.log("Node.js terhubung ke SQLite (db_wcp4.sqlite)");
    } catch (err) {
        console.error(" Gagal koneksi ke SQLite:", err.message);
    }
}

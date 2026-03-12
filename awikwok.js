// 1. KONFIGURASI SQLITE
let db;

async function connectDB() {
    try {
        // Buat path absolut ke folder database
        const dbDir = path.join(__dirname, 'database');
        const dbPath = path.join(dbDir, 'db_wcp4.sqlite');

        // Cek dan buat folder 'database' jika belum ada
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Membuka database dengan path absolut
        db = await open({
            filename: dbPath,
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
        
        // Buat akun admin otomatis jika kosong
        const adminExists = await db.get("SELECT id FROM users WHERE username = 'shetopsolid'");
        if (!adminExists) {
            await db.run(`INSERT INTO users (username, password, full_name, role, status) 
                          VALUES ('shetopsolid', 'turanggaA1', 'Super Admin HSE', 'spv', 'active')`);
            console.log("Akun Super Admin default (shetopsolid) berhasil dibuat di SQLite.");
        }
        
        console.log("Node.js terhubung ke SQLite di path:", dbPath);
    } catch (err) {
        console.error("Gagal koneksi ke SQLite:", err.message);
    }
}
connectDB();

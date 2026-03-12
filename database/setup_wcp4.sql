-- SQLite tidak membutuhkan CREATE DATABASE atau USE, karena db disimpan dalam file.

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

INSERT INTO users (username, password, full_name, role, status) 
VALUES ('shetopsolid', 'turanggaA1', 'Super Admin HSE', 'spv', 'active');

CREATE TABLE IF NOT EXISTS rain_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu_mulai TEXT,
    waktu_selesai TEXT,
    durasi_menit INTEGER,
    total_hujan REAL
);
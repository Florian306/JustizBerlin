-- Cloudflare D1 Schema für JustizBerlin (Datenbank: justizberlin)

CREATE TABLE IF NOT EXISTS akten (
    az TEXT PRIMARY KEY,
    datum TEXT NOT NULL,
    typ TEXT NOT NULL,
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    behoerde TEXT,
    beteiligter TEXT,
    sachverhalt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Eingegangen',
    vermerk TEXT
);

CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    short TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS laws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId TEXT NOT NULL,
    paragraph TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
);

-- Beispiel-Daten (optional)
INSERT OR IGNORE INTO books (id, title, short) VALUES
    ('stgb', 'Strafgesetzbuch (StGB)', 'StGB'),
    ('stpo', 'Strafprozessordnung (StPO)', 'StPO'),
    ('berljg', 'Berliner Justizgesetz (BerlJG)', 'BerlJG');

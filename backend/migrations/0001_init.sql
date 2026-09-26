CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL DEFAULT 'Owner'
);
CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY, ownerEmail TEXT NOT NULL, type TEXT NOT NULL,
  manufacturer TEXT DEFAULT '', serial TEXT DEFAULT '', capacity TEXT DEFAULT '',
  location TEXT DEFAULT '', validUntil TEXT DEFAULT '', status TEXT DEFAULT 'Verification Due'
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, instrumentId TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted',
  location TEXT DEFAULT '', ownerEmail TEXT DEFAULT '', officerEmail TEXT DEFAULT '',
  observed REAL, tolerance REAL, result TEXT DEFAULT '', remarks TEXT DEFAULT '',
  photos TEXT DEFAULT '[]', certNo TEXT DEFAULT '', createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS certificates (
  certNo TEXT PRIMARY KEY, applicationId TEXT NOT NULL, instrumentId TEXT NOT NULL,
  verifyDate TEXT NOT NULL, validUntil TEXT NOT NULL, officerEmail TEXT DEFAULT ''
);
INSERT OR IGNORE INTO users (uid, email, role) VALUES
  ('owner@demo.in','owner@demo.in','Owner'), ('lmo@demo.in','lmo@demo.in','LMO'),
  ('gatc@demo.in','gatc@demo.in','GATC'), ('admin@demo.in','admin@demo.in','Admin');
INSERT OR IGNORE INTO instruments (id, ownerEmail, type, manufacturer, serial, capacity, location, validUntil, status) VALUES
  ('WM-1024','owner@demo.in','Weighing Machine','Apex','AX-8891','500kg','Delhi','2026-11-15','Verification Due'),
  ('WM-1025','owner@demo.in','Fuel Dispenser','FlowTech','FT-2210','50L/min','Noida','2026-10-02','Valid');

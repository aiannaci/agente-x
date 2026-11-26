-- Usuarios (login con Google). settings y holidays son JSON; holidays NULL = lista por defecto.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  settings TEXT,
  holidays TEXT,
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Informes y tareas. data es el objeto Item completo en JSON.
CREATE TABLE items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE completions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL,
  done_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id, date)
);

CREATE TABLE overrides (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL,
  moved_to TEXT,
  skipped INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id, date)
);

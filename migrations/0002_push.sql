-- Dispositivos que aceptaron notificaciones.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX push_subscriptions_user ON push_subscriptions(user_id);

-- Avisos ya enviados, para no repetirlos.
CREATE TABLE notification_log (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Zona horaria de cada usuario (para mandar los avisos a su hora).
ALTER TABLE users ADD COLUMN timezone TEXT;

PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS news_posts(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),author TEXT NOT NULL,season TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost IN(0,250)),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','pending','approved','rejected')),version INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL DEFAULT '{}',reason TEXT NOT NULL DEFAULT '',reviewer TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS news_one_draft ON news_posts(uid) WHERE status='draft';
CREATE INDEX IF NOT EXISTS news_author ON news_posts(uid,created_at DESC);
CREATE INDEX IF NOT EXISTS news_queue ON news_posts(status,created_at DESC);
CREATE TRIGGER IF NOT EXISTS news_ticket AFTER INSERT ON news_posts WHEN NEW.cost>0 BEGIN
 INSERT INTO ledger VALUES('news-ticket:'||NEW.id,NEW.uid,-NEW.cost,'Publicación de noticia',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS news_refund AFTER UPDATE OF status ON news_posts WHEN OLD.status='pending' AND NEW.status='rejected' AND NEW.cost>0 BEGIN
 INSERT INTO ledger VALUES('news-refund:'||NEW.id,NEW.uid,NEW.cost,'Devolución · noticia rechazada',NEW.updated_at);
END;

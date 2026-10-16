PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS news_withdrawals(post_id TEXT PRIMARY KEY REFERENCES news_posts(id),uid TEXT NOT NULL,previous_status TEXT NOT NULL CHECK(previous_status IN('draft','pending')),at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS news_withdrawal_apply AFTER INSERT ON news_withdrawals BEGIN
 UPDATE news_posts SET status='rejected',reason='Retirada por su autor',reviewer=NEW.uid,version=version+1,updated_at=NEW.at WHERE id=NEW.post_id AND uid=NEW.uid AND status=NEW.previous_status;
 INSERT INTO ledger SELECT 'news-refund:'||p.id,p.uid,p.cost,'Devolución · noticia retirada',NEW.at FROM news_posts p WHERE p.id=NEW.post_id AND NEW.previous_status='draft' AND p.cost>0;
 UPDATE ledger SET reason='Devolución · noticia retirada' WHERE id='news-refund:'||NEW.post_id;
END;

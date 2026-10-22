CREATE TABLE bet_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,slot TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);

CREATE TABLE bet_matches(id TEXT PRIMARY KEY,period TEXT NOT NULL REFERENCES bet_periods(id),match_id TEXT NOT NULL,info TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','void')),version INTEGER NOT NULL DEFAULT 0,a INTEGER,b INTEGER,reason TEXT,updated_at INTEGER NOT NULL,replaced_from TEXT UNIQUE);

CREATE TABLE bet_periods(id TEXT PRIMARY KEY,season TEXT NOT NULL,week TEXT NOT NULL,closes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),created_at INTEGER NOT NULL);

CREATE TABLE bets(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),period TEXT NOT NULL REFERENCES bet_periods(id),slot TEXT NOT NULL REFERENCES bet_matches(id),choice TEXT NOT NULL CHECK(choice IN ('home','draw','away')),stake INTEGER NOT NULL CHECK(stake BETWEEN 1 AND 150),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','won','lost','void')),payout INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(uid,slot));

CREATE TABLE games(  id TEXT PRIMARY KEY,  uid TEXT NOT NULL REFERENCES wallets(uid),  kind TEXT NOT NULL CHECK(kind IN ('mines','penalties')),  day TEXT NOT NULL,  status TEXT NOT NULL  CHECK(status IN ('active','won','lost','expired')),  version INTEGER NOT NULL DEFAULT 0,  secret TEXT NOT NULL,  state TEXT NOT NULL,  payout INTEGER NOT NULL DEFAULT 0 CHECK(payout>=0),  created_at INTEGER NOT NULL,  updated_at INTEGER NOT NULL,  UNIQUE(uid,kind,day) );

CREATE TABLE grants(  id TEXT PRIMARY KEY,  at INTEGER NOT NULL );

CREATE TABLE ledger(  id TEXT PRIMARY KEY,  uid TEXT NOT NULL REFERENCES wallets(uid),  amount INTEGER NOT NULL CHECK(amount!=0),  reason TEXT NOT NULL,  at INTEGER NOT NULL );

CREATE TABLE news_posts(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),author TEXT NOT NULL,season TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost IN(0,250)),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','pending','approved','rejected')),version INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL DEFAULT '{}',reason TEXT NOT NULL DEFAULT '',reviewer TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);

CREATE TABLE news_withdrawals(post_id TEXT PRIMARY KEY REFERENCES news_posts(id),uid TEXT NOT NULL,previous_status TEXT NOT NULL CHECK(previous_status IN('draft','pending')),at INTEGER NOT NULL);

CREATE TABLE practice_sessions(  uid TEXT PRIMARY KEY,  state TEXT NOT NULL,  version INTEGER NOT NULL DEFAULT 0,  updated_at INTEGER NOT NULL );

CREATE TABLE trial_bet_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,slot TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);

CREATE TABLE trial_bet_matches(id TEXT PRIMARY KEY,period TEXT NOT NULL REFERENCES trial_bet_periods(id),match_id TEXT NOT NULL,info TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','void')),version INTEGER NOT NULL DEFAULT 0,a INTEGER,b INTEGER,reason TEXT,updated_at INTEGER NOT NULL,replaced_from TEXT UNIQUE);

CREATE TABLE trial_bet_periods(id TEXT PRIMARY KEY,season TEXT NOT NULL,week TEXT NOT NULL,closes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),created_at INTEGER NOT NULL);

CREATE TABLE trial_bets(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES trial_wallets(uid),period TEXT NOT NULL REFERENCES trial_bet_periods(id),slot TEXT NOT NULL REFERENCES trial_bet_matches(id),choice TEXT NOT NULL CHECK(choice IN ('home','draw','away')),stake INTEGER NOT NULL CHECK(stake BETWEEN 1 AND 150),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','won','lost','void')),payout INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(uid,slot));

CREATE TABLE trial_ledger(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES trial_wallets(uid),amount INTEGER NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);

CREATE TABLE trial_wallets(uid TEXT PRIMARY KEY,name TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),created_at INTEGER NOT NULL);

CREATE TABLE wallets(  uid TEXT PRIMARY KEY,  name TEXT NOT NULL,  balance INTEGER NOT NULL DEFAULT 0  CHECK(balance>=0 AND balance<=1000000000),  created_at INTEGER NOT NULL );

CREATE INDEX bet_match_period ON bet_matches(period,active);

CREATE INDEX bet_user_period ON bets(uid,period);

CREATE INDEX game_user_time  ON games(uid,created_at DESC);

CREATE INDEX ledger_user_time  ON ledger(uid,at DESC);

CREATE INDEX news_author ON news_posts(uid,created_at DESC);

CREATE UNIQUE INDEX news_one_draft ON news_posts(uid) WHERE status='draft';

CREATE INDEX news_queue ON news_posts(status,created_at DESC);

CREATE INDEX trial_bet_match_period ON trial_bet_matches(period,active);

CREATE INDEX trial_bet_user_period ON trial_bets(uid,period);

CREATE INDEX wallet_ranking  ON wallets(balance DESC);

CREATE TRIGGER bet_credit AFTER UPDATE OF status ON bets WHEN OLD.status='pending' AND NEW.status IN ('won','void') AND NEW.payout>0 BEGIN  INSERT INTO ledger VALUES('bet-credit:'||NEW.id,NEW.uid,NEW.payout,CASE WHEN NEW.status='void' THEN 'Devolución de apuesta' ELSE 'Premio de apuesta' END,NEW.updated_at); END;

CREATE TRIGGER bet_guard BEFORE INSERT ON bets BEGIN  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bet_periods p JOIN bet_matches m ON m.period=p.id WHERE p.id=NEW.period AND m.id=NEW.slot AND p.status='open' AND m.status='pending' AND m.active=1 AND NEW.created_at<p.closes) THEN RAISE(ABORT,'bets_closed') END;  SELECT CASE WHEN NEW.stake+COALESCE((SELECT SUM(stake) FROM bets WHERE uid=NEW.uid AND period=NEW.period AND status<>'void'),0)>150 THEN RAISE(ABORT,'bet_limit') END; END;

CREATE TRIGGER bet_refund AFTER UPDATE OF status ON bet_matches WHEN OLD.status='pending' AND NEW.status='void' BEGIN  UPDATE bets SET status='void',payout=stake,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending'; END;

CREATE TRIGGER bet_settle AFTER UPDATE OF status ON bet_matches WHEN OLD.status='pending' AND NEW.status='settled' BEGIN  UPDATE bets SET status=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN 'won' ELSE 'lost' END,payout=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN stake*2 ELSE 0 END,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending'; END;

CREATE TRIGGER bet_ticket AFTER INSERT ON bets BEGIN  INSERT INTO ledger VALUES('bet-ticket:'||NEW.id,NEW.uid,-NEW.stake,'Apuesta · '||(SELECT json_extract(info,'$.home')||' vs '||json_extract(info,'$.away') FROM bet_matches WHERE id=NEW.slot),NEW.created_at); END;

CREATE TRIGGER game_payout AFTER UPDATE OF status ON games WHEN OLD.status='active'  AND NEW.status='won'  AND NEW.payout>0 BEGIN  INSERT INTO ledger VALUES(  'payout:'||NEW.id,NEW.uid,NEW.payout,  'Premio · '||NEW.kind,NEW.updated_at); END;

CREATE TRIGGER game_ticket AFTER INSERT ON games BEGIN  INSERT INTO ledger VALUES(  'ticket:'||NEW.id,NEW.uid,-25,  'Ticket · '||NEW.kind,NEW.created_at); END;

CREATE TRIGGER grant_all AFTER INSERT ON grants BEGIN  INSERT INTO ledger  SELECT 'grant:'||NEW.id||':'||uid,  uid,100,'Entrega del administrador',NEW.at  FROM wallets; END;

CREATE TRIGGER initial_wallet AFTER INSERT ON wallets BEGIN  INSERT INTO ledger VALUES(  'initial:'||NEW.uid,NEW.uid,500,  'Bienvenida',NEW.created_at); END;

CREATE TRIGGER ledger_balance AFTER INSERT ON ledger BEGIN  UPDATE wallets SET balance=balance+NEW.amount  WHERE uid=NEW.uid; END;

CREATE TRIGGER news_refund AFTER UPDATE OF status ON news_posts WHEN OLD.status='pending' AND NEW.status='rejected' AND NEW.cost>0 BEGIN  INSERT INTO ledger VALUES('news-refund:'||NEW.id,NEW.uid,NEW.cost,'Devolución · noticia rechazada',NEW.updated_at); END;

CREATE TRIGGER news_ticket AFTER INSERT ON news_posts WHEN NEW.cost>0 BEGIN  INSERT INTO ledger VALUES('news-ticket:'||NEW.id,NEW.uid,-NEW.cost,'Publicación de noticia',NEW.created_at); END;

CREATE TRIGGER news_withdrawal_apply AFTER INSERT ON news_withdrawals BEGIN  UPDATE news_posts SET status='rejected',reason='Retirada por su autor',reviewer=NEW.uid,version=version+1,updated_at=NEW.at WHERE id=NEW.post_id AND uid=NEW.uid AND status=NEW.previous_status;  INSERT INTO ledger SELECT 'news-refund:'||p.id,p.uid,p.cost,'Devolución · noticia retirada',NEW.at FROM news_posts p WHERE p.id=NEW.post_id AND NEW.previous_status='draft' AND p.cost>0;  UPDATE ledger SET reason='Devolución · noticia retirada' WHERE id='news-refund:'||NEW.post_id; END;

CREATE TRIGGER trial_balance AFTER INSERT ON trial_ledger BEGIN UPDATE trial_wallets SET balance=balance+NEW.amount WHERE uid=NEW.uid; END;

CREATE TRIGGER trial_bet_credit AFTER UPDATE OF status ON trial_bets WHEN OLD.status='pending' AND NEW.status IN ('won','void') AND NEW.payout>0 BEGIN  INSERT INTO trial_ledger VALUES('bet-credit:'||NEW.id,NEW.uid,NEW.payout,CASE WHEN NEW.status='void' THEN 'Devolución de apuesta' ELSE 'Premio de apuesta' END,NEW.updated_at); END;

CREATE TRIGGER trial_bet_guard BEFORE INSERT ON trial_bets BEGIN  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_bet_periods p JOIN trial_bet_matches m ON m.period=p.id WHERE p.id=NEW.period AND m.id=NEW.slot AND p.status='open' AND m.status='pending' AND m.active=1 AND NEW.created_at<p.closes) THEN RAISE(ABORT,'bets_closed') END;  SELECT CASE WHEN NEW.stake+COALESCE((SELECT SUM(stake) FROM trial_bets WHERE uid=NEW.uid AND period=NEW.period AND status<>'void'),0)>150 THEN RAISE(ABORT,'bet_limit') END; END;

CREATE TRIGGER trial_bet_refund AFTER UPDATE OF status ON trial_bet_matches WHEN OLD.status='pending' AND NEW.status='void' BEGIN  UPDATE trial_bets SET status='void',payout=stake,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending'; END;

CREATE TRIGGER trial_bet_settle AFTER UPDATE OF status ON trial_bet_matches WHEN OLD.status='pending' AND NEW.status='settled' BEGIN  UPDATE trial_bets SET status=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN 'won' ELSE 'lost' END,payout=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN stake*2 ELSE 0 END,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending'; END;

CREATE TRIGGER trial_bet_ticket AFTER INSERT ON trial_bets BEGIN  INSERT INTO trial_ledger VALUES('bet-ticket:'||NEW.id,NEW.uid,-NEW.stake,'Apuesta · '||(SELECT json_extract(info,'$.home')||' vs '||json_extract(info,'$.away') FROM trial_bet_matches WHERE id=NEW.slot),NEW.created_at); END;

CREATE TRIGGER trial_initial AFTER INSERT ON trial_wallets BEGIN INSERT INTO trial_ledger VALUES('initial:'||NEW.uid,NEW.uid,500,'Prueba de apuestas',NEW.created_at); END;

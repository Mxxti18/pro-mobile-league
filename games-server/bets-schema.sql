CREATE TABLE IF NOT EXISTS bet_periods(id TEXT PRIMARY KEY,season TEXT NOT NULL,week TEXT NOT NULL,closes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bet_matches(id TEXT PRIMARY KEY,period TEXT NOT NULL REFERENCES bet_periods(id),match_id TEXT NOT NULL,info TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','void')),version INTEGER NOT NULL DEFAULT 0,a INTEGER,b INTEGER,reason TEXT,updated_at INTEGER NOT NULL,replaced_from TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS bet_match_period ON bet_matches(period,active);
CREATE TABLE IF NOT EXISTS bets(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),period TEXT NOT NULL REFERENCES bet_periods(id),slot TEXT NOT NULL REFERENCES bet_matches(id),choice TEXT NOT NULL CHECK(choice IN ('home','draw','away')),stake INTEGER NOT NULL CHECK(stake BETWEEN 1 AND 150),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','won','lost','void')),payout INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(uid,slot));
CREATE INDEX IF NOT EXISTS bet_user_period ON bets(uid,period);
CREATE TABLE IF NOT EXISTS bet_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,slot TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS bet_guard BEFORE INSERT ON bets BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bet_periods p JOIN bet_matches m ON m.period=p.id WHERE p.id=NEW.period AND m.id=NEW.slot AND p.status='open' AND m.status='pending' AND m.active=1 AND NEW.created_at<p.closes) THEN RAISE(ABORT,'bets_closed') END;
 SELECT CASE WHEN NEW.stake+COALESCE((SELECT SUM(stake) FROM bets WHERE uid=NEW.uid AND period=NEW.period AND status<>'void'),0)>150 THEN RAISE(ABORT,'bet_limit') END;
END;
CREATE TRIGGER IF NOT EXISTS bet_ticket AFTER INSERT ON bets BEGIN
 INSERT INTO ledger VALUES('bet-ticket:'||NEW.id,NEW.uid,-NEW.stake,'Apuesta · '||(SELECT json_extract(info,'$.home')||' vs '||json_extract(info,'$.away') FROM bet_matches WHERE id=NEW.slot),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS bet_credit AFTER UPDATE OF status ON bets WHEN OLD.status='pending' AND NEW.status IN ('won','void') AND NEW.payout>0 BEGIN
 INSERT INTO ledger VALUES('bet-credit:'||NEW.id,NEW.uid,NEW.payout,CASE WHEN NEW.status='void' THEN 'Devolución de apuesta' ELSE 'Premio de apuesta' END,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS bet_settle AFTER UPDATE OF status ON bet_matches WHEN OLD.status='pending' AND NEW.status='settled' BEGIN
 UPDATE bets SET status=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN 'won' ELSE 'lost' END,payout=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN stake*2 ELSE 0 END,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending';
END;
CREATE TRIGGER IF NOT EXISTS bet_refund AFTER UPDATE OF status ON bet_matches WHEN OLD.status='pending' AND NEW.status='void' BEGIN
 UPDATE bets SET status='void',payout=stake,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending';
END;

CREATE TABLE IF NOT EXISTS trial_wallets(uid TEXT PRIMARY KEY,name TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS trial_ledger(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES trial_wallets(uid),amount INTEGER NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS trial_balance AFTER INSERT ON trial_ledger BEGIN UPDATE trial_wallets SET balance=balance+NEW.amount WHERE uid=NEW.uid; END;
CREATE TRIGGER IF NOT EXISTS trial_initial AFTER INSERT ON trial_wallets BEGIN INSERT INTO trial_ledger VALUES('initial:'||NEW.uid,NEW.uid,500,'Prueba de apuestas',NEW.created_at); END;
CREATE TABLE IF NOT EXISTS trial_bet_periods(id TEXT PRIMARY KEY,season TEXT NOT NULL,week TEXT NOT NULL,closes INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed')),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS trial_bet_matches(id TEXT PRIMARY KEY,period TEXT NOT NULL REFERENCES trial_bet_periods(id),match_id TEXT NOT NULL,info TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','settled','void')),version INTEGER NOT NULL DEFAULT 0,a INTEGER,b INTEGER,reason TEXT,updated_at INTEGER NOT NULL,replaced_from TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS trial_bet_match_period ON trial_bet_matches(period,active);
CREATE TABLE IF NOT EXISTS trial_bets(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES trial_wallets(uid),period TEXT NOT NULL REFERENCES trial_bet_periods(id),slot TEXT NOT NULL REFERENCES trial_bet_matches(id),choice TEXT NOT NULL CHECK(choice IN ('home','draw','away')),stake INTEGER NOT NULL CHECK(stake BETWEEN 1 AND 150),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','won','lost','void')),payout INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(uid,slot));
CREATE INDEX IF NOT EXISTS trial_bet_user_period ON trial_bets(uid,period);
CREATE TABLE IF NOT EXISTS trial_bet_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,slot TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS trial_bet_guard BEFORE INSERT ON trial_bets BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM trial_bet_periods p JOIN trial_bet_matches m ON m.period=p.id WHERE p.id=NEW.period AND m.id=NEW.slot AND p.status='open' AND m.status='pending' AND m.active=1 AND NEW.created_at<p.closes) THEN RAISE(ABORT,'bets_closed') END;
 SELECT CASE WHEN NEW.stake+COALESCE((SELECT SUM(stake) FROM trial_bets WHERE uid=NEW.uid AND period=NEW.period AND status<>'void'),0)>150 THEN RAISE(ABORT,'bet_limit') END;
END;
CREATE TRIGGER IF NOT EXISTS trial_bet_ticket AFTER INSERT ON trial_bets BEGIN
 INSERT INTO trial_ledger VALUES('bet-ticket:'||NEW.id,NEW.uid,-NEW.stake,'Apuesta · '||(SELECT json_extract(info,'$.home')||' vs '||json_extract(info,'$.away') FROM trial_bet_matches WHERE id=NEW.slot),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS trial_bet_credit AFTER UPDATE OF status ON trial_bets WHEN OLD.status='pending' AND NEW.status IN ('won','void') AND NEW.payout>0 BEGIN
 INSERT INTO trial_ledger VALUES('bet-credit:'||NEW.id,NEW.uid,NEW.payout,CASE WHEN NEW.status='void' THEN 'Devolución de apuesta' ELSE 'Premio de apuesta' END,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS trial_bet_settle AFTER UPDATE OF status ON trial_bet_matches WHEN OLD.status='pending' AND NEW.status='settled' BEGIN
 UPDATE trial_bets SET status=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN 'won' ELSE 'lost' END,payout=CASE WHEN choice=CASE WHEN NEW.a>NEW.b THEN 'home' WHEN NEW.a=NEW.b THEN 'draw' ELSE 'away' END THEN stake*2 ELSE 0 END,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending';
END;
CREATE TRIGGER IF NOT EXISTS trial_bet_refund AFTER UPDATE OF status ON trial_bet_matches WHEN OLD.status='pending' AND NEW.status='void' BEGIN
 UPDATE trial_bets SET status='void',payout=stake,updated_at=NEW.updated_at WHERE slot=NEW.id AND status='pending';
END;

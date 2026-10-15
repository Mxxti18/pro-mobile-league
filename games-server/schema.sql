PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS wallets(uid TEXT PRIMARY KEY,name TEXT NOT NULL,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance<=1000000000),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),amount INTEGER NOT NULL CHECK(amount!=0),reason TEXT NOT NULL,at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ledger_user_time ON ledger(uid,at DESC);
CREATE INDEX IF NOT EXISTS wallet_ranking ON wallets(balance DESC);
CREATE TABLE IF NOT EXISTS games(id TEXT PRIMARY KEY,uid TEXT NOT NULL REFERENCES wallets(uid),kind TEXT NOT NULL CHECK(kind IN ('mines','penalties')),day TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','won','lost','expired')),version INTEGER NOT NULL DEFAULT 0,secret TEXT NOT NULL,state TEXT NOT NULL,payout INTEGER NOT NULL DEFAULT 0 CHECK(payout>=0),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(uid,kind,day));
CREATE INDEX IF NOT EXISTS game_user_time ON games(uid,created_at DESC);
CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY,at INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS ledger_balance AFTER INSERT ON ledger BEGIN
 UPDATE wallets SET balance=balance+NEW.amount WHERE uid=NEW.uid;
END;
CREATE TRIGGER IF NOT EXISTS initial_wallet AFTER INSERT ON wallets BEGIN
 INSERT INTO ledger VALUES('initial:'||NEW.uid,NEW.uid,500,'Bienvenida',NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS game_ticket AFTER INSERT ON games BEGIN
 INSERT INTO ledger VALUES('ticket:'||NEW.id,NEW.uid,-25,'Ticket · '||NEW.kind,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS game_payout AFTER UPDATE OF status ON games WHEN OLD.status='active' AND NEW.status='won' AND NEW.payout>0 BEGIN
 INSERT INTO ledger VALUES('payout:'||NEW.id,NEW.uid,NEW.payout,'Premio · '||NEW.kind,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS grant_all AFTER INSERT ON grants BEGIN
 INSERT INTO ledger SELECT 'grant:'||NEW.id||':'||uid,uid,100,'Entrega del administrador',NEW.at FROM wallets;
END;

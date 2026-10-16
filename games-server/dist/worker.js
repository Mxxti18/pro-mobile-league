var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// engine.mjs
var GameError = class extends Error {
  static {
    __name(this, "GameError");
  }
  constructor(message2, status = 400) {
    super(message2);
    this.status = status;
  }
};
function dateAR(now = Date.now()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(now));
  const x = Object.fromEntries(f.map((p) => [p.type, p.value]));
  return { day: `${x.year}-${x.month}-${x.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(x.weekday) };
}
__name(dateAR, "dateAR");
function available(kind, now = Date.now()) {
  const d = dateAR(now).weekday;
  return kind === "mines" ? [1, 2].includes(d) : kind === "penalties" ? [3, 4].includes(d) : false;
}
__name(available, "available");
function randomInt(n) {
  const range = 4294967296, limit = range - range % n;
  let x;
  do {
    x = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (x >= limit);
  return x % n;
}
__name(randomInt, "randomInt");
function createGame(kind, rng = randomInt) {
  if (kind === "mines") {
    const board = [...Array(15).fill(1), ...Array(10).fill(2), ...Array(5).fill(5), "x2", "x4", "x6", "mine", "mine", "mine"];
    for (let i = board.length - 1; i > 0; i--) {
      const j = rng(i + 1);
      [board[i], board[j]] = [board[j], board[i]];
    }
    return { secret: board, state: { revealed: [], total: 0, mines: 0 }, status: "active", payout: 0 };
  }
  if (kind === "penalties") return { secret: Array.from({ length: 5 }, () => rng(3)), state: { shots: [], goals: 0 }, status: "active", payout: 0 };
  throw new GameError("Juego inexistente.");
}
__name(createGame, "createGame");
function playGame(g, action) {
  if (g.status !== "active") throw new GameError("La partida ya termin\xF3.", 409);
  const next = structuredClone(g), s = next.state;
  if (g.kind === "mines") {
    if (action.type === "cashout") {
      next.status = "won";
      next.payout = s.total;
      return next;
    }
    const i = action.cell;
    if (action.type !== "reveal" || !Number.isInteger(i) || i < 0 || i >= 36) throw new GameError("Eleg\xED una casilla v\xE1lida.");
    if (s.revealed.includes(i)) throw new GameError("Esa casilla ya est\xE1 descubierta.", 409);
    s.revealed.push(i);
    const cell = g.secret[i];
    if (cell === "mine") {
      s.mines++;
      if (s.mines === 3) {
        s.total = 0;
        next.status = "lost";
      }
    } else if (typeof cell === "string") s.total *= Number(cell.slice(1));
    else s.total += cell;
    if (next.status === "active" && s.revealed.length === 36) {
      next.status = "won";
      next.payout = s.total;
    }
  } else {
    if (action.type !== "shoot" || !Number.isInteger(action.direction) || action.direction < 0 || action.direction > 2) throw new GameError("Eleg\xED izquierda, centro o derecha.");
    const keeper = g.secret[s.shots.length], goal = action.direction !== keeper;
    s.shots.push({ direction: action.direction, keeper, goal });
    if (goal) s.goals++;
    if (s.shots.length === 5) {
      next.payout = [0, 0, 10, 25, 50, 100][s.goals];
      next.status = next.payout ? "won" : "lost";
    }
  }
  return next;
}
__name(playGame, "playGame");
function publicGame(row) {
  if (!row) return null;
  const secret = typeof row.secret === "string" ? JSON.parse(row.secret) : row.secret;
  const state = typeof row.state === "string" ? JSON.parse(row.state) : row.state;
  const out = { id: row.id, kind: row.kind, day: row.day, status: row.status, version: row.version, state, payout: row.payout };
  if (row.kind === "mines") out.cells = secret.map((v, i) => state.revealed.includes(i) || row.status !== "active" ? v : null);
  return out;
}
__name(publicGame, "publicGame");

// league.mjs
async function firestore(request, env, path) {
  const r = await fetch("https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/" + path, { headers: { Authorization: request.headers.get("Authorization") || "" }, signal: AbortSignal.timeout(12e3) });
  if (!r.ok) throw new GameError("No se pudo verificar la liga en Firebase.", 503);
  return (await r.json()).fields;
}
__name(firestore, "firestore");
var cachedLeague = null;
async function league(request, env) {
  const h = await firestore(request, env, "leagues/main/data/head");
  const revision = h.revision?.stringValue, n = Number(h.pages?.integerValue);
  if (!revision || !Number.isInteger(n) || n < 1 || n > 240) throw new GameError("La liga no tiene un formato v\xE1lido.", 503);
  if (cachedLeague?.revision === revision && cachedLeague.hash === h.hash?.stringValue) return cachedLeague.data;
  let text = "";
  for (let offset = 0; offset < n; offset += 6) {
    const pages = await Promise.all(Array.from({ length: Math.min(6, n - offset) }, async (_, j) => {
      const i = offset + j, p = await firestore(request, env, "leagues/main/data/" + encodeURIComponent(revision + "-" + i));
      if (p.revision?.stringValue !== revision || Number(p.index?.integerValue) !== i) throw new GameError("La liga est\xE1 actualiz\xE1ndose.", 409);
      return p.text?.stringValue || "";
    }));
    text += pages.join("");
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== h.hash?.stringValue) throw new GameError("No se pudo verificar la liga.", 503);
  cachedLeague = { revision, hash, data: JSON.parse(text) };
  return cachedLeague.data;
}
__name(league, "league");
async function moderator(request, env, uid) {
  if (uid === env.OWNER_UID) return true;
  try {
    return (await firestore(request, env, "roles/" + encodeURIComponent(uid))).role?.stringValue === "moderator";
  } catch {
    return false;
  }
}
__name(moderator, "moderator");
function fixtures(s) {
  const out = [];
  for (let d = 0; d < 3; d++) {
    if (s.activeCompetitions?.[d] === false) continue;
    (s.fixtures?.[d] || []).forEach((round, r) => round.forEach((m) => out.push({ ...m, competition: d, round: r + 1 })));
  }
  if (s.activeCompetitions?.[3] !== false) (s.cup?.rounds || []).forEach((round, r) => round.forEach((m) => out.push({ ...m, competition: "cup", round: r + 1 })));
  return out.filter((m) => m.id && s.teams?.[m.h] && s.teams?.[m.w] && m.h !== m.w).map((m) => ({ ...m, home: s.teams[m.h], away: s.teams[m.w] }));
}
__name(fixtures, "fixtures");

// bets.mjs
var START = Date.parse("2026-10-19T00:00:00-03:00");
function periodTime(now) {
  const day2 = dateAR(now), d = /* @__PURE__ */ new Date(day2.day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - (day2.weekday + 6) % 7);
  const monday = d.toISOString().slice(0, 10);
  return { week: monday, closes: d.getTime() + 4 * 864e5 + 4.5 * 36e5 };
}
__name(periodTime, "periodTime");
function selectSix(s, used = []) {
  const candidates = fixtures(s).filter((m) => m.a === null && m.b === null && !used.includes(m.id)), groups = [0, 1, 2, "cup"].map((d) => candidates.filter((m) => m.competition === d).sort((a, b) => a.round - b.round || a.id.localeCompare(b.id)));
  const out = [];
  while (out.length < 6 && groups.some((g) => g.length)) for (const g of groups) {
    if (g.length && out.length < 6) out.push(g.shift());
  }
  return out;
}
__name(selectSix, "selectSix");
var sameFixture = /* @__PURE__ */ __name((m, slot) => {
  const i = JSON.parse(slot.info);
  return m.h === i.h && m.w === i.w;
}, "sameFixture");
var info = /* @__PURE__ */ __name((m) => JSON.stringify({ id: m.id, h: m.h, w: m.w, home: m.home, away: m.away, competition: m.competition, round: m.round }), "info");
async function bets(path, body, user, ctx) {
  const { request, env, db, now } = ctx;
  const uid = user.sub, trial = path.startsWith("/practice/bets/");
  path = path.replace("/practice", "");
  if (trial && uid !== env.OWNER_UID) throw new GameError("Prueba privada del creador.", 403);
  const rename = /* @__PURE__ */ __name((sql) => trial ? sql.replace(/\b(bet_periods|bet_matches|bet_audit|bets|wallets|ledger)\b/g, (x) => ({ wallets: "trial_wallets", ledger: "trial_ledger" })[x] || "trial_" + x) : sql, "rename");
  const q = /* @__PURE__ */ __name((sql, ...args) => db.prepare(rename(sql)).bind(...args), "q");
  const admin = /* @__PURE__ */ __name(() => moderator(request, env, uid), "admin");
  const trackedRows = /* @__PURE__ */ __name(async () => (await q("SELECT * FROM bet_matches WHERE active=1 ORDER BY rowid DESC LIMIT 120").all()).results.map((m) => ({ ...m, info: JSON.parse(m.info) })), "trackedRows");
  if (!trial && now < START) return { disabled: true, message: "APUESTAS DISPONIBLES DESDE LA PR\xD3XIMA TEMPORADA.", start: START, period: null, matches: [], myBets: [] };
  if (trial) await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, "PRUEBA DE APUESTAS", now).run();
  else await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, (user.name || "Jugador").slice(0, 40), now).run();
  const getSlot = /* @__PURE__ */ __name(async () => {
    const s = await q("SELECT * FROM bet_matches WHERE id=?", body.slot).first();
    if (!s) throw new GameError("Partido de apuestas inexistente.", 404);
    return s;
  }, "getSlot");
  if (path === "/bets/reset" && trial) {
    await db.batch(["DELETE FROM bets", "DELETE FROM bet_audit", "DELETE FROM bet_matches", "DELETE FROM bet_periods", "DELETE FROM ledger", "DELETE FROM wallets"].map((sql) => q(sql)));
    return { ok: true };
  }
  if (path === "/bets/board") {
    const data = await league(request, env), s = data.seasons?.filter((s2) => !s2.closed).at(-1) || (trial ? data.seasons?.at(-1) : null);
    if (!s) return { disabled: true, message: "ESPERANDO LA NUEVA TEMPORADA.", matches: [], myBets: [], tracked: await trackedRows() };
    const t = periodTime(now), id = s.id + ":" + t.week;
    let p = await q("SELECT * FROM bet_periods WHERE id=?", id).first();
    if (!p) {
      const used = (await q("SELECT match_id FROM bet_matches WHERE status<>'void'").all()).results.map((m) => m.match_id), six = selectSix(s, used);
      if (six.length < 6) return { disabled: true, message: "SE NECESITAN SEIS PARTIDOS PENDIENTES PARA PREPARAR EL PER\xCDODO.", matches: [], myBets: [], tracked: await trackedRows() };
      await db.batch([q("INSERT OR IGNORE INTO bet_periods(id,season,week,closes,status,created_at) VALUES(?,?,?,?,?,?)", id, s.id, t.week, trial ? now + 7 * 864e5 : t.closes, "draft", now), ...six.map((m, i) => q("INSERT OR IGNORE INTO bet_matches(id,period,match_id,info,updated_at) VALUES(?,?,?,?,?)", id + ":" + i, id, m.id, info(m), now))]);
      p = await q("SELECT * FROM bet_periods WHERE id=?", id).first();
    }
    if (p.status === "open" && now >= p.closes) {
      await q("UPDATE bet_periods SET status='closed' WHERE id=? AND status='open'", id).run();
      p.status = "closed";
    }
    const matches = (await q("SELECT * FROM bet_matches WHERE period=? AND active=1 ORDER BY rowid", id).all()).results.map((m) => ({ ...m, info: JSON.parse(m.info) }));
    const myBets = (await q("SELECT * FROM bets WHERE uid=? AND period=? ORDER BY created_at", uid, id).all()).results;
    const tracked = await trackedRows();
    return { period: p, matches, tracked, myBets, wallet: await q("SELECT balance FROM wallets WHERE uid=?", uid).first(), spent: myBets.filter((b) => b.status !== "void").reduce((n, b) => n + b.stake, 0), trial, canConfirm: trial ? true : await admin(), canManage: uid === env.OWNER_UID, serverNow: now };
  }
  if (path === "/bets/open") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el creador puede habilitar apuestas.", 403);
    const p = await q("SELECT * FROM bet_periods WHERE id=?", body.period).first();
    if (!p || now >= p.closes) throw new GameError("El plazo de apuestas termin\xF3.", 409);
    const slots = (await q("SELECT * FROM bet_matches WHERE period=? AND active=1", p.id).all()).results;
    if (slots.length !== 6 || slots.some((s) => s.status !== "pending")) throw new GameError("Revis\xE1 los seis partidos antes de habilitar.", 409);
    const data = await league(request, env), season = data.seasons.find((s) => s.id === p.season);
    if (!season || !trial && season.closed) throw new GameError("La temporada est\xE1 cerrada.", 409);
    const fs = fixtures(season);
    if (slots.some((s) => !fs.some((m) => m.id === s.match_id && sameFixture(m, s) && m.a === null && m.b === null))) throw new GameError("Hay partidos ya jugados. Correg\xED la selecci\xF3n.", 409);
    await q("UPDATE bet_periods SET status='open' WHERE id=? AND status='draft'", p.id).run();
    return { ok: true };
  }
  if (path === "/bets/place") {
    if (!["home", "draw", "away"].includes(body.choice) || !Number.isInteger(body.stake) || body.stake < 1 || body.stake > 150 || typeof body.id !== "string" || !/^[-a-zA-Z0-9]{16,64}$/.test(body.id)) throw new GameError("Eleg\xED resultado y una cantidad entera de 1 a 150 fichas.");
    const slot = await getSlot();
    const old = await q("SELECT * FROM bets WHERE uid=? AND slot=?", uid, slot.id).first();
    if (old) {
      if (old.choice === body.choice && old.stake === body.stake) return { bet: old };
      throw new GameError("Ya hay una apuesta registrada para este partido.", 409);
    }
    const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first();
    if (p.status !== "open" || now >= p.closes || slot.status !== "pending" || slot.active !== 1) throw new GameError("Las apuestas est\xE1n cerradas.", 409);
    const data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season), m = s && fixtures(s).find((m2) => m2.id === slot.match_id);
    if (!s || !trial && s.closed || !m || !sameFixture(m, slot) || m.a !== null || m.b !== null) throw new GameError("Este partido ya tiene resultado. Esper\xE1 una correcci\xF3n del administrador.", 409);
    try {
      await q("INSERT INTO bets(id,uid,period,slot,choice,stake,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", body.id, uid, slot.period, slot.id, body.choice, body.stake, now, now).run();
    } catch (e) {
      const retry = await q("SELECT * FROM bets WHERE id=? AND uid=?", body.id, uid).first();
      if (retry && retry.slot === body.slot && retry.choice === body.choice && retry.stake === body.stake) return { bet: retry };
      throw new GameError("No se registr\xF3 la apuesta. Verific\xE1 tu saldo, el m\xE1ximo de 150 fichas y si el partido sigue disponible.", 409);
    }
    return { ok: true };
  }
  if (path === "/bets/replace") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el creador puede corregir la selecci\xF3n.", 403);
    const slot = await getSlot();
    if (slot.status !== "pending" || slot.active !== 1) throw new GameError("Este partido ya fue liquidado o anulado.", 409);
    const reason = String(body.reason || "").trim().slice(0, 200);
    if (!reason) throw new GameError("Indic\xE1 el motivo de la correcci\xF3n.");
    const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first();
    const data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season), m = s && fixtures(s).find((m2) => m2.id === body.match);
    if (!m || m.a !== null || m.b !== null) throw new GameError("Eleg\xED un partido pendiente de esa temporada.");
    if (await q("SELECT id FROM bet_matches WHERE match_id=? AND status<>'void' AND id<>?", m.id, slot.id).first()) throw new GameError("Ese partido ya est\xE1 seleccionado.", 409);
    const id = crypto.randomUUID();
    await db.batch([q("UPDATE bet_matches SET status='void',active=0,reason=?,version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=?", reason, now, slot.id, slot.version), q("INSERT INTO bet_matches(id,period,match_id,info,updated_at,replaced_from) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=? AND status='void' AND version=?)", id, p.id, m.id, info(m), now, slot.id, slot.id, slot.version + 1), q("INSERT OR IGNORE INTO bet_audit(id,actor,slot,action,reason,at) SELECT ?,?,?,'replace',?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=?)", id, uid, slot.id, reason, now, id)]);
    return { ok: true };
  }
  if (path === "/bets/settle") {
    if (!await admin()) throw new GameError("Solo administradores pueden confirmar para apuestas.", 403);
    if (body.confirm !== true) throw new GameError("Falta la confirmaci\xF3n de apuestas.");
    const slot = await getSlot();
    if (slot.status === "settled") {
      if (slot.a !== body.a || slot.b !== body.b) throw new GameError("Las apuestas ya fueron liquidadas con otro marcador.", 409);
      return { ok: true, alreadySettled: true };
    }
    if (slot.status !== "pending" || slot.active !== 1) throw new GameError("El partido fue anulado.", 409);
    let m;
    if (trial) {
      if (!Number.isInteger(body.a) || !Number.isInteger(body.b) || body.a < 0 || body.b < 0 || body.a > 99 || body.b > 99) throw new GameError("Marcador de prueba inv\xE1lido.");
      m = { a: body.a, b: body.b };
    } else {
      const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first(), data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season);
      m = s && fixtures(s).find((m2) => m2.id === slot.match_id);
      if (!m || !sameFixture(m, slot) || !Number.isInteger(m.a) || !Number.isInteger(m.b) || m.a < 0 || m.b < 0 || m.a > 99 || m.b > 99) throw new GameError("Primero guard\xE1 el resultado y esper\xE1 a que se sincronice.", 409);
      if (m.a !== body.a || m.b !== body.b) throw new GameError("El resultado cambi\xF3. Revisalo antes de confirmar.", 409);
    }
    const result = await q("UPDATE bet_matches SET a=?,b=?,status='settled',version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=? RETURNING id", m.a, m.b, now, slot.id, slot.version).first();
    if (!result) throw new GameError("La confirmaci\xF3n ya cambi\xF3. Actualiz\xE1.", 409);
    await q("INSERT OR IGNORE INTO bet_audit VALUES(?,?,?,'settle',?,?)", slot.id + ":settle", uid, slot.id, "Resultado confirmado: " + m.a + "\u2013" + m.b, now).run();
    return { ok: true };
  }
  throw new GameError("Ruta inexistente.", 404);
}
__name(bets, "bets");

// practice.mjs
var PRACTICE_OWNER = "iCLoGhjbXNgY3Q7dbxX0456vagI2";
async function practice(path, body, user, q, now) {
  if (user.sub !== PRACTICE_OWNER) throw new GameError("Este modo est\xE1 reservado para el creador.", 403);
  const uid = user.sub, initial = { wallet: { name: "PRUEBA", balance: 500 }, games: [], movements: [] };
  await q("INSERT OR IGNORE INTO practice_sessions(uid,state,updated_at) VALUES(?,?,?)", uid, JSON.stringify(initial), now).run();
  const row = await q("SELECT * FROM practice_sessions WHERE uid=?", uid).first();
  let data = JSON.parse(row.state), changed = false;
  if (path === "/practice/reset") {
    data = initial;
    changed = true;
  } else if (path === "/practice/me") {
  } else if (path === "/practice/games/start") {
    if (!["mines", "penalties"].includes(body.kind)) throw new GameError("Juego inv\xE1lido.");
    let g = data.games.find((x) => x.kind === body.kind);
    if (!g || g.status !== "active") {
      if (data.wallet.balance < 25) throw new GameError("Reinici\xE1 la prueba para recuperar fichas de prueba.", 409);
      g = { ...createGame(body.kind), id: crypto.randomUUID(), kind: body.kind, day: dateAR(now).day, version: 0 };
      data.games = data.games.filter((x) => x.kind !== body.kind);
      data.games.push(g);
      data.wallet.balance -= 25;
      data.movements.unshift({ amount: -25, reason: "TICKET DE PRUEBA", at: now });
      changed = true;
    }
  } else if (path === "/practice/games/action") {
    const g = data.games.find((x) => x.id === body.id);
    if (!g) throw new GameError("Partida de prueba inexistente.", 404);
    if (g.version !== body.version) throw new GameError("La prueba cambi\xF3. Actualiz\xE1 para continuar.", 409);
    const next = playGame(g, body.action || {});
    next.version = g.version + 1;
    data.games = data.games.map((x) => x.id === g.id ? next : x);
    if (next.status === "won" && next.payout) {
      data.wallet.balance += next.payout;
      data.movements.unshift({ amount: next.payout, reason: "PREMIO DE PRUEBA", at: now });
    }
    changed = true;
  } else throw new GameError("Ruta de prueba inexistente.", 404);
  data.movements = data.movements.slice(0, 30);
  if (changed) {
    const updated = await q("UPDATE practice_sessions SET state=?,version=version+1,updated_at=? WHERE uid=? AND version=? RETURNING uid", JSON.stringify(data), now, uid, row.version).first();
    if (!updated) throw new GameError("Otra acci\xF3n actualiz\xF3 la prueba. Volv\xE9 a cargarla.", 409);
  }
  return { ...data, games: data.games.map(publicGame), day: dateAR(now).day, available: { mines: true, penalties: true }, practice: true };
}
__name(practice, "practice");

// node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat, "concat");
function encode(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("non-ASCII string encountered in encode()");
    }
    bytes[i] = code;
  }
  return bytes;
}
__name(encode, "encode");

// node_modules/jose/dist/webapi/lib/base64.js
function decodeBase64(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(decodeBase64, "decodeBase64");

// node_modules/jose/dist/webapi/util/base64url.js
function decode(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeBase64(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}
__name(decode, "decode");

// node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static {
    __name(this, "JWTExpired");
  }
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWKSInvalid = class extends JOSEError {
  static {
    __name(this, "JWKSInvalid");
  }
  static code = "ERR_JWKS_INVALID";
  code = "ERR_JWKS_INVALID";
};
var JWKSNoMatchingKey = class extends JOSEError {
  static {
    __name(this, "JWKSNoMatchingKey");
  }
  static code = "ERR_JWKS_NO_MATCHING_KEY";
  code = "ERR_JWKS_NO_MATCHING_KEY";
  constructor(message2 = "no applicable key found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSMultipleMatchingKeys = class extends JOSEError {
  static {
    __name(this, "JWKSMultipleMatchingKeys");
  }
  [Symbol.asyncIterator];
  static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  constructor(message2 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message2, options);
  }
};
var JWKSTimeout = class extends JOSEError {
  static {
    __name(this, "JWKSTimeout");
  }
  static code = "ERR_JWKS_TIMEOUT";
  code = "ERR_JWKS_TIMEOUT";
  constructor(message2 = "request timed out", options) {
    super(message2, options);
  }
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// node_modules/jose/dist/webapi/lib/crypto_key.js
var unusable = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
var isAlgorithm = /* @__PURE__ */ __name((algorithm, name) => algorithm.name === name, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
__name(checkUsage, "checkUsage");
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87": {
      if (!isAlgorithm(key.algorithm, alg))
        throw unusable(alg);
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usage);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");

// node_modules/jose/dist/webapi/lib/invalid_key_input.js
function message(msg, actual, ...types) {
  types = types.filter(Boolean);
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else if (types.length === 2) {
    msg += `one of type ${types[0]} or ${types[1]}.`;
  } else {
    msg += `of type ${types[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message, "message");
var invalidKeyInput = /* @__PURE__ */ __name((actual, ...types) => message("Key must be ", actual, ...types), "invalidKeyInput");
var withAlg = /* @__PURE__ */ __name((alg, actual, ...types) => message(`Key for the ${alg} algorithm must be `, actual, ...types), "withAlg");

// node_modules/jose/dist/webapi/lib/is_key_like.js
var isCryptoKey = /* @__PURE__ */ __name((key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
}, "isCryptoKey");
var isKeyObject = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
var isKeyLike = /* @__PURE__ */ __name((key) => isCryptoKey(key) || isKeyObject(key), "isKeyLike");

// node_modules/jose/dist/webapi/lib/is_disjoint.js
function isDisjoint(...headers) {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}
__name(isDisjoint, "isDisjoint");

// node_modules/jose/dist/webapi/lib/is_object.js
var isObjectLike = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null, "isObjectLike");
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject, "isObject");

// node_modules/jose/dist/webapi/lib/check_key_length.js
function checkKeyLength(alg, key) {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}
__name(checkKeyLength, "checkKeyLength");

// node_modules/jose/dist/webapi/lib/jwk_to_key.js
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "AKP": {
      switch (jwk.alg) {
        case "ML-DSA-44":
        case "ML-DSA-65":
        case "ML-DSA-87":
          algorithm = { name: jwk.alg };
          keyUsages = jwk.priv ? ["sign"] : ["verify"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
async function jwkToKey(jwk) {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  if (keyData.kty !== "AKP") {
    delete keyData.alg;
  }
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
}
__name(jwkToKey, "jwkToKey");

// node_modules/jose/dist/webapi/key/import.js
async function importJWK(jwk, alg, options) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  let ext;
  alg ??= jwk.alg;
  ext ??= options?.extractable ?? jwk.ext;
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
      return jwkToKey({ ...jwk, alg, ext });
    case "AKP": {
      if (typeof jwk.alg !== "string" || !jwk.alg) {
        throw new TypeError('missing "alg" (Algorithm) Parameter value');
      }
      if (alg !== void 0 && alg !== jwk.alg) {
        throw new TypeError("JWK alg and alg option value mismatch");
      }
      return jwkToKey({ ...jwk, ext });
    }
    case "EC":
    case "OKP":
      return jwkToKey({ ...jwk, alg, ext });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(importJWK, "importJWK");

// node_modules/jose/dist/webapi/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit, "validateCrit");

// node_modules/jose/dist/webapi/lib/validate_algorithms.js
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}
__name(validateAlgorithms, "validateAlgorithms");

// node_modules/jose/dist/webapi/lib/is_jwk.js
var isJWK = /* @__PURE__ */ __name((key) => isObject(key) && typeof key.kty === "string", "isJWK");
var isPrivateJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string"), "isPrivateJWK");
var isPublicJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0, "isPublicJWK");
var isSecretJWK = /* @__PURE__ */ __name((key) => key.kty === "oct" && typeof key.k === "string", "isSecretJWK");

// node_modules/jose/dist/webapi/lib/normalize_key.js
var cache;
var handleJWK = /* @__PURE__ */ __name(async (key, jwk, alg, freeze = false) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwkToKey({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleJWK");
var handleKeyObject = /* @__PURE__ */ __name((keyObject, alg) => {
  cache ||= /* @__PURE__ */ new WeakMap();
  let cached = cache.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  switch (keyObject.asymmetricKeyType) {
    case "ml-dsa-44":
    case "ml-dsa-65":
    case "ml-dsa-87": {
      if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg === "ES256" && namedCurve === "P-256") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES384" && namedCurve === "P-384") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES512" && namedCurve === "P-521") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError("given KeyObject instance cannot be used for this algorithm");
  }
  if (!cached) {
    cache.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleKeyObject");
async function normalizeKey(key, alg) {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey(key)) {
    return key;
  }
  if (isKeyObject(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}
__name(normalizeKey, "normalizeKey");

// node_modules/jose/dist/webapi/lib/check_key_type.js
var tag = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
    }
  }
  if (!isKeyLike(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
    }
  }
}, "asymmetricTypeCheck");
function checkKeyType(alg, key, usage) {
  switch (alg.substring(0, 2)) {
    case "A1":
    case "A2":
    case "di":
    case "HS":
    case "PB":
      symmetricTypeCheck(alg, key, usage);
      break;
    default:
      asymmetricTypeCheck(alg, key, usage);
  }
}
__name(checkKeyType, "checkKeyType");

// node_modules/jose/dist/webapi/lib/subtle_dsa.js
function subtleAlgorithm(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return { name: alg };
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleAlgorithm, "subtleAlgorithm");

// node_modules/jose/dist/webapi/lib/get_sign_verify_key.js
async function getSigKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalidKeyInput(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}
__name(getSigKey, "getSigKey");

// node_modules/jose/dist/webapi/lib/verify.js
async function verify(alg, key, signature, data) {
  const cryptoKey = await getSigKey(alg, key, "verify");
  checkKeyLength(alg, cryptoKey);
  const algorithm = subtleAlgorithm(alg, cryptoKey.algorithm);
  try {
    return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}
__name(verify, "verify");

// node_modules/jose/dist/webapi/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!isDisjoint(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validateCrit(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
  }
  checkKeyType(alg, key, "verify");
  const data = concat(jws.protected !== void 0 ? encode(jws.protected) : new Uint8Array(), encode("."), typeof jws.payload === "string" ? b64 ? encode(jws.payload) : encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const k = await normalizeKey(key, alg);
  const verified = await verify(alg, k, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key: k };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");

// node_modules/jose/dist/webapi/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");

// node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "epoch");
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function secs(str) {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
}
__name(secs, "secs");
var normalizeTyp = /* @__PURE__ */ __name((value) => {
  if (value.includes("/")) {
    return value.toLowerCase();
  }
  return `application/${value.toLowerCase()}`;
}, "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}
__name(validateClaimsSet, "validateClaimsSet");

// node_modules/jose/dist/webapi/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");

// node_modules/jose/dist/webapi/jwks/local.js
function getKtyFromAlg(alg) {
  switch (typeof alg === "string" && alg.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    case "ML":
      return "AKP";
    default:
      throw new JOSENotSupported('Unsupported "alg" value for a JSON Web Key Set');
  }
}
__name(getKtyFromAlg, "getKtyFromAlg");
function isJWKSLike(jwks) {
  return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
}
__name(isJWKSLike, "isJWKSLike");
function isJWKLike(key) {
  return isObject(key);
}
__name(isJWKLike, "isJWKLike");
var LocalJWKSet = class {
  static {
    __name(this, "LocalJWKSet");
  }
  #jwks;
  #cached = /* @__PURE__ */ new WeakMap();
  constructor(jwks) {
    if (!isJWKSLike(jwks)) {
      throw new JWKSInvalid("JSON Web Key Set malformed");
    }
    this.#jwks = structuredClone(jwks);
  }
  jwks() {
    return this.#jwks;
  }
  async getKey(protectedHeader, token) {
    const { alg, kid } = { ...protectedHeader, ...token?.header };
    const kty = getKtyFromAlg(alg);
    const candidates = this.#jwks.keys.filter((jwk2) => {
      let candidate = kty === jwk2.kty;
      if (candidate && typeof kid === "string") {
        candidate = kid === jwk2.kid;
      }
      if (candidate && (typeof jwk2.alg === "string" || kty === "AKP")) {
        candidate = alg === jwk2.alg;
      }
      if (candidate && typeof jwk2.use === "string") {
        candidate = jwk2.use === "sig";
      }
      if (candidate && Array.isArray(jwk2.key_ops)) {
        candidate = jwk2.key_ops.includes("verify");
      }
      if (candidate) {
        switch (alg) {
          case "ES256":
            candidate = jwk2.crv === "P-256";
            break;
          case "ES384":
            candidate = jwk2.crv === "P-384";
            break;
          case "ES512":
            candidate = jwk2.crv === "P-521";
            break;
          case "Ed25519":
          case "EdDSA":
            candidate = jwk2.crv === "Ed25519";
            break;
        }
      }
      return candidate;
    });
    const { 0: jwk, length } = candidates;
    if (length === 0) {
      throw new JWKSNoMatchingKey();
    }
    if (length !== 1) {
      const error = new JWKSMultipleMatchingKeys();
      const _cached = this.#cached;
      error[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates) {
          try {
            yield await importWithAlgCache(_cached, jwk2, alg);
          } catch {
          }
        }
      };
      throw error;
    }
    return importWithAlgCache(this.#cached, jwk, alg);
  }
};
async function importWithAlgCache(cache2, jwk, alg) {
  const cached = cache2.get(jwk) || cache2.set(jwk, {}).get(jwk);
  if (cached[alg] === void 0) {
    const key = await importJWK({ ...jwk, ext: true }, alg);
    if (key instanceof Uint8Array || key.type !== "public") {
      throw new JWKSInvalid("JSON Web Key Set members must be public keys");
    }
    cached[alg] = key;
  }
  return cached[alg];
}
__name(importWithAlgCache, "importWithAlgCache");
function createLocalJWKSet(jwks) {
  const set = new LocalJWKSet(jwks);
  const localJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "localJWKSet");
  Object.defineProperties(localJWKSet, {
    jwks: {
      value: /* @__PURE__ */ __name(() => structuredClone(set.jwks()), "value"),
      enumerable: false,
      configurable: false,
      writable: false
    }
  });
  return localJWKSet;
}
__name(createLocalJWKSet, "createLocalJWKSet");

// node_modules/jose/dist/webapi/jwks/remote.js
function isCloudflareWorkers() {
  return typeof WebSocketPair !== "undefined" || typeof navigator !== "undefined" && true || typeof EdgeRuntime !== "undefined" && EdgeRuntime === "vercel";
}
__name(isCloudflareWorkers, "isCloudflareWorkers");
var USER_AGENT;
if (typeof navigator === "undefined" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) {
  const NAME = "jose";
  const VERSION = "v6.1.3";
  USER_AGENT = `${NAME}/${VERSION}`;
}
var customFetch = Symbol();
async function fetchJwks(url, headers, signal, fetchImpl = fetch) {
  const response2 = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "manual",
    headers
  }).catch((err) => {
    if (err.name === "TimeoutError") {
      throw new JWKSTimeout();
    }
    throw err;
  });
  if (response2.status !== 200) {
    throw new JOSEError("Expected 200 OK from the JSON Web Key Set HTTP response");
  }
  try {
    return await response2.json();
  } catch {
    throw new JOSEError("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}
__name(fetchJwks, "fetchJwks");
var jwksCache = Symbol();
function isFreshJwksCache(input, cacheMaxAge) {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  if (!("uat" in input) || typeof input.uat !== "number" || Date.now() - input.uat >= cacheMaxAge) {
    return false;
  }
  if (!("jwks" in input) || !isObject(input.jwks) || !Array.isArray(input.jwks.keys) || !Array.prototype.every.call(input.jwks.keys, isObject)) {
    return false;
  }
  return true;
}
__name(isFreshJwksCache, "isFreshJwksCache");
var RemoteJWKSet = class {
  static {
    __name(this, "RemoteJWKSet");
  }
  #url;
  #timeoutDuration;
  #cooldownDuration;
  #cacheMaxAge;
  #jwksTimestamp;
  #pendingFetch;
  #headers;
  #customFetch;
  #local;
  #cache;
  constructor(url, options) {
    if (!(url instanceof URL)) {
      throw new TypeError("url must be an instance of URL");
    }
    this.#url = new URL(url.href);
    this.#timeoutDuration = typeof options?.timeoutDuration === "number" ? options?.timeoutDuration : 5e3;
    this.#cooldownDuration = typeof options?.cooldownDuration === "number" ? options?.cooldownDuration : 3e4;
    this.#cacheMaxAge = typeof options?.cacheMaxAge === "number" ? options?.cacheMaxAge : 6e5;
    this.#headers = new Headers(options?.headers);
    if (USER_AGENT && !this.#headers.has("User-Agent")) {
      this.#headers.set("User-Agent", USER_AGENT);
    }
    if (!this.#headers.has("accept")) {
      this.#headers.set("accept", "application/json");
      this.#headers.append("accept", "application/jwk-set+json");
    }
    this.#customFetch = options?.[customFetch];
    if (options?.[jwksCache] !== void 0) {
      this.#cache = options?.[jwksCache];
      if (isFreshJwksCache(options?.[jwksCache], this.#cacheMaxAge)) {
        this.#jwksTimestamp = this.#cache.uat;
        this.#local = createLocalJWKSet(this.#cache.jwks);
      }
    }
  }
  pendingFetch() {
    return !!this.#pendingFetch;
  }
  coolingDown() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cooldownDuration : false;
  }
  fresh() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cacheMaxAge : false;
  }
  jwks() {
    return this.#local?.jwks();
  }
  async getKey(protectedHeader, token) {
    if (!this.#local || !this.fresh()) {
      await this.reload();
    }
    try {
      return await this.#local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey) {
        if (this.coolingDown() === false) {
          await this.reload();
          return this.#local(protectedHeader, token);
        }
      }
      throw err;
    }
  }
  async reload() {
    if (this.#pendingFetch && isCloudflareWorkers()) {
      this.#pendingFetch = void 0;
    }
    this.#pendingFetch ||= fetchJwks(this.#url.href, this.#headers, AbortSignal.timeout(this.#timeoutDuration), this.#customFetch).then((json) => {
      this.#local = createLocalJWKSet(json);
      if (this.#cache) {
        this.#cache.uat = Date.now();
        this.#cache.jwks = json;
      }
      this.#jwksTimestamp = Date.now();
      this.#pendingFetch = void 0;
    }).catch((err) => {
      this.#pendingFetch = void 0;
      throw err;
    });
    await this.#pendingFetch;
  }
};
function createRemoteJWKSet(url, options) {
  const set = new RemoteJWKSet(url, options);
  const remoteJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "remoteJWKSet");
  Object.defineProperties(remoteJWKSet, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => set.coolingDown(), "get"),
      enumerable: true,
      configurable: false
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => set.fresh(), "get"),
      enumerable: true,
      configurable: false
    },
    reload: {
      value: /* @__PURE__ */ __name(() => set.reload(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => set.pendingFetch(), "get"),
      enumerable: true,
      configurable: false
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => set.jwks(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return remoteJWKSet;
}
__name(createRemoteJWKSet, "createRemoteJWKSet");

// auth.mjs
var keys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
async function verifyToken(token, project, keyset = keys) {
  try {
    const { payload } = await jwtVerify(token, keyset, { algorithms: ["RS256"], issuer: `https://securetoken.google.com/${project}`, audience: project, requiredClaims: ["exp", "iat", "sub", "auth_time"] });
    const now = Math.floor(Date.now() / 1e3);
    if (typeof payload.sub !== "string" || !payload.sub.length || payload.sub.length > 128 || payload.iat > now || !Number.isFinite(payload.auth_time) || payload.auth_time > now) throw new Error("claims");
    return payload;
  } catch {
    throw new GameError("Tu sesi\xF3n venci\xF3. Volv\xE9 a iniciar sesi\xF3n.", 401);
  }
}
__name(verifyToken, "verifyToken");
async function authenticate(request, env) {
  const value = request.headers.get("Authorization") || "";
  if (!value.startsWith("Bearer ") || value.length > 8192) throw new GameError("Inici\xE1 sesi\xF3n para jugar.", 401);
  return verifyToken(value.slice(7), env.FIREBASE_PROJECT_ID);
}
__name(authenticate, "authenticate");

// worker.mjs
var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
var response = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status, headers: cors }), "response");
var cleanName = /* @__PURE__ */ __name((n) => typeof n === "string" ? n.trim().slice(0, 40) : "", "cleanName");
async function handle(request, env, identity = null, now = Date.now()) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") {
    await env.DB.prepare("SELECT uid FROM wallets LIMIT 1").bind().first();
    return response({ service: "pml-games", version: "1.9.5", rules: 1, practice: true, bets: true });
  }
  if (!["GET", "POST"].includes(request.method)) throw new GameError("M\xE9todo no permitido.", 405);
  const user = identity || await authenticate(request, env), uid = user.sub;
  const db = env.DB.withSession ? env.DB.withSession("first-primary") : env.DB;
  const q = /* @__PURE__ */ __name((sql, ...v) => db.prepare(sql).bind(...v), "q");
  if (request.method === "POST" && Number(request.headers.get("Content-Length") || 0) > 4096) throw new GameError("Solicitud demasiado grande.", 413);
  let body = {};
  if (request.method === "POST") {
    const text = await request.text();
    if (text.length > 4096) throw new GameError("Solicitud demasiado grande.", 413);
    try {
      body = JSON.parse(text);
    } catch {
      throw new GameError("Solicitud inv\xE1lida.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new GameError("Solicitud inv\xE1lida.");
  }
  if (path.startsWith("/bets/") || path.startsWith("/practice/bets/")) return response(await bets(path, body, user, { request, env, db, now }));
  if (path.startsWith("/practice/")) {
    if (request.method !== "POST") throw new GameError("M\xE9todo no permitido.", 405);
    return response(await practice(path, body, user, q, now));
  }
  await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, cleanName(user.name) || "Jugador " + uid.slice(-5), now).run();
  if (path === "/me" && request.method === "POST") {
    const name = cleanName(body.name);
    if (name) await q("UPDATE wallets SET name=? WHERE uid=?", name, uid).run();
  }
  const day2 = dateAR(now).day;
  if (path === "/me" || path === "/games/start") await q("UPDATE games SET status='expired',updated_at=? WHERE uid=? AND status='active' AND day<>?", now, uid, day2).run();
  if (path === "/me") {
    const wallet = await q("SELECT name,balance FROM wallets WHERE uid=?", uid).first();
    const games = await q("SELECT * FROM games WHERE uid=? AND day=?", uid, day2).all();
    const movements = await q("SELECT amount,reason,at FROM ledger WHERE uid=? ORDER BY at DESC,rowid DESC LIMIT 30", uid).all();
    return response({ wallet, games: games.results.map(publicGame), movements: movements.results, day: day2, available: { mines: available("mines", now), penalties: available("penalties", now) } });
  }
  if (path === "/ranking" && request.method === "GET") {
    const rows = await q("SELECT name,balance,uid=? AS me FROM wallets ORDER BY balance DESC,created_at ASC LIMIT 50", uid).all();
    return response({ ranking: rows.results });
  }
  if (path === "/games/start" && request.method === "POST") {
    const kind = body.kind;
    if (!available(kind, now)) throw new GameError(kind === "mines" ? "Buscaminas est\xE1 disponible lunes y martes." : "Penales est\xE1 disponible mi\xE9rcoles y jueves.", 403);
    const old = await q("SELECT * FROM games WHERE uid=? AND kind=? AND day=?", uid, kind, day2).first();
    if (old) return response({ game: publicGame(old) });
    const g = createGame(kind), id = crypto.randomUUID();
    try {
      await q("INSERT INTO games(id,uid,kind,day,status,secret,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", id, uid, kind, day2, g.status, JSON.stringify(g.secret), JSON.stringify(g.state), now, now).run();
    } catch (e) {
      const existing = await q("SELECT * FROM games WHERE uid=? AND kind=? AND day=?", uid, kind, day2).first();
      if (existing) return response({ game: publicGame(existing) });
      const w = await q("SELECT balance FROM wallets WHERE uid=?", uid).first();
      if (w.balance < 25) throw new GameError("No ten\xE9s fichas suficientes para el ticket.", 409);
      throw e;
    }
    return response({ game: publicGame(await q("SELECT * FROM games WHERE id=?", id).first()) });
  }
  if (path === "/games/action" && request.method === "POST") {
    if (typeof body.id !== "string" || !Number.isInteger(body.version)) throw new GameError("Partida inv\xE1lida.");
    const row = await q("SELECT * FROM games WHERE id=? AND uid=?", body.id, uid).first();
    if (!row) throw new GameError("Partida no encontrada.", 404);
    if (row.day !== day2) throw new GameError("La partida venci\xF3 al finalizar el d\xEDa.", 409);
    if (row.version !== body.version) throw new GameError("La partida cambi\xF3. Actualiz\xE1 para continuar.", 409);
    const next = playGame({ ...row, secret: JSON.parse(row.secret), state: JSON.parse(row.state) }, body.action || {});
    const result = await q("UPDATE games SET state=?,status=?,payout=?,version=version+1,updated_at=? WHERE id=? AND uid=? AND version=? AND status='active' RETURNING id", JSON.stringify(next.state), next.status, next.payout, now, row.id, uid, row.version).first();
    if (!result) throw new GameError("La jugada ya fue procesada. Actualiz\xE1 para continuar.", 409);
    return response({ game: publicGame(await q("SELECT * FROM games WHERE id=?", row.id).first()) });
  }
  if (path === "/admin/grant" && request.method === "POST") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el administrador puede entregar fichas.", 403);
    if (typeof body.id !== "string" || !/^[-a-zA-Z0-9]{16,64}$/.test(body.id)) throw new GameError("Entrega inv\xE1lida.");
    if (await q("SELECT id FROM grants WHERE id=?", body.id).first()) return response({ ok: true });
    let token = "", profiles = [];
    do {
      const url = new URL("https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/profiles");
      url.searchParams.set("pageSize", "1000");
      if (token) url.searchParams.set("pageToken", token);
      const res = await fetch(url, { headers: { Authorization: request.headers.get("Authorization") || "" }, signal: AbortSignal.timeout(1e4) });
      if (!res.ok) throw new GameError("No se pudieron consultar los usuarios registrados. No se realiz\xF3 la entrega.", 503);
      const page = await res.json();
      for (const d of page.documents || []) {
        const id = d.name?.split("/").pop();
        if (typeof id === "string" && id.length > 0 && id.length <= 128) profiles.push({ uid: id, name: cleanName(d.fields?.name?.stringValue) || "Jugador " + id.slice(-5) });
      }
      token = page.nextPageToken || "";
      if (profiles.length > 1e4) throw new GameError("La lista de usuarios supera el l\xEDmite de esta entrega.", 503);
    } while (token);
    await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) SELECT json_extract(value,'$.uid'),json_extract(value,'$.name'),? FROM json_each(?)", now, JSON.stringify(profiles)).run();
    await q("INSERT OR IGNORE INTO grants(id,at) VALUES(?,?)", body.id, now).run();
    return response({ ok: true });
  }
  throw new GameError("Ruta inexistente.", 404);
}
__name(handle, "handle");
var worker_default = { async fetch(request, env) {
  try {
    return await handle(request, { ...env, FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || "pro-mobile-league", OWNER_UID: env.OWNER_UID || "iCLoGhjbXNgY3Q7dbxX0456vagI2" });
  } catch (e) {
    if (e instanceof GameError) return response({ error: e.message }, e.status);
    console.error("PML games failure", e?.name);
    return response({ error: "El servidor no pudo completar la operaci\xF3n. Tu partida se conserva." }, 503);
  }
} };
export {
  worker_default as default,
  handle
};
//# sourceMappingURL=worker.js.map

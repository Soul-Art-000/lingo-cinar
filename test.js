const up = s => s.toLocaleUpperCase("tr").trim();
const len = w => [...w].length;
const EXCLUDE = new Set(["AMCIK","İBNE","KAHPE","OROSPU","ORUSPU","SİKTİR","SİKİŞ","SİKMEK","YARAK","YARRAK","GAVAT","PEZEVENK","OĞLAN","KANCIK","AMINA","GÖTÜNDEN"]);
EXCLUDE.forEach(w => TDK.delete(w));
const WORDS_BY_LEN = { 4: [], 5: [], 6: [], 7: [] };
TDK.forEach(w => {
  const l = len(w);
  if (WORDS_BY_LEN[l]) WORDS_BY_LEN[l].push(w);
});
// Rules: each word belongs to one team (no stealing). 5 guesses, first letter shown, time limit per guess.
// Invalid guess (not in TDK, wrong length, repeated) or timeout burns that guess.
// Host-tunable settings (persisted in localStorage).
let cfg = {tries: 5, time: 10, points: 25, bonus: 0, first: true, penalty: true, shuffle: false, kbHints: true};
const ROWS = ["ERTYUIOPĞÜ", "ASDFGHJKLŞİ", "↵ZCVBNMÖÇ⌫"];

// Two-pass Lingo scoring: exact matches first, then present letters limited by remaining counts.
function evaluate(guess, answer) {
  const g = [...guess], a = [...answer], res = Array(a.length).fill("absent"), left = {};
  a.forEach((c, i) => g[i] === c ? res[i] = "correct" : left[c] = (left[c] || 0) + 1);
  g.forEach((c, i) => { if (res[i] !== "correct" && left[c]) { res[i] = "present"; left[c]--; } });
  return res;
}

const $ = id => document.getElementById(id);
let wt = 5, teams = [], words = [], setupWords = [], setupTeams = [], wi = -1, team = 0, answer, LEN, row, cur, known, timeLeft, timeMax, tick, over, tried;

function drawTeams() {
  $("teams").innerHTML = teams.map((t, i) => `<span class="team${i === team ? " on" : ""}">${t.name}<b>${t.score}</b></span>`).join("");
  $("turn").innerHTML = over ? "" : `Sıra: <span>${teams[team].name}</span>`;
}
function startClock(sec) {
  clearInterval(tick); timeLeft = timeMax = sec || 1; drawTimer();
  if (!sec) return;
  tick = setInterval(() => { timeLeft--; drawTimer(); if (timeLeft <= 0) fail("Süre doldu!"); }, 1000);
}
function stopClock() { clearInterval(tick); tick = null; }
function newWord() {
  if (++wi >= words.length) return gameOver();
  answer = words[wi]; LEN = len(answer);
  team = wi % teams.length; row = 0; over = false; tried = new Set();
  known = Array(LEN).fill(""); if (cfg.first) known[0] = [...answer][0];
  $("round").textContent = `Kelime ${wi + 1}/${words.length}`;
  $("board").innerHTML = Array.from({length: wt = cfg.tries}, rowHTML).join("");
  document.querySelectorAll(".key").forEach(k => k.classList.remove("correct", "present", "absent"));
  msg(""); drawTeams(); startRow(); stopClock();
  timeLeft = timeMax = 1; drawTimer();
  // Pause at every team change; clock starts only when the host presses "Başla".
  $("readyTitle").textContent = `Sıra: ${teams[team].name}`;
  $("readyText").textContent = `${LEN} harfli kelime${cfg.first ? ` · ilk harf "${known[0]}"` : ""} · ${cfg.tries} hak · ${cfg.time ? `tahmin başına ${cfg.time} sn` : "süresiz"}`;
  $("ready").showModal();
}
function rowHTML() {
  return `<div class="row" role="row" style="grid-template-columns:repeat(${LEN},56px)">${'<div class="tile" role="gridcell"></div>'.repeat(LEN)}</div>`;
}
function drawTimer() { $("bar").style.width = (timeLeft / timeMax * 100) + "%"; }
let curTiles = [];
function rowEl() { return $("board").children[row]; }
function startRow() {
  cur = cfg.first ? [known[0]] : [];
  [...$("board").children].forEach((r, i) => r.classList.toggle("active", i === row));
  curTiles = [...rowEl().children];
  paint(); startClock(cfg.time);
}
function paint() {
  curTiles.forEach((t, i) => {
    t.textContent = cur[i] || known[i];
    t.classList.toggle("filled", !!cur[i]);
    t.classList.toggle("hint", !cur[i] && !!known[i]);
  });
}
function msg(t) { $("msg").textContent = t; }
function shake() { const r = rowEl(); r.classList.add("shake"); setTimeout(() => r.classList.remove("shake"), 300); }

function press(k) {
  if (over || !answer) return;
  if (k === "⌫") { if (cur.length > (cfg.first ? 1 : 0)) cur.pop(); }
  else if (k === "↵") return submit();
  else if (cur.length < LEN && /^[A-ZÇĞIİÖŞÜ]$/.test(k)) cur.push(k);
  paint();
}
function submit() {
  const guess = cur.join("");
  const invalid = cur.length < LEN ? `${LEN} harf değil!` : !TDK.has(guess) ? `"${guess}" TDK'da yok!` : tried.has(guess) ? `"${guess}" zaten denendi!` : "";
  if (invalid) { shake(); return fail(invalid); }
  tried.add(guess);
  const res = evaluate(guess, answer);
  curTiles.forEach((t, i) => {
    t.classList.remove("hint", "filled");
    t.style.animationDelay = i * 80 + "ms";
    t.classList.add(res[i], "reveal");
    if (res[i] === "correct") known[i] = cur[i];
    const key = keyNodes.get(cur[i]), rank = {absent: 0, present: 1, correct: 2};
    if (!key) return;
    const prev = ["correct", "present", "absent"].find(c => key.classList.contains(c));
    if (cfg.kbHints && (!prev || rank[res[i]] > rank[prev])) { key.classList.remove("correct", "present", "absent"); key.classList.add(res[i]); }
  });
  if (guess === answer) return finish(true);
  next("");
}
// Invalid guess / timeout: the row is crossed out and counts as a used guess.
function fail(why) {
  if (!cfg.penalty) { msg(why + " Tekrar dene."); cur = cfg.first ? [known[0]] : []; paint(); return startClock(cfg.time); }
  curTiles.forEach(t => { t.classList.remove("hint", "filled"); t.classList.add("absent"); t.textContent ||= "✕"; });
  next(why + " Bir hak gitti.");
}
function next(text) {
  if (row + 1 >= wt) return finish(false, "Hakların bitti!");
  row++; msg(text); startRow();
}
function finish(won, why) {
  over = true; clearInterval(tick);
  const pts = cfg.points + cfg.bonus * (wt - 1 - row);
  if (won) teams[team].score += pts;
  drawTeams();
  setTimeout(() => {
    $("endTitle").textContent = won ? `${teams[team].name} bildi! 🎉` : why + " 😅";
    $("endWord").textContent = answer;
    $("endText").textContent = won ? `+${pts} puan` : "Bilemedi, puan yok.";
    $("next").textContent = wi + 1 < words.length ? "Sonraki Kelime" : "Sonuçları Gör";
    $("end").showModal();
  }, 600);
}
function gameOver() {
  over = true; answer = null; clearInterval(tick);
  const top = Math.max(...teams.map(t => t.score)), winners = teams.filter(t => t.score === top).map(t => t.name);
  drawTeams();
  $("endTitle").textContent = teams.length === 1 ? "Oyun bitti!" : winners.length > 1 ? "Berabere! 🤝" : `Kazanan: ${winners[0]} 🏆`;
  $("endWord").textContent = top;
  $("endText").textContent = teams.map(t => `${t.name}: ${t.score}`).join(" · ");
  $("next").textContent = soloMode ? "Ana Ekran" : "Yeni Yarışma";
  if (soloMode && SOLO[soloMode].ranked) {
    const rows = board10(), entry = {name: teams[0].name, score: teams[0].score, date: new Date().toLocaleDateString("tr")};
    rows.push(entry); rows.sort((a, b) => b.score - a.score); rows.splice(10);
    localStorage.setItem("lingoBoard", JSON.stringify(rows));
    const rank = rows.indexOf(entry);
    $("endText").textContent = rank >= 0 ? `Sıralamada ${rank + 1}. oldun! 🏆` : "İlk 10'a giremedin, tekrar dene!";
    fsSave(entry.name, entry.score).catch(() => {}); // offline: local board still has it
  }
  $("end").showModal();
}

// Host settings: words are mandatory and every one is checked against TDK. Saving does not start the game.
const num = (id, lo, hi) => Math.min(hi, Math.max(lo, parseInt($(id).value) || 0));
$("setupForm").addEventListener("submit", e => {
  const names = $("teamsIn").value.split("\n").map(s => s.trim()).filter(Boolean);
  const list = $("wordsIn").value.split(/[\n,]/).map(up).filter(Boolean);
  const bad = list.filter(w => !TDK.has(w) || len(w) < 4 || len(w) > 7);
  const err = !names.length ? "En az bir takım gir." : !list.length ? "En az bir kelime girmelisin." :
    bad.length ? `Geçersiz (TDK'da yok veya 4–7 harf değil): ${bad.join(", ")}` : "";
  if (err) { e.preventDefault(); $("setupMsg").textContent = err; return; }
  setupTeams = names; setupWords = list;
  cfg = {tries: num("cfgTries", 1, 10), time: num("cfgTime", 0, 120), points: num("cfgPoints", 0, 1000), bonus: num("cfgBonus", 0, 100),
    first: $("cfgFirst").checked, penalty: $("cfgPenalty").checked, shuffle: $("cfgShuffle").checked, kbHints: $("cfgKbHints").checked};
  localStorage.setItem("lingo", JSON.stringify({cfg, teams: names, words: list}));
  $("setupMsg").textContent = ""; $("homeMsg").textContent = ""; drawSummary();
});
function fillForm() {
  $("teamsIn").value = setupTeams.join("\n") || $("teamsIn").value; $("wordsIn").value = setupWords.join("\n");
  $("cfgTries").value = cfg.tries; $("cfgTime").value = cfg.time; $("cfgPoints").value = cfg.points; $("cfgBonus").value = cfg.bonus;
  $("cfgFirst").checked = cfg.first; $("cfgPenalty").checked = cfg.penalty; $("cfgShuffle").checked = cfg.shuffle; $("cfgKbHints").checked = cfg.kbHints;
}
function drawSummary() {
  $("summary").innerHTML = `<div><b>${setupTeams.length}</b>takım</div><div><b>${setupWords.length}</b>kelime</div><div><b>${cfg.time || "∞"}</b>${cfg.time ? "sn / tahmin" : "süresiz"}</div>`;
}
function showScreen(game) {
  $("home").hidden = game; $("game").hidden = !game;
  if (!game && hostCfg) { cfg = hostCfg; hostCfg = soloMode = null; }
}
function openSettings() { stopClock(); fillForm(); $("setup").showModal(); }
$("settingsBtn").addEventListener("click", openSettings);
$("startBtn").addEventListener("click", () => {
  if (!setupWords.length || !setupTeams.length) { $("homeMsg").textContent = "Önce Sunucu Ayarları'ndan takımları ve kelimeleri gir."; return openSettings(); }
  words = cfg.shuffle ? [...setupWords].sort(() => Math.random() - .5) : [...setupWords]; // ponytail: sort-shuffle is slightly biased; fine for a party game
  teams = setupTeams.map(name => ({name, score: 0}));
  wi = -1; showScreen(true); newWord();
});
// Solo: random TDK words; each mode carries its own rules, host settings are restored afterwards.
const SOLO = {
  kolay:  {name: "Kolay", lens: [4],    count: 10, cfg: {tries: 6, time: 0,  points: 10,  bonus: 5,  first: true,  penalty: false}},
  orta:   {name: "Orta",  lens: [5],    count: 10, cfg: {tries: 5, time: 20, points: 25,  bonus: 10, first: true,  penalty: true}},
  zor:    {name: "Zor",   lens: [6, 7], count: 10, cfg: {tries: 5, time: 10, points: 50,  bonus: 15, first: false, penalty: true}},
  sirali: {name: "Sıralamalı", lens: [5], count: 10, ranked: true, cfg: {tries: 5, time: 10, points: 100, bonus: 20, first: true, penalty: true}},
};
let hostCfg = null, soloMode = null;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const board10 = () => { try { return JSON.parse(localStorage.getItem("lingoBoard")) || []; } catch { return []; } };
// Global top-10 via Firestore REST. Name rules mirror firestore.rules — keep both in sync.
const FS = "https://firestore.googleapis.com/v1/projects/lingo-cinar-2026/databases/(default)/documents";
const nameOk = n => /^[A-Za-zÇĞİÖŞÜçğıöşü0-9 _.-]{2,16}$/.test(n)
  && !/(amk|sik|s1k|yarak|yarrak|orospu|oruspu|piç|pic|göt|got|ibne|kahpe|pezevenk|sikti|siktir|amına|amina|ananu|ananı|anani|fuck|shit|bitch|nigger|dick|pussy|porn|sex|seks|gerizekalı|salak|aptal)/.test(n.toLowerCase())
  && !/(^|[^a-zçğıöşü])(aq|mal)([^a-zçğıöşü]|$)/.test(n.toLowerCase());

let offlineQueue = [];
try { offlineQueue = JSON.parse(localStorage.getItem("lingoQueue")) || []; } catch {}
const saveQueue = () => localStorage.setItem("lingoQueue", JSON.stringify(offlineQueue));
async function fsSync() {
  if (!offlineQueue.length) return;
  const docs = [...offlineQueue];
  const writes = docs.map(d => ({
    update: {name: `projects/lingo-cinar-2026/databases/(default)/documents/scores/${d.id}`, fields: {name: {stringValue: d.name}, score: {integerValue: String(d.score)}}},
    updateTransforms: [{fieldPath: "createdAt", setToServerValue: "REQUEST_TIME"}], currentDocument: {exists: false}
  }));
  try {
    const r = await fetch(`${FS}:commit`, {method: "POST", body: JSON.stringify({writes})});
    if (r.ok) { offlineQueue = offlineQueue.filter(d => !docs.includes(d)); saveQueue(); }
  } catch {}
}
function fsSave(name, score) {
  offlineQueue.push({name, score, id: crypto.randomUUID()});
  saveQueue(); fsSync();
}
window.addEventListener("online", fsSync);
fsSync();

let fsCache = null;
let fsCacheTime = 0;
async function fsTop() {
  const now = Date.now();
  if (fsCache && now - fsCacheTime < 60000) return fsCache;
  const r = await fetch(`${FS}:runQuery`, {method: "POST", body: JSON.stringify({structuredQuery: {from: [{collectionId: "scores"}],
    orderBy: [{field: {fieldPath: "score"}, direction: "DESCENDING"}], limit: 10}})});
  if (!r.ok) throw r.status;
  fsCache = (await r.json()).filter(x => x.document).map(({document: {fields: f}}) =>
    ({name: f.name.stringValue, score: +f.score.integerValue, date: new Date(f.createdAt.timestampValue).toLocaleDateString("tr")}));
  fsCacheTime = now;
  return fsCache;
}
async function drawLeaderboard(mark) {
  drawRows(board10(), mark);
  try { drawRows(await fsTop()); } catch {} // offline: keep local board
}
function drawRows(rows, mark) {
  $("leaderboard").innerHTML = rows.length ? rows.map((r, i) =>
    `<li class="${i === mark ? "me" : ""}">${r.name.replace(/</g, "&lt;")} <small>${r.date}</small><b>${r.score}</b></li>`).join("")
    : "<li>Henüz skor yok — ilk sen ol!</li>";
}
$("modes").innerHTML = Object.entries(SOLO).map(([k, m]) => `<button class="btn mode ${k}" data-mode="${k}"><b>${m.name}</b>
  <span>${m.lens.join("–")} harf · ${m.cfg.tries} hak · ${m.cfg.time ? m.cfg.time + " sn" : "süresiz"}${m.cfg.first ? "" : " · ilk harf yok"}${m.ranked ? " · skor tabloya" : ""}</span></button>`).join("");
$("soloBtn").addEventListener("click", () => { $("soloName").value = localStorage.getItem("lingoName") || ""; drawLeaderboard(); $("solo").showModal(); });
$("soloClose").addEventListener("click", () => $("solo").close());
$("modes").addEventListener("click", e => {
  const k = e.target.closest("[data-mode]")?.dataset.mode; if (!k) return;
  const m = SOLO[k], name = $("soloName").value.trim();
  if (m.ranked && !nameOk(name)) { $("soloName").value = ""; $("soloName").focus(); $("soloName").placeholder = "2–16 harf, uygun bir ad gir!"; return; }
  if (name) localStorage.setItem("lingoName", name);
  const pool = [];
  m.lens.forEach(l => { if (WORDS_BY_LEN[l]) pool.push(...WORDS_BY_LEN[l]); });
  hostCfg ??= cfg; cfg = {...cfg, ...m.cfg, kbHints: true}; soloMode = k;
  words = Array.from({length: m.count}, () => pick(pool));
  teams = [{name: name || "Sen", score: 0}];
  $("solo").close(); wi = -1; showScreen(true); newWord();
});
$("homeBtn").addEventListener("click", () => {
  if (answer && !over && window.confirm && !window.confirm("Yarışma bitirilip ana ekrana dönülsün mü?")) return;
  stopClock(); answer = null; over = true; showScreen(false);
});
// Settings changes mid-game apply from the next guess; resume the clock after closing.
$("setup").addEventListener("close", () => { if (answer && !over && !tick && !$("ready").open && !$("game").hidden) startClock(cfg.time); });
$("ready").addEventListener("cancel", e => e.preventDefault());
$("go").addEventListener("click", () => { $("ready").close(); startClock(cfg.time); });
$("showWords").addEventListener("change", e => $("wordsIn").style.webkitTextSecurity = e.target.checked ? "none" : "disc");
$("openSetup").addEventListener("click", openSettings);
$("skip").addEventListener("click", () => { if (answer && !over) finish(false, "Sunucu kelimeyi geçti."); });

let keyNodes = new Map();
$("kb").innerHTML = ROWS.map(r => `<div>${[...r].map(k =>
  `<button class="btn key${"↵⌫".includes(k) ? " wide" : ""}" data-k="${k}" aria-label="${k === "↵" ? "Enter" : k === "⌫" ? "Sil" : k}">${k === "↵" ? "ENTER" : k}</button>`).join("")}</div>`).join("");
[...$("kb").querySelectorAll(".key")].forEach(k => keyNodes.set(k.dataset.k, k));
$("kb").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); });
document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]") || e.ctrlKey || e.metaKey) return;
  if (e.key === "Enter") press("↵"); else if (e.key === "Backspace") press("⌫"); else if (e.key.length === 1) press(up(e.key));
});
$("next").addEventListener("click", () => { $("end").close(); answer ? newWord() : showScreen(false); });

// Self-check: open with ?test to run assertions in the console.
if (location.search.includes("test")) {
  const eq = (a, b) => console.assert(a.join() === b.join(), a, b);
  eq(evaluate("KALEM", "KALEM"), ["correct","correct","correct","correct","correct"]);
  eq(evaluate("AAAAA", "KALEM"), ["absent","correct","absent","absent","absent"]);
  eq(evaluate("LEMKA", "KALEM"), ["present","present","present","present","present"]);
  eq(evaluate("KAKAO", "KALEM"), ["correct","correct","absent","absent","absent"]);
  console.assert(up("i") === "İ" && up("ı") === "I", "tr upper");
  console.assert(TDK.has("KALEM") && TDK.has("ÇİÇEK") && !TDK.has("XYZAB"), "TDK set");
  console.log("self-check done");
}
try { const saved = JSON.parse(localStorage.getItem("lingo")); if (saved) { cfg = {...cfg, ...saved.cfg}; setupTeams = saved.teams; setupWords = saved.words; } } catch {}
drawSummary();

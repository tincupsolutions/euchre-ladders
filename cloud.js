// Euchre Drill accounts (Michele, 2026-11-05). Loaded by drill.html as a module.
// Without a Firebase config (or offline) the drill keeps working from localStorage.
const CONFIG = {"apiKey": "AIzaSyBKoS1NrMD5GJZLNIvMw0WzabMxcrkLD3c", "authDomain": "euchre-drill.firebaseapp.com", "projectId": "euchre-drill", "storageBucket": "euchre-drill.firebasestorage.app", "messagingSenderId": "153025716379", "appId": "1:153025716379:web:81af9558c9a143cec8e63e"};
const V = "10.14.1";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const JOIN_KEY = "euchreDrill.join";

if (CONFIG && CONFIG.apiKey && window.drill) start().catch((e) => console.warn("cloud off:", e));

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(CONFIG);
  const auth = A.getAuth(app), db = F.getFirestore(app);
  const D = window.drill;

  // An invite link carries ?join=e-xxxx (expert) or ?join=p-xxxx (player).
  const q = new URLSearchParams(location.search);
  if (q.get("join")) { localStorage.setItem(JOIN_KEY, q.get("join")); history.replaceState(null, "", location.pathname); }
  const join = localStorage.getItem(JOIN_KEY);

  F.getDoc(F.doc(db, "stats", "counts")).then((s) => { window.cloudCounts = s.exists() ? s.data() : {}; }).catch(() => {});

  let me = null, saveT = null;
  const flagT = {};

  function acct() {
    const el = $("acct");
    if (!el) return;
    if (me) {
      el.innerHTML = `<a href="#" id="acctMe">${esc(me.username)}</a>`;
      $("acctMe").onclick = (e) => { e.preventDefault(); profile(); };
      $("saveNote").textContent = `Signed in as ${me.username}: your progress and flags are saved to your account.`;
    } else {
      el.innerHTML = `<a href="#" id="acctIn">Sign in</a>`;
      $("acctIn").onclick = (e) => { e.preventDefault(); modal(join ? "join" : "in"); };
      $("saveNote").textContent = "Your progress and flags are kept in this browser. Sign in to save them to your account.";
    }
  }

  function modal(tab, msg) {
    close();
    const d = document.createElement("div");
    d.id = "cmodal";
    d.innerHTML = `<div class="cm-back"></div><div class="cm-box" role="dialog" aria-modal="true">
      <button class="cm-x" aria-label="Close">×</button>
      <div class="cm-tabs"><button data-t="in" aria-pressed="${tab === "in"}">Sign in</button>${join ? `<button data-t="join" aria-pressed="${tab === "join"}">Create account</button>` : ""}</div>
      ${tab === "join" ? `
        <label>Username<input id="cmUser" autocomplete="username" maxlength="24"></label>
        <p class="cm-hint">Use your Discord name, so people know who you are.</p>
        <label>Email<input id="cmEmail" type="email" autocomplete="email"></label>
        <label>Password<input id="cmPass" type="password" autocomplete="new-password" minlength="6"></label>
        <label>Highest Euchre 3D rating (optional)<input id="cmRating" inputmode="numeric" maxlength="4"></label>
        <p class="cm-hint">Used to compare how players at different levels answer.</p>
        <button class="next" id="cmGo">Create account</button>` : tab === "setup" ? `
        <p>One more step: choose a username.</p>
        <label>Username<input id="cmUser" maxlength="24"></label>
        <p class="cm-hint">Use your Discord name, so people know who you are.</p>
        <label>Highest Euchre 3D rating (optional)<input id="cmRating" inputmode="numeric" maxlength="4"></label>
        <button class="next" id="cmGo">Save</button>` : `
        <label>Email<input id="cmEmail" type="email" autocomplete="email"></label>
        <label>Password<input id="cmPass" type="password" autocomplete="current-password"></label>
        <button class="next" id="cmGo">Sign in</button>
        <p><a href="#" id="cmForgot">Forgot your password?</a></p>
        ${join ? "" : `<p class="cm-hint">New here? You need an invite link to create an account.</p>`}`}
      <p class="cm-msg" id="cmMsg">${esc(msg || "")}</p></div>`;
    document.body.appendChild(d);
    d.querySelector(".cm-back").onclick = close;
    d.querySelector(".cm-x").onclick = close;
    d.querySelectorAll(".cm-tabs button").forEach((b) => (b.onclick = () => modal(b.dataset.t)));
    const go = $("cmGo");
    go.onclick = () => (tab === "join" ? doJoin() : tab === "setup" ? doSetup() : doIn());
    d.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); }));
    const f = $("cmForgot");
    if (f) f.onclick = async (e) => {
      e.preventDefault();
      const em = $("cmEmail").value.trim();
      if (!em) return say("Type your email above, then click Forgot your password? again.");
      try { await A.sendPasswordResetEmail(auth, em); say("Check your email for a link to reset your password. It may land in spam."); }
      catch (err) { say(nice(err)); }
    };
    const first = d.querySelector("input");
    if (first) first.focus();
  }
  function close() { const m = $("cmodal"); if (m) m.remove(); }
  function say(t) { const m = $("cmMsg"); if (m) m.textContent = t; }
  function nice(e) {
    const c = (e && e.code) || "";
    if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "That email and password don't match.";
    if (c.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead.";
    if (c.includes("weak-password")) return "Use a password of at least 6 characters.";
    if (c.includes("invalid-email")) return "That email address doesn't look right.";
    if (c.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
    if (c.includes("permission-denied")) return "That invite link isn't valid. Ask Michele for a new one.";
    return (e && e.message) || "Something went wrong.";
  }
  function readRating() {
    const r = ($("cmRating").value || "").replace(/\D/g, "");
    return r ? Math.min(4000, +r) : null;
  }
  function cleanName(n) { return n.trim().replace(/\s+/g, " "); }

  async function claim(uid, username, rating) {
    const lc = username.toLowerCase();
    const role = join && join.startsWith("e-") ? "expert" : "player";
    await F.runTransaction(db, async (t) => {
      const u = await t.get(F.doc(db, "usernames", lc));
      if (u.exists() && u.data().uid !== uid) throw { code: "taken" };
      t.set(F.doc(db, "usernames", lc), { uid });
      t.set(F.doc(db, "users", uid), {
        username, rating, role, invite: join, created: F.serverTimestamp(),
        progress: D.state, flags: D.flags,
      });
    });
  }


  async function doJoin() {
    const username = cleanName($("cmUser").value), email = $("cmEmail").value.trim(), pass = $("cmPass").value;
    if (username.length < 2) return say("Choose a username of at least 2 characters.");
    try {
      const u = await F.getDoc(F.doc(db, "usernames", username.toLowerCase()));
      if (u.exists()) return say("That username is taken. Try another.");
      say("Creating your account…");
      const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
      await claim(cred.user.uid, username, readRating());
      localStorage.removeItem(JOIN_KEY);
      await load(cred.user);
      close();
    } catch (e) { say(e.code === "taken" ? "That username is taken. Try another." : nice(e)); }
  }
  async function doSetup() {
    const username = cleanName($("cmUser").value);
    if (username.length < 2) return say("Choose a username of at least 2 characters.");
    if (!join) return say("You need an invite link to finish setting up. Ask Michele for one.");
    try { await claim(auth.currentUser.uid, username, readRating()); localStorage.removeItem(JOIN_KEY); await load(auth.currentUser); close(); }
    catch (e) { say(e.code === "taken" ? "That username is taken. Try another." : nice(e)); }
  }
  async function doIn() {
    try { say("Signing in…"); await A.signInWithEmailAndPassword(auth, $("cmEmail").value.trim(), $("cmPass").value); close(); }
    catch (e) { say(nice(e)); }
  }

  function profile() {
    close();
    const d = document.createElement("div");
    d.id = "cmodal";
    d.innerHTML = `<div class="cm-back"></div><div class="cm-box"><button class="cm-x" aria-label="Close">×</button>
      <p><b>${esc(me.username)}</b>${me.role === "expert" ? " · expert" : ""}</p>
      <label>Highest Euchre 3D rating (optional)<input id="cmRating" inputmode="numeric" maxlength="4" value="${esc(me.rating ?? "")}"></label>
      <button class="next" id="cmSave">Save</button> <button class="next" id="cmOut" style="background:var(--card);color:var(--felt)">Sign out</button>
      <p class="cm-msg" id="cmMsg"></p></div>`;
    document.body.appendChild(d);
    d.querySelector(".cm-back").onclick = close;
    d.querySelector(".cm-x").onclick = close;
    $("cmSave").onclick = async () => {
      me.rating = readRating();
      try { await F.updateDoc(F.doc(db, "users", me.uid), { rating: me.rating }); say("Saved."); } catch (e) { say(nice(e)); }
    };
    $("cmOut").onclick = async () => { await A.signOut(auth); close(); };
  }

  // Keep whichever record has seen a hand more often; union the badges.
  function merge(local, server) {
    if (!server) return local;
    const out = { ...server, ...local, box: { ...(server.box || {}) }, badges: { ...(server.badges || {}), ...(local.badges || {}) } };
    for (const [id, r] of Object.entries(local.box || {})) if (!out.box[id] || (r.seen || 0) > (out.box[id].seen || 0)) out.box[id] = r;
    out.n = Math.max(local.n || 0, server.n || 0);
    return out;
  }

  async function load(user) {
    const s = await F.getDoc(F.doc(db, "users", user.uid));
    if (!s.exists()) { modal("setup"); return; }
    const u = s.data();
    me = { uid: user.uid, username: u.username, role: u.role, rating: u.rating ?? null };
    window.cloudUser = me;
    D.state = merge(D.state, u.progress);
    D.flags = { ...(u.flags || {}), ...D.flags };
    acct();
    saveSoon();
  }

  function saveSoon() {
    if (!me) return;
    clearTimeout(saveT);
    saveT = setTimeout(() => F.updateDoc(F.doc(db, "users", me.uid), { progress: D.state, flags: D.flags }).catch((e) => console.warn(e)), 1500);
  }

  window.onAnswer = (item, picked, ok, kind) => {
    if (!me) return;
    F.addDoc(F.collection(db, "answers"), { uid: me.uid, qid: item.id, picked, ok, mode: kind, at: F.serverTimestamp() }).catch((e) => console.warn(e));
    F.setDoc(F.doc(db, "stats", "counts"), { [item.id]: F.increment(1) }, { merge: true }).catch(() => {});
    saveSoon();
  };
  window.onFlag = (qid, f) => {
    if (!me) return;
    clearTimeout(flagT[qid]);
    flagT[qid] = setTimeout(() => {
      const ref = F.doc(db, "flags", `${me.uid}_${qid}`);
      (f ? F.setDoc(ref, { uid: me.uid, username: me.username, qid, type: f.type, note: f.note || "", picked: f.picked || null, at: F.serverTimestamp() }) : F.deleteDoc(ref))
        .catch((e) => console.warn(e));
    }, 800);
    saveSoon();
  };
  window.onModeDone = (kind, score, n, extra) => {
    if (!me) return;
    F.addDoc(F.collection(db, "results"), { uid: me.uid, kind, score, n, ...extra, at: F.serverTimestamp() }).catch((e) => console.warn(e));
    saveSoon();
  };

  A.onAuthStateChanged(auth, async (user) => {
    if (user) { try { await load(user); } catch (e) { console.warn(e); } }
    else { me = null; window.cloudUser = null; acct(); if (join) modal("join"); }
  });
  acct();
}

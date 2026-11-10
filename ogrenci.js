/* Çalışıyor muyum? — öğrenci sayfası (telefon).
   Öğretmenin RÇ Öğrenci Durum programındaki "Öğrenci Takip" formunu öğrencinin doldurmasını sağlar.
   Ortak form kodu takip.js'tedir; bu dosya giriş, eşitleme ve takip.js'in kullandığı küçük yardımcıları sağlar. */
'use strict';
window.TK_OGR = true;
const RENKLER = [['#4b3fc4', '#8b5cf6'], ['#d0458f', '#f08a5d'], ['#1f8f8a', '#3cc0a0'], ['#2a6fc1', '#4fb0e8'], ['#e0861d', '#f2b84b'], ['#9b4bb5', '#d070c0'], ['#33313b', '#5d5a6e'], ['#c94a3f', '#e8846f']];
let db = { weeks: {}, students: {}, classes: {} };
const ui = {}, ACT = {}, PAGES = {};
let route = { page: 'takip', arg: null };
const now = () => Date.now();
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const trCmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'tr', { numeric: true, sensitivity: 'base' });
const get = (col, id) => { const r = (db[col] || {})[id]; return r && !r.deleted ? r : null; };
const live = col => Object.values(db[col] || {}).filter(r => r && !r.deleted);
function put(col, rec) { rec.updatedAt = now(); db[col][rec.id] = rec; Ogr.cache(); return rec; }
const settings = () => ({ school: (Ogr.info || {}).okul || '', teacher: (Ogr.info || {}).ogretmen || '' });
const classes = () => live('classes');
const studentsOf = () => live('students');
function initials(n) { return String(n || '?').split(' ').filter(Boolean).slice(0, 2).map(x => x.charAt(0).toLocaleUpperCase('tr')).join(''); }
function photoHTML(s) { return `<span class="ini">${esc(initials(s && s.name))}</span>`; }
function fval(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }
function ago(ts) { if (!ts) return 'henüz yok'; const d = (now() - ts) / 1000; if (d < 60) return 'az önce'; if (d < 3600) return Math.floor(d / 60) + ' dk önce'; if (d < 86400) return Math.floor(d / 3600) + ' saat önce'; return new Date(ts).toLocaleDateString('tr-TR'); }
function fetchTO(url, opt, ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, Object.assign({ signal: c.signal }, opt)).finally(() => clearTimeout(t)); }
function openModal(html) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; }
async function doPrint(html, title) { $('#print').innerHTML = html; const o = document.title; document.title = title; window.print(); setTimeout(() => { document.title = o; }, 1500); }
function render() {
  if (!Ogr.no) return Ogr.loginPage();
  $('#main').innerHTML = PAGES.takip(); if (PAGES.takip.after) PAGES.takip.after();
}
function go() { render(); window.scrollTo(0, 0); }
function softRender() { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $('#main').contains(a)) return; if (!$('#modal').hidden) return; render(); }

const Ogr = {
  AUTH: 'https://identitytoolkit.googleapis.com/v1/', TOKEN: 'https://securetoken.googleapis.com/v1/token',
  cfg: null, sess: null, no: '', info: null, token: null, tokenExp: 0, known: {}, es: [], pushT: null, busy: false, again: false, st: '', tab: 'giris',
  boot() {
    try { const t = JSON.parse(localStorage.getItem('rct_test') || 'null'); if (t) { this.AUTH = t.auth; this.TOKEN = t.token; } } catch (e) { }
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('k') && h.get('d')) { this.cfg = { k: h.get('k'), d: h.get('d').replace(/\/+$/, '') }; localStorage.setItem('rct_cfg', JSON.stringify(this.cfg)); history.replaceState(null, '', location.pathname + location.search); }
    else { try { this.cfg = JSON.parse(localStorage.getItem('rct_cfg') || 'null'); } catch (e) { } }
    try { this.sess = JSON.parse(localStorage.getItem('rct_sess') || 'null'); } catch (e) { }
    $('#oMenu').onclick = () => this.menu();
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (a && !a.disabled) { e.preventDefault(); const fn = ACT[a.dataset.act]; if (fn) fn(a); }
    });
    $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
    window.tkSaved = () => this.schedule();
    window.addEventListener('online', () => { if (this.no) { this.flush(); this.listen(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.no) { this.pull().catch(() => { }); } });
    if (!this.cfg) { $('#main').innerHTML = `<div class="card login"><h1>Bağlantı eksik</h1><p>Bu sayfayı öğretmeninizin verdiği <b>QR kod</b> ya da <b>bağlantı</b> ile açın.</p></div>`; return; }
    if (this.sess && this.sess.rt) this.start(); else this.loginPage();
  },
  /* ---------- Firebase ---------- */
  errText(j, fb) {
    const m = (j && j.error && (j.error.message || j.error)) || fb || 'bilinmeyen hata';
    const T = { EMAIL_EXISTS: 'EXISTS', INVALID_PASSWORD: 'Okul numarası ya da şifre yanlış.', INVALID_LOGIN_CREDENTIALS: 'Okul numarası ya da şifre yanlış.', EMAIL_NOT_FOUND: 'Okul numarası ya da şifre yanlış.',
      WEAK_PASSWORD: 'Şifre en az 6 karakter olmalı.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Çok fazla deneme yapıldı; biraz sonra tekrar deneyin.', 'Permission denied': 'İzin yok' };
    const key = String(m).split(' ')[0].replace(/:$/, '');
    return T[m] || T[key] || String(m);
  },
  async post(url, body, form) {
    let r; try { r = await fetchTO(url, { method: 'POST', headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? body : JSON.stringify(body) }, 15000); }
    catch (e) { throw new Error('İnternete bağlanılamadı.'); }
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) throw new Error(this.errText(j, 'Sunucu yanıtı ' + r.status));
    return j;
  },
  email(no, v) { return 'o' + String(no).replace(/\D/g, '') + 'v' + v + '@rcdurum.app'; },
  db(p) { return this.cfg.d + '/rd/' + p + '.json'; },
  async getV(no) {
    let r; try { r = await fetchTO(this.db('v/' + no), {}, 15000); } catch (e) { throw new Error('İnternete bağlanılamadı.'); }
    const v = r.ok ? await r.json() : null;
    if (!v) throw new Error('Bu okul numarası için öğrenci girişi açık değil. Numaranızı kontrol edin ya da öğretmeninize danışın.');
    return v;
  },
  setTok(j) { this.token = j.idToken || j.id_token; this.tokenExp = now() + (+(j.expiresIn || j.expires_in) || 3600) * 1000; },
  async auth(force) {
    if (!force && this.token && now() < this.tokenExp - 120000) return this.token;
    const j = await this.post(this.TOKEN + '?key=' + encodeURIComponent(this.cfg.k), 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(this.sess.rt), true);
    this.setTok(j); this.sess.rt = j.refresh_token || this.sess.rt; this.saveSess(); return this.token;
  },
  saveSess() { if (this.sess) localStorage.setItem('rct_sess', JSON.stringify(this.sess)); else localStorage.removeItem('rct_sess'); },
  async req(p, method, body) {
    const t = await this.auth();
    let r; try { r = await fetchTO(this.db(p) + '?auth=' + encodeURIComponent(t), method ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}, 20000); }
    catch (e) { throw new Error('İnternete bağlanılamadı.'); }
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) { const er = new Error(this.errText(j, 'Hata ' + r.status)); er.status = r.status; throw er; }
    return j;
  },
  /* ---------- giriş ---------- */
  loginPage(msg) {
    $('#oMenu').hidden = true; $('#oSub').textContent = ''; $('#oSync').textContent = '';
    const ilk = this.tab === 'ilk';
    $('#main').innerHTML = `<div class="card login"><h1>${ilk ? 'İlk giriş' : 'Giriş'}</h1><p class="muted" style="margin:0">Haftalık çalışma planını ve soru takibini buradan doldur; öğretmenin anında görür.</p>
      <div class="tabs"><button class="${ilk ? '' : 'on'}" data-act="oTab" data-id="giris">Giriş</button><button class="${ilk ? 'on' : ''}" data-act="oTab" data-id="ilk">İlk kez giriyorum</button></div>
      ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
      <label class="f"><span>Okul numaran</span><input type="text" id="lNo" inputmode="numeric" autocomplete="username" value="${esc((this.sess || {}).no || '')}"></label>
      ${ilk ? `<label class="f"><span>Sınıf kodu (öğretmeninden)</span><input type="text" id="lKod" inputmode="numeric" autocomplete="off"></label>
        <label class="f"><span>Kendine bir şifre belirle (en az 6 karakter)</span><input type="password" id="lP1" autocomplete="new-password"></label>
        <label class="f"><span>Şifre tekrar</span><input type="password" id="lP2" autocomplete="new-password"></label>
        <button class="btn grad" id="lGo">Hesabımı oluştur</button><p class="hint">Şifreni unutursan öğretmenin sıfırlar; sınıf koduyla yeniden ilk girişi yaparsın, girdiğin bilgiler kaybolmaz.</p>`
      : `<label class="f"><span>Şifren</span><input type="password" id="lP1" autocomplete="current-password"></label><button class="btn grad" id="lGo">Giriş yap</button>
        <p class="hint">İlk kez mi giriyorsun? Üstten <b>“İlk kez giriyorum”</b>u seç.</p>`}</div>`;
    const go_ = async () => {
      const b = $('#lGo'); b.disabled = true; b.textContent = 'Bekleyin…';
      try { if (ilk) await this.register(fval('lNo'), fval('lKod'), $('#lP1').value, $('#lP2').value); else await this.login(fval('lNo'), $('#lP1').value); }
      catch (e) { this.loginPage(e.message); return; }
    };
    $('#lGo').onclick = go_; $$('.login input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go_(); });
  },
  async signIn(no, v, pass) { return this.post(this.AUTH + 'accounts:signInWithPassword?key=' + encodeURIComponent(this.cfg.k), { email: this.email(no, v), password: pass, returnSecureToken: true }); },
  async claimed(no, uid) { try { const c = await this.req('c/' + no); return c && c.uid === uid; } catch (e) { if (e.status === 401 || e.status === 403) return false; throw e; } },
  async login(no, pass) {
    no = no.replace(/\D/g, ''); if (!no || !pass) throw new Error('Okul numaranı ve şifreni yaz.');
    const v = await this.getV(no); const j = await this.signIn(no, v, pass);
    this.sess = { no, rt: j.refreshToken, uid: j.localId }; this.setTok(j);
    if (!(await this.claimed(no, j.localId))) { this.sess = null; this.tab = 'ilk'; throw new Error('Hesabın henüz onaylanmamış. “İlk kez giriyorum” ile sınıf kodunu gir.'); }
    this.saveSess(); await this.start();
  },
  async register(no, kod, p1, p2) {
    no = no.replace(/\D/g, ''); kod = kod.replace(/\s/g, '');
    if (!no || !kod) throw new Error('Okul numaranı ve sınıf kodunu yaz.');
    if (p1.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
    if (p1 !== p2) throw new Error('İki şifre aynı değil.');
    const v = await this.getV(no); let j;
    try { j = await this.post(this.AUTH + 'accounts:signUp?key=' + encodeURIComponent(this.cfg.k), { email: this.email(no, v), password: p1, returnSecureToken: true }); }
    catch (e) {
      if (e.message !== 'EXISTS') throw e;
      try { j = await this.signIn(no, v, p1); } catch (e2) { throw new Error('Bu numara için hesap zaten açılmış. Şifreni hatırlamıyorsan öğretmenine “şifremi sıfırla” de.'); }
    }
    this.sess = { no, rt: j.refreshToken, uid: j.localId }; this.setTok(j);
    if (!(await this.claimed(no, j.localId))) {
      try { await this.req('c/' + no, 'PUT', { uid: j.localId, kod, at: { '.sv': 'timestamp' } }); }
      catch (e) { this.sess = null; if (e.status === 401 || e.status === 403) throw new Error('Sınıf kodu yanlış ya da bu numara başka biri tarafından alınmış. Öğretmenine danış.'); throw e; }
    }
    this.saveSess(); toast('Hesabın hazır ✓'); await this.start();
  },
  /* ---------- veri ---------- */
  cacheKey() { return 'rct_db_' + this.no; },
  cache() { try { localStorage.setItem(this.cacheKey(), JSON.stringify({ weeks: db.weeks, info: this.info, known: this.known })); } catch (e) { } },
  setMe() {
    const i = this.info || {};
    db.students = { me: { id: 'me', no: this.no, name: i.ad || ('No ' + this.no), cid: 'c' } };
    db.classes = { c: { id: 'c', name: i.sinif || '' } };
    $('#oSub').textContent = (i.ad || '') + (i.sinif ? ' · ' + i.sinif : '') + ' · No ' + this.no;
  },
  async start() {
    this.no = this.sess.no; ui.tk.sid = 'me'; ui.tk.cid = 'c'; if (!ui.tk.wk) ui.tk.wk = tkMonday(new Date());
    try { const c = JSON.parse(localStorage.getItem(this.cacheKey()) || 'null'); if (c) { db.weeks = c.weeks || {}; this.info = c.info; this.known = c.known || {}; } } catch (e) { }
    this.setMe(); $('#oMenu').hidden = false; render();
    try { await this.auth(); await this.pull(); this.listen(); }
    catch (e) {
      if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED/.test(e.message)) { this.logout('Oturumun sona erdi; yeniden giriş yap.'); return; }
      this.setSync('çevrimdışı'); setTimeout(() => this.no && this.start(), 20000);
    }
  },
  async pull() {
    const c = await this.req('c/' + this.no).catch(e => e);
    if (c instanceof Error && !(c.status === 401 || c.status === 403)) throw c;
    if (c instanceof Error || !c || c.uid !== this.sess.uid) { this.logout('Öğretmenin şifreni sıfırlamış ya da girişi kapatmış. “İlk kez giriyorum” ile yeniden kayıt ol.', 'ilk'); return; }
    const [i, t, o] = await Promise.all([this.req('i/' + this.no).catch(e => e), this.req('t/' + this.no), this.req('o/' + this.no).catch(() => null)]);
    if (i && !(i instanceof Error)) { this.info = i; this.setMe(); }
    let inc = false;
    Object.entries(t || {}).forEach(([wk, x]) => { inc = this.inT(wk, x) || inc; });
    Object.entries(o || {}).forEach(([wk, x]) => { inc = this.inO(wk, x) || inc; });
    this.cache(); if (inc) softRender(); await this.flush(); this.setSync('✓ kaydedildi');
  },
  inT(wk, x) {
    if (!x || typeof x.j !== 'string') return false;
    const u = +x.u || 0; this.known['t' + wk] = Math.max(this.known['t' + wk] || 0, u);
    const id = 'me|' + wk, loc = db.weeks[id];
    let p; try { p = JSON.parse(x.j); } catch (e) { return false; }
    if (!loc) { db.weeks[id] = Object.assign({}, p, { id, sid: 'me', wk, ua: u, ogr: {}, updatedAt: u }); return true; }
    const m = tkMerge(loc, p); if (!m.changed && !m.localNewer) return false;
    db.weeks[id] = Object.assign(m.rec, { id, sid: 'me', wk, ogr: loc.ogr || {}, ua: m.localNewer ? now() : Math.max(loc.ua || 0, u), updatedAt: now() });
    if (m.localNewer) setTimeout(() => this.schedule(), 0);
    return m.changed;
  },
  inO(wk, x) {
    if (!x || typeof x.j !== 'string') return false;
    const id = 'me|' + wk, loc = db.weeks[id]; let p; try { p = JSON.parse(x.j); } catch (e) { return false; }
    if (loc && JSON.stringify(loc.ogr || {}) === JSON.stringify(p)) return false;
    db.weeks[id] = Object.assign({}, loc || { id, sid: 'me', wk, goals: [{}, {}, {}], plan: {}, soru: {}, hd: {}, den: [], eks: [], oz: {}, odak: [] }, { ogr: p }); return true;
  },
  listen() {
    this.es.forEach(e => { try { e.close(); } catch (x) { } }); this.es = [];
    ['t', 'o'].forEach(k => {
      const es = new EventSource(this.db(k + '/' + this.no) + '?auth=' + encodeURIComponent(this.token)); this.es.push(es);
      const handle = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (!m) return;
        const parts = String(m.path || '/').split('/').filter(Boolean); let inc = false;
        const f = (wk, x) => k === 't' ? this.inT(wk, x) : this.inO(wk, x);
        if (!parts.length) Object.entries(m.data || {}).forEach(([wk, x]) => { inc = f(wk, x) || inc; });
        else if (parts.length === 1) { if (ev.type === 'patch') { const cur = {}; Object.assign(cur, m.data); inc = f(parts[0], Object.assign({}, cur)); } else inc = f(parts[0], m.data); }
        if (inc) { this.cache(); softRender(); }
      };
      es.addEventListener('put', handle); es.addEventListener('patch', handle);
      es.addEventListener('auth_revoked', () => this.auth(true).then(() => this.listen()).catch(() => { }));
      es.addEventListener('cancel', () => { this.pull().catch(() => { }); });
      es.onerror = () => { if (es.readyState === 2) setTimeout(() => this.no && this.auth(true).then(() => this.listen()).catch(() => { }), 5000); };
    });
  },
  schedule() { this.setSync('kaydediliyor…'); clearTimeout(this.pushT); this.pushT = setTimeout(() => this.flush().catch(() => { this.setSync(navigator.onLine === false ? 'çevrimdışı — internet gelince gönderilecek' : 'gönderilemedi, tekrar denenecek'); this.pushT = setTimeout(() => this.schedule(), 10000); }), 600); },
  strip(w) { const o = Object.assign({}, w); ['id', 'sid', 'ogr', 'ua', 'ub', 'updatedAt', 'deleted'].forEach(k => delete o[k]); return o; },
  async flush() {
    if (!this.no) return; if (this.busy) { this.again = true; return; }
    const up = {};
    live('weeks').forEach(w => { const ua = w.ua || 0; if (ua > (this.known['t' + w.wk] || 0)) up[w.wk] = { u: ua, j: JSON.stringify(this.strip(w)) }; });
    if (!Object.keys(up).length) { this.setSync('✓ kaydedildi'); return; }
    this.busy = true;
    try { await this.req('t/' + this.no, 'PATCH', up); Object.entries(up).forEach(([wk, x]) => { this.known['t' + wk] = Math.max(this.known['t' + wk] || 0, x.u); }); this.cache(); this.setSync('✓ kaydedildi'); }
    finally { this.busy = false; if (this.again) { this.again = false; this.schedule(); } }
  },
  setSync(t) { this.st = t; $('#oSync').textContent = t; },
  /* ---------- menü ---------- */
  menu() {
    openModal(`<h2>${esc((this.info || {}).ad || '')}</h2><p class="muted" style="margin-top:0">${esc((this.info || {}).sinif || '')} · No ${esc(this.no)}${(this.info || {}).ogretmen ? ' · Öğretmen: ' + esc(this.info.ogretmen) : ''}</p>
      <div class="omenu"><button class="btn ghost" id="mPass">🔑 Şifremi değiştir</button><button class="btn ghost" id="mSync">⟳ Şimdi eşitle</button><button class="btn danger" id="mOut">Çıkış yap</button></div>
      <div class="actions"><button class="btn" id="mClose">Kapat</button></div>`);
    $('#mClose').onclick = closeModal;
    $('#mSync').onclick = () => { closeModal(); this.pull().then(() => toast('Eşitlendi ✓')).catch(e => toast(e.message)); };
    $('#mOut').onclick = () => { closeModal(); this.logout(); };
    $('#mPass').onclick = () => {
      openModal(`<h2>Şifremi değiştir</h2><label class="f"><span>Yeni şifre (en az 6 karakter)</span><input type="password" id="np1"></label><label class="f"><span>Tekrar</span><input type="password" id="np2"></label>
        <div class="actions"><button class="btn ghost" id="npC">Vazgeç</button><button class="btn" id="npS">Kaydet</button></div>`);
      $('#npC').onclick = closeModal;
      $('#npS').onclick = async () => {
        const a = $('#np1').value, b = $('#np2').value; if (a.length < 6) return toast('En az 6 karakter'); if (a !== b) return toast('Şifreler aynı değil');
        try { const j = await this.post(this.AUTH + 'accounts:update?key=' + encodeURIComponent(this.cfg.k), { idToken: await this.auth(true), password: a, returnSecureToken: true }); this.setTok(j); this.sess.rt = j.refreshToken || this.sess.rt; this.saveSess(); closeModal(); toast('Şifren değişti ✓'); }
        catch (e) { toast(/CREDENTIAL_TOO_OLD|TOO_OLD/.test(e.message) ? 'Güvenlik için çıkış yapıp yeniden gir, sonra tekrar dene.' : e.message); }
      };
    };
  },
  logout(msg, tab) {
    this.tab = tab || 'giris';
    this.es.forEach(e => { try { e.close(); } catch (x) { } }); this.es = [];
    const no = this.no; this.no = ''; try { if (no) localStorage.removeItem('rct_db_' + no); } catch (e) { } this.token = null; this.sess = no ? { no } : null; if (this.sess) this.sess.rt = ''; this.saveSess();
    db.weeks = {}; this.info = null; this.known = {}; this.loginPage(msg);
  },
};
ACT.oTab = el => { Ogr.tab = el.dataset.id; Ogr.loginPage(); };

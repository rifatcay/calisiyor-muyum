/* RÇ Öğrenci Durum — Öğrenci Takip (Haftalık Çalışma Takip Formu'nun programdaki hâli)
   Kayıt: weeks koleksiyonu, kimlik "öğrenciId|haftanınPazartesi" (YYYY-AA-GG).
   Hafta kaydı: { sid, wk, exam, no, hSaat, hSoru, goals[3]{t,ok}, plan{gün:[{ders,konu,kay,p,r,h,st}]},
                  soru{gün:[{ders,konu,kay,q,d,y,b,t}]}, hd{ders:hedefSoru}, den[{ad,tar,s{sütun:net},puan,sira}],
                  eks[{ders,konu,ne,yap,tar,y1,y2}], oz{anahtar:1-5, iyi, deg}, ogr{g, not}, odak[4] } */
'use strict';
const TK_GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TK_DERS = ['Matematik', 'Geometri', 'Türkçe', 'Edebiyat', 'Fizik', 'Kimya', 'Biyoloji', 'Fen Bilimleri', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü', 'İnkılap Tarihi', 'İngilizce', 'Sosyal Bilgiler'];
const TK_SINAV = {
  'TYT': { nd: 4, cols: ['Türkçe', 'Matematik', 'Fen', 'Sosyal'] },
  'AYT': { nd: 4, cols: ['Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Edebiyat', 'Tarih', 'Coğrafya'] },
  'YKS (TYT + AYT)': { nd: 4, cols: ['Türkçe', 'Matematik', 'Fen', 'Sosyal', 'AYT'] },
  'LGS': { nd: 3, cols: ['Türkçe', 'Matematik', 'Fen', 'İnkılap', 'Din', 'İngilizce'] },
  'Okul sınavları': { nd: 4, cols: ['Türkçe', 'Matematik', 'Fen', 'Sosyal', 'Diğer'] },
};
const TK_OZ = [['plan', 'Plana uydum'], ['odak', 'Odaklandım (telefon uzaktaydı)'], ['anla', 'Konuları anlayarak çalıştım'], ['yanlis', 'Yanlışlarımı inceledim'], ['uyku', 'Uyku ve dinlenme düzenim'], ['moti', 'Motivasyonum']];
const TK_GENEL = ['Çok iyi', 'İyi', 'Orta', 'Geliştirilmeli'];
const TK_NEDEN = { B: 'Bilgi eksiği', 'İ': 'İşlem hatası', D: 'Dikkat', S: 'Süre' };
const TK_ST = { ok: '✓', half: '½', no: '✗' };
ui.tk = { cid: '', sid: '', wk: '', tab: 'plan' };

/* ---------- tarih ve hafta ---------- */
function tkIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function tkMonday(d) { d = new Date(d); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return tkIso(d); }
function tkDay(wk, n) { const d = new Date(wk + 'T12:00:00'); d.setDate(d.getDate() + n); return d; }
function tkShift(wk, n) { return tkIso(tkDay(wk, 7 * n)); }
const tkDM = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
function tkRange(wk) {
  const a = tkDay(wk, 0), b = tkDay(wk, 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${AYLAR_T[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${AYLAR_T[a.getMonth()]} – ${b.getDate()} ${AYLAR_T[b.getMonth()]} ${b.getFullYear()}`;
}
const AYLAR_T = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/* ---------- kayıt ---------- */
const tkId = (sid, wk) => sid + '|' + wk;
const tkPrev = (sid, wk) => live('weeks').filter(w => w.sid === sid && w.wk < wk).sort((a, b) => a.wk < b.wk ? 1 : -1)[0];
function tkNew(sid, wk) {
  const p = tkPrev(sid, wk);
  return {
    id: tkId(sid, wk), sid, wk, exam: p ? p.exam : 'TYT', no: p && p.no ? String((+p.no || 0) + 1) : '', hSaat: p ? p.hSaat || '' : '', hSoru: p ? p.hSoru || '' : '',
    goals: [{}, {}, {}], plan: {}, soru: {}, hd: p ? Object.assign({}, p.hd) : {}, den: [], eks: [], oz: {}, ogr: {}, odak: ['', '', '', ''], ts: {}, tsb: 0,
  };
}
const tkGet = (sid, wk) => get('weeks', tkId(sid, wk)) || tkNew(sid, wk);
function tkCur() { return tkGet(ui.tk.sid, ui.tk.wk); }
function tkEdit(fn) {
  const before = tkCur(), w = JSON.parse(JSON.stringify(before)); const o0 = JSON.stringify(w.ogr || {}); fn(w);
  if (JSON.stringify(w.ogr || {}) !== o0) w.ub = now();
  if (tkStamp(before, w)) w.ua = now();
  put('weeks', w); if (window.tkSaved) window.tkSaved(w); return w;
}
/* Bölüm bölüm birleştirme: öğretmen ve öğrenci aynı haftayı ayrı cihazlarda değiştirse de ikisinin değişikliği korunur.
   Her bölümün (hedefler, plan günü, soru günü, denemeler…) son değişme zamanı w.ts'te tutulur; yeni olan kazanır. */
const TK_META = ['id', 'sid', 'wk', 'ogr', 'ua', 'ub', 'updatedAt', 'deleted', 'ts', 'tsb'];
function tkKeys(w) {
  const ks = new Set(); Object.keys(w || {}).forEach(k => {
    if (TK_META.includes(k)) return;
    if (k === 'plan' || k === 'soru') Object.keys(w[k] || {}).forEach(g => ks.add(k + '.' + g)); else ks.add(k);
  }); return ks;
}
function tkGetK(w, k) { const [a, b] = k.split('.'); return b == null ? w[a] : (w[a] || {})[b]; }
function tkSetK(w, k, v) { const [a, b] = k.split('.'); if (b == null) { if (v === undefined) delete w[a]; else w[a] = v; } else { w[a] = Array.isArray(w[a]) ? Object.assign({}, w[a]) : Object.assign({}, w[a]); if (v === undefined) delete w[a][b]; else w[a][b] = v; } }
function tkEff(w, k) { if (w.ts && w.ts[k]) return w.ts[k]; if (w.ts) return w.tsb || 0; return w.ua || w.updatedAt || 0; }
function tkStamp(before, after) {
  const t = now(); if (!after.ts) { after.ts = {}; after.tsb = before.ua || before.updatedAt || 0; } else after.ts = Object.assign({}, after.ts);
  let ch = false; new Set([...tkKeys(before), ...tkKeys(after)]).forEach(k => { if (JSON.stringify(tkGetK(before, k)) !== JSON.stringify(tkGetK(after, k))) { after.ts[k] = t; ch = true; } });
  return ch;
}
function tkMerge(loc, inc) {
  const out = JSON.parse(JSON.stringify(loc)); if (!loc.ts) { out.ts = {}; out.tsb = loc.ua || loc.updatedAt || 0; }
  let localNewer = false, changed = false;
  new Set([...tkKeys(loc), ...tkKeys(inc)]).forEach(k => {
    const a = tkEff(loc, k), b = tkEff(inc, k), same = JSON.stringify(tkGetK(loc, k)) === JSON.stringify(tkGetK(inc, k));
    if (b > a) { if (!same) { const v = tkGetK(inc, k); tkSetK(out, k, v === undefined ? undefined : JSON.parse(JSON.stringify(v))); changed = true; } out.ts[k] = b; }
    else if (a > b && !same) localNewer = true;
  });
  return { rec: out, localNewer, changed };
}
/* Sunucu tarafı kilit (öğretmen programında): öğrenci bir günü, o günden en fazla TK_GERI gün sonrasına kadar değiştirebilir.
   Daha geç (Firebase sunucu saatiyle) yazılmış değişiklikler geri alınır. Haftaya ait genel bölümler (hedefler, denemeler…) pazara göre. */
function tkDeadline(wk, g) { const d = tkDay(wk, g == null ? 6 : g); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + TK_GERI + 1); return d.getTime(); }
function tkEnforce(loc, out, st) {
  let rev = false; const t = Math.max(now(), st + 1); const wk = out.wk || loc.wk;
  new Set([...tkKeys(loc), ...tkKeys(out)]).forEach(k => {
    const lv = tkGetK(loc, k), ov = tkGetK(out, k);
    if (JSON.stringify(lv) === JSON.stringify(ov)) return;
    if (k === 'kutu') {
      const a = Object.assign({}, lv || {}), b = Object.assign({}, ov || {}); let ch = false;
      for (let g = 0; g < 7; g++) if (String(a[g] ?? '') !== String(b[g] ?? '') && st > tkDeadline(wk, g)) { if (a[g] == null) delete b[g]; else b[g] = a[g]; ch = true; }
      if (ch) { out.kutu = b; out.ts[k] = t; rev = true; } return;
    }
    const m = k.match(/^(plan|soru)\.(\d)$/);
    if (st > tkDeadline(wk, m ? +m[2] : null)) { tkSetK(out, k, lv === undefined ? undefined : JSON.parse(JSON.stringify(lv))); out.ts[k] = t; rev = true; }
  });
  return rev;
}
const TK_OGR = !!window.TK_OGR; // öğrencinin telefonundaki sayfa
function tkSet(o, path, v) {
  const ps = path.split('.'); let x = o;
  for (let i = 0; i < ps.length - 1; i++) { const k = ps[i]; if (x[k] == null || typeof x[k] !== 'object') x[k] = /^\d+$/.test(ps[i + 1]) ? [] : {}; x = x[k]; }
  x[ps[ps.length - 1]] = v;
}
const tkVal = (o, path) => path.split('.').reduce((x, k) => x == null ? undefined : x[k], o);
const n0 = x => { const v = parseFloat(String(x == null ? '' : x).replace(',', '.')); return isFinite(v) ? v : 0; };
const fmt1 = x => (Math.round(x * 100) / 100).toLocaleString('tr-TR');
const filledRow = r => r && Object.keys(r).some(k => r[k] !== '' && r[k] != null);
const tkRows = (w, part, g) => (w[part] && w[part][g]) || [];
const tkNd = w => (TK_SINAV[w.exam] || TK_SINAV.TYT).nd;
function tkNet(r, nd) { if (r.d === '' && r.y === '' || r.d == null && r.y == null) return null; return n0(r.d) - n0(r.y) / nd; }
const tkQ = r => r.q !== '' && r.q != null ? n0(r.q) : n0(r.d) + n0(r.y) + n0(r.b);

/* Haftanın tüm hesapları: günlük ve haftalık toplamlar, ders bazında sonuçlar. */
function tkDersList(w) {
  const set = new Set(Object.keys(w.hd || {}).filter(k => k && w.hd[k] !== ''));
  for (let g = 0; g < 7; g++) { tkRows(w, 'soru', g).forEach(r => r && r.ders && set.add(r.ders.trim())); tkRows(w, 'plan', g).forEach(r => r && r.ders && set.add(r.ders.trim())); }
  return Array.from(set).filter(Boolean).sort((a, b) => trCmp(a, b));
}
function tkCalc(w) {
  const c = {}, nd = tkNd(w), ders = {};
  let P = 0, G = 0, H = 0, Q = 0, D = 0, Y = 0, B = 0, T = 0; c.dayMin = [];
  for (let g = 0; g < 7; g++) {
    let p = 0, r = 0, h = 0;
    tkRows(w, 'plan', g).forEach(x => { if (!x) return; p += n0(x.p); r += n0(x.r); h += n0(x.h); });
    let q = 0, d = 0, y = 0, b = 0, t = 0;
    tkRows(w, 'soru', g).forEach((x, i) => {
      if (!x) return; const net = tkNet(x, nd); c[`sn${g}_${i}`] = net == null ? '' : fmt1(net);
      const qq = tkQ(x); q += qq; d += n0(x.d); y += n0(x.y); b += n0(x.b); t += n0(x.t);
      const k = (x.ders || '').trim(); if (k) { const o = ders[k] || (ders[k] = { q: 0, d: 0, y: 0, b: 0, t: 0 }); o.q += qq; o.d += n0(x.d); o.y += n0(x.y); o.b += n0(x.b); o.t += n0(x.t); }
    });
    Object.assign(c, { ['pp' + g]: p || '', ['pr' + g]: r || '', ['sq' + g]: q || '', ['sd' + g]: d || '', ['sy' + g]: y || '', ['sb' + g]: b || '', ['st' + g]: t || '', ['snt' + g]: d || y ? fmt1(d - y / nd) : '' });
    const kt = n0((w.kutu || {})[g]); c['kt' + g] = kt; c.dayMin[g] = kt ? kt * 30 : (r || t); P += p; G += r; H += h; Q += q; D += d; Y += y; B += b; T += t;
  }
  Object.assign(c, { P, G, H, Q, D, Y, B, T, NET: D - Y / nd, uyum: P ? Math.round(G / P * 100) : null });
  c.PP = P || ''; c.GG = G || ''; c.UY = c.uyum == null ? '' : '%' + c.uyum; c.QQ = Q || ''; c.DD = D || ''; c.YY = Y || ''; c.BB = B || ''; c.TT = T || ''; c.NN = D || Y ? fmt1(c.NET) : '';
  c.ders = tkDersList(w).map(k => {
    const o = ders[k] || { q: 0, d: 0, y: 0, b: 0, t: 0 }; const hd = n0((w.hd || {})[k]);
    return { k, hd, q: o.q, d: o.d, y: o.y, b: o.b, net: o.d - o.y / nd, bas: o.q ? Math.round(o.d / o.q * 100) : null, saat: o.t / 60, ul: hd ? o.q >= hd : null };
  });
  c.ders.forEach((x, i) => { c['ul' + i] = x.ul == null ? '–' : x.ul ? 'Evet' : 'Hayır'; });
  (w.den || []).forEach((x, i) => { if (!x) return; const s = Object.values(x.s || {}).reduce((a, v) => a + n0(v), 0); c['dn' + i] = s ? fmt1(s) : ''; });
  c.goalsOk = (w.goals || []).filter(x => x && x.ok).length;
  c.goalsN = (w.goals || []).filter(x => x && x.t).length;
  return c;
}
function tkRefreshCalc() {
  if (route.page !== 'takip' || !ui.tk.sid) return;
  const c = tkCalc(tkCur());
  $$('[data-c]').forEach(e => { const v = c[e.dataset.c]; e.textContent = v == null ? '' : v; e.classList.toggle('neg', e.dataset.c.startsWith('ul') && v === 'Hayır'); });
}

/* ---------- sayfa ---------- */
PAGES.takip = arg => {
  const t = ui.tk;
  if (arg) { const s = get('students', arg); if (s) { t.sid = s.id; t.cid = s.cid; } }
  if (!t.wk) t.wk = tkMonday(new Date());
  if (TK_OGR) return tkOgrPage();
  const cs = classes(); if (!cs.length) return `<div class="head"><div><h1>Öğrenci Takip</h1></div></div><div class="card empty"><b>Önce sınıf ekleyin</b>Sınıflar bölümünden fotoğraflı listeyi ekleyince öğrencileri burada haftalık takip edebilirsiniz.</div>`;
  if (!get('classes', t.cid)) { t.cid = cs[0].id; t.sid = ''; }
  const ss = studentsOf(t.cid); if (t.sid && !ss.find(s => s.id === t.sid)) t.sid = '';
  const s = t.sid ? get('students', t.sid) : null;
  const thisWk = tkMonday(new Date());
  let h = `<div class="head"><div><h1>Öğrenci Takip</h1><p class="sub">Haftalık çalışma planı, soru takibi, analiz ve değerlendirme</p></div>
    ${s ? `<button class="btn grad" data-act="tkPrint">⎙ Haftalık form (PDF)</button>` : `<button class="btn ghost" data-act="tkPrintBlank">⎙ Boş formlar (isimli)</button><button class="btn ant" data-act="tkPrintClass">⎙ Sınıf haftalık özet</button>`}</div>
    <div class="card tk-bar"><select id="tkC">${cs.map(c => `<option value="${c.id}"${c.id === t.cid ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="tkS"><option value="">— Sınıfın genel görünümü —</option>${ss.map(x => `<option value="${x.id}"${x.id === t.sid ? ' selected' : ''}>${esc(x.no)} · ${esc(x.name)}</option>`).join('')}</select>
      <div class="tk-wk"><button class="btn ghost sm" data-act="tkWk" data-d="-1" title="Önceki hafta">◀</button><b>${tkRange(t.wk)}</b><button class="btn ghost sm" data-act="tkWk" data-d="1" title="Sonraki hafta">▶</button>${t.wk !== thisWk ? `<button class="btn ghost sm" data-act="tkWk" data-d="0">Bu hafta</button>` : '<span class="chip g">bu hafta</span>'}</div></div>`;
  if (!s) return h + tkClassView(ss);
  return h + tkStudentBody(s);
};
function tkWeekBar() {
  const t = ui.tk, thisWk = tkMonday(new Date());
  return `<div class="tk-wk"><button class="btn ghost sm" data-act="tkWk" data-d="-1" title="Önceki hafta">◀</button><b>${tkRange(t.wk)}</b><button class="btn ghost sm" data-act="tkWk" data-d="1" title="Sonraki hafta">▶</button>${t.wk !== thisWk ? `<button class="btn ghost sm" data-act="tkWk" data-d="0">Bu hafta</button>` : '<span class="chip g">bu hafta</span>'}</div>`;
}
function tkOgrPage() {
  const t = ui.tk; if (!t.wk) t.wk = tkMonday(new Date());
  const s = get('students', t.sid); if (!s) return '';
  return `<div class="card tk-bar">${tkWeekBar()}</div>` + tkStudentBody(s);
}
function tkStudentBody(s) {
  const t = ui.tk; let h = '';
  if (TK_OGR && tkWeekLocked(t.wk)) h += `<div class="note tk-lock">🔒 Bu hafta kapandı; sadece görüntüleyebilirsin.</div>`;
  else if (TK_OGR && tkDayLocked(t.wk, 0)) h += `<div class="note tk-lock">🔒 Bugünü ve en fazla ${TK_GERI} gün öncesini doldurabilirsin. Daha önceki günler kilitli.</div>`;
  const w = tkCur(), c = tkCalc(w), saved = !!get('weeks', w.id);
  h += `<div class="tk-top card"><div class="tk-ph">${photoHTML(s)}</div><div class="tk-who"><b>${esc(s.name)}</b><span class="muted">${esc((get('classes', s.cid) || {}).name)} · No ${esc(s.no)}${saved ? '' : ' · <span class="chip">bu hafta için henüz kayıt yok</span>'}${window.Bulut && Bulut.on() && (get('classes', s.cid) || {}).online ? (Bulut.claimed(s.no) ? ` · <span class="chip g">📱 telefondan dolduruyor${Bulut.lastSeen[s.no] ? ' · son veri: ' + ago(Bulut.lastSeen[s.no]) : ''}</span>` : ' · <span class="chip">📱 henüz kayıt olmadı</span>') : ''}</span>
      <div class="tk-meta"><label>Hedef sınav<select data-tk="exam">${Object.keys(TK_SINAV).map(k => `<option${w.exam === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Hafta no<input type="number" data-tk="no" value="${esc(w.no || '')}" min="1"></label>
      <label>Hedef süre (saat)<input type="number" data-tk="hSaat" value="${esc(w.hSaat || '')}" min="0" step="0.5"></label>
      <label>Hedef soru<input type="number" data-tk="hSoru" value="${esc(w.hSoru || '')}" min="0"></label></div></div>
    <div class="tk-kpi">${tkKpi('Planlanan', `<span data-c="PP">${c.PP}</span> dk`, RENKLER[0])}${tkKpi('Gerçekleşen', `<span data-c="GG">${c.GG}</span> dk`, RENKLER[2])}${tkKpi('Uyum oranı', `<span data-c="UY">${c.UY}</span>`, RENKLER[3])}
      ${tkKpi('Çözülen soru', `<span data-c="QQ">${c.QQ}</span>${w.hSoru ? ' / ' + esc(w.hSoru) : ''}`, RENKLER[1])}${tkKpi('Net', `<span data-c="NN">${c.NN}</span>`, RENKLER[5])}</div></div>`;
  const tabs = [['plan', '1 · Haftalık Plan'], ['soru', '2 · Soru Takibi'], ['ozet', '3 · Özet ve Analiz'], ['deg', '4 · Değerlendirme'], ['gecmis', 'Geçmiş Haftalar']];
  h += `<div class="tools"><div class="tabs">${tabs.map(([k, l]) => `<button class="${t.tab === k ? 'on' : ''}" data-act="tkTab" data-id="${k}">${l}</button>`).join('')}</div>`;
  if (t.tab === 'plan' && !Object.values(w.plan || {}).some(a => (a || []).some(filledRow)) && tkPrev(s.id, t.wk)) h += `<span class="spacer"></span><button class="btn ghost sm" data-act="tkCopyPlan">⧉ Geçen haftanın planını kopyala</button>`;
  h += `</div><datalist id="tkDers">${TK_DERS.map(d => `<option value="${d}">`).join('')}</datalist>`;
  h += ({ plan: tkPlanTab, soru: tkSoruTab, ozet: tkOzetTab, deg: tkDegTab, gecmis: tkGecmisTab }[t.tab] || tkPlanTab)(w, c, s);
  return h;
}
/* Öğrenci sayfasında kilit: öğrenci bugünü ve en fazla 2 gün öncesini doldurabilir; daha eski günler ve bitmiş haftalar yalnız görüntülenir.
   (Öğretmenin programında kilit yoktur.) */
const TK_GERI = 2;
function tkCutoff() { const d = new Date(now()); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - TK_GERI); return tkIso(d); }
function tkDayLocked(wk, g) { return TK_OGR && tkIso(tkDay(wk, g)) < tkCutoff(); }
function tkWeekLocked(wk) { return TK_OGR && tkIso(tkDay(wk, 6)) < tkCutoff(); }
function tkLockDom() {
  if (!TK_OGR) return; const wk = ui.tk.wk, wl = tkWeekLocked(wk);
  const dayOf = el => { const m = (el.dataset.tk || '').match(/^(plan|soru)\.(\d)\./); return m ? +m[2] : (el.dataset.g != null && ['tkSt', 'tkAdd', 'tkBox'].includes(el.dataset.act) ? +el.dataset.g : null); };
  $$('#main [data-tk], #main [data-act^="tk"]').forEach(el => {
    if (['tkTab', 'tkWk', 'tkOpenWk'].includes(el.dataset.act)) return;
    const g = dayOf(el); const lock = g != null ? tkDayLocked(wk, g) : wl;
    if (lock) { el.disabled = true; el.classList.add('locked'); if (el.dataset.act === 'tkAdd' || el.dataset.act === 'tkAddList' || el.dataset.act === 'tkCopyPlan' || el.dataset.act === 'tkDel') el.style.display = 'none'; }
  });
}
PAGES.takip.after = () => tkLockDom();
function tkKpi(l, v, col) { return `<div class="stat" style="background:linear-gradient(135deg,${col[0]},${col[1]})"><b>${v}</b><span>${l}</span></div>`; }
const tkIn = (path, v, cls, extra) => `<input type="text" class="tkin ${cls || ''}" data-tk="${path}" value="${esc(v == null ? '' : v)}" ${extra || ''}>`;
const tkNum = (path, v, extra) => `<input type="text" inputmode="decimal" class="tkin n" data-tk="${path}" value="${esc(v == null ? '' : v)}" ${extra || ''}>`;
const tkMinRows = (w, part, g) => Math.max(part === 'plan' ? 3 : 2, tkRows(w, part, g).length);

function tkPlanTab(w, c) {
  let h = `<div class="card"><h2>🎯 Bu haftanın 3 ana hedefi <span class="muted" style="font-weight:500;font-size:13px">Somut ve ölçülebilir: “Türev konusu + 120 soru”</span></h2>`;
  for (let i = 0; i < 3; i++) { const g = (w.goals || [])[i] || {}; h += `<div class="tk-goal"><span class="qn">${i + 1}</span>${tkIn(`goals.${i}.t`, g.t)}<label class="ck"><input type="checkbox" data-tk="goals.${i}.ok" ${g.ok ? 'checked' : ''}> Tamam</label></div>`; }
  h += `</div><div class="card" style="padding:10px"><div class="row" style="padding:4px 6px 10px"><h2 style="margin:0">📅 Günlük plan ve gerçekleşen</h2><span class="spacer"></span><span class="muted" style="font-size:13px">✓ tamamlandı · ½ yarım kaldı · ✗ yapılmadı</span></div>
    <div class="tbl-wrap"><table class="tk"><thead><tr><th style="width:132px">Gün</th><th>Ders</th><th>Konu / Etkinlik</th><th>Kaynak / Sayfa</th><th class="c">Plan (dk)</th><th class="c">Gerçek (dk)</th><th class="c">Soru hedefi</th><th class="c">Durum</th></tr></thead><tbody>`;
  for (let g = 0; g < 7; g++) {
    const n = tkMinRows(w, 'plan', g), rows = tkRows(w, 'plan', g);
    for (let i = 0; i < n; i++) {
      const r = rows[i] || {}; const p = `plan.${g}.${i}`;
      h += `<tr class="${i === 0 ? 'dstart' : ''} ${g % 2 ? 'odd' : ''}">${i === 0 ? `<td rowspan="${n}" class="day"><b>${TK_GUN[g]}</b><span>${tkDM(tkDay(w.wk, g))}</span><span>Toplam: <b data-c="pr${g}">${c['pr' + g]}</b> / <span data-c="pp${g}">${c['pp' + g]}</span> dk</span>${tkDayLocked(w.wk, g) ? '<span class="lk">🔒 kapandı</span>' : ''}<button class="lnk" data-act="tkAdd" data-p="plan" data-g="${g}">＋ satır</button></td>` : ''}
        <td>${tkIn(p + '.ders', r.ders, '', 'list="tkDers"')}</td><td>${tkIn(p + '.konu', r.konu, 'wide')}</td><td>${tkIn(p + '.kay', r.kay)}</td><td>${tkNum(p + '.p', r.p)}</td><td>${tkNum(p + '.r', r.r)}</td><td>${tkNum(p + '.h', r.h)}</td>
        <td class="c st">${Object.entries(TK_ST).map(([k, l]) => `<button class="${r.st === k ? 'on ' + k : ''}" data-act="tkSt" data-g="${g}" data-i="${i}" data-v="${k}">${l}</button>`).join('')}</td></tr>`;
    }
  }
  h += `</tbody><tfoot><tr><td colspan="4"><b>HAFTA TOPLAMI</b></td><td class="c"><b data-c="PP">${c.PP}</b></td><td class="c"><b data-c="GG">${c.GG}</b></td><td class="c" colspan="2">Uyum: <b data-c="UY">${c.UY}</b></td></tr></tfoot></table></div></div>`;
  return h;
}
function tkSoruTab(w, c) {
  let h = `<div class="card" style="padding:10px"><div class="row" style="padding:4px 6px 10px"><h2 style="margin:0">✏️ Soru çözüm çizelgesi</h2><span class="spacer"></span><span class="muted" style="font-size:13px">D: Doğru · Y: Yanlış · B: Boş · Net = D − Y ÷ ${tkNd(w)} (${esc(w.exam)})</span></div>
    <div class="tbl-wrap"><table class="tk"><thead><tr><th style="width:132px">Gün</th><th>Ders</th><th>Konu</th><th>Kaynak</th><th class="c">Soru</th><th class="c">D</th><th class="c">Y</th><th class="c">B</th><th class="c">Net</th><th class="c">Süre (dk)</th></tr></thead><tbody>`;
  for (let g = 0; g < 7; g++) {
    const n = tkMinRows(w, 'soru', g), rows = tkRows(w, 'soru', g);
    for (let i = 0; i < n; i++) {
      const r = rows[i] || {}; const p = `soru.${g}.${i}`;
      h += `<tr class="${i === 0 ? 'dstart' : ''} ${g % 2 ? 'odd' : ''}">${i === 0 ? `<td rowspan="${n + 1}" class="day"><b>${TK_GUN[g]}</b><span>${tkDM(tkDay(w.wk, g))}</span>${tkDayLocked(w.wk, g) ? '<span class="lk">🔒 kapandı</span>' : ''}<button class="lnk" data-act="tkAdd" data-p="soru" data-g="${g}">＋ satır</button></td>` : ''}
        <td>${tkIn(p + '.ders', r.ders, '', 'list="tkDers"')}</td><td>${tkIn(p + '.konu', r.konu, 'wide')}</td><td>${tkIn(p + '.kay', r.kay)}</td>
        <td>${tkNum(p + '.q', r.q, 'placeholder="D+Y+B"')}</td><td>${tkNum(p + '.d', r.d)}</td><td>${tkNum(p + '.y', r.y)}</td><td>${tkNum(p + '.b', r.b)}</td><td class="c calc" data-c="sn${g}_${i}">${c[`sn${g}_${i}`] || ''}</td><td>${tkNum(p + '.t', r.t)}</td></tr>`;
    }
    h += `<tr class="dtot ${g % 2 ? 'odd' : ''}"><td colspan="3" class="muted">Gün toplamı</td><td class="c" data-c="sq${g}">${c['sq' + g]}</td><td class="c" data-c="sd${g}">${c['sd' + g]}</td><td class="c" data-c="sy${g}">${c['sy' + g]}</td><td class="c" data-c="sb${g}">${c['sb' + g]}</td><td class="c" data-c="snt${g}">${c['snt' + g]}</td><td class="c" data-c="st${g}">${c['st' + g]}</td></tr>`;
  }
  h += `</tbody><tfoot><tr><td colspan="4"><b>HAFTALIK TOPLAM</b></td><td class="c" data-c="QQ">${c.QQ}</td><td class="c" data-c="DD">${c.DD}</td><td class="c" data-c="YY">${c.YY}</td><td class="c" data-c="BB">${c.BB}</td><td class="c" data-c="NN">${c.NN}</td><td class="c" data-c="TT">${c.TT}</td></tr></tfoot></table></div>
    <p class="muted" style="font-size:13px;margin:8px 6px 2px">İpucu: Yanlış ve boş bıraktığı soruları 4. sekmedeki “Eksik konular” listesine ekleyin.</p></div>`;
  return h;
}
/* Ekranda: her gün için yarım saatlik kutular; dokununca o kutuya kadar işaretlenir (w.kutu[gün] = kutu sayısı). */
function tkBoxes(w, c) {
  const auto = g => c['kt' + g] ? 0 : Math.floor(((c.dayMin[g] || 0) / 30) + 1e-6);
  const mx = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(g => Math.max(c['kt' + g], auto(g))));
  const rows = Math.min(32, Math.max(16, mx + (mx >= 15 ? 2 : 0) + (mx % 2)));
  const hd = Math.round(n0(w.hSaat) / 7 * 2);
  let h = `<div class="tk-boxes" style="--rows:${rows}"><div class="tk-ax">${Array.from({ length: rows / 2 + 1 }, (_, i) => `<span style="bottom:calc(${i} * 2 * var(--bh))">${rows / 2 - (rows / 2 - i)} sa</span>`).join('')}</div>`;
  for (let g = 0; g < 7; g++) {
    const kt = c['kt' + g], au = auto(g), v = kt || au;
    h += `<div class="tk-day"><b class="tk-sum ${kt ? '' : 'auto'}">${v ? fmt1(v / 2) + ' sa' : ''}</b><div class="tk-col">`;
    for (let k = rows - 1; k >= 0; k--) h += `<button class="tk-bx${k < kt ? ' on' : !kt && k < au ? ' au' : ''}${hd && k === hd - 1 ? ' goal' : ''}${k % 2 ? ' hr' : ''}" data-act="tkBox" data-g="${g}" data-k="${k}" title="${TK_GUN[g]} · ${fmt1((k + 1) / 2)} saat">${k < kt ? '✓' : ''}</button>`;
    h += `</div><span class="tk-dn"><i class="l">${TK_GUN[g]}</i><i class="s">${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][g]}</i></span><span class="tk-dd">${tkDM(tkDay(w.wk, g))}</span></div>`;
  }
  return h + `</div>`;
}
function tkChart(w, c, print) {
  const W = 700, Hh = 240, L = 40, Bm = 26, top = 10, maxH = Math.max(8, Math.ceil(Math.max(...c.dayMin) / 60));
  const y = v => top + (Hh - top - Bm) * (1 - v / maxH), bw = (W - L - 10) / 7;
  let s = `<svg viewBox="0 0 ${W} ${Hh}" class="tk-chart" role="img" aria-label="Günlük çalışma süresi">`;
  for (let i = 0; i <= maxH; i++) s += `<line x1="${L}" x2="${W - 6}" y1="${y(i)}" y2="${y(i)}" stroke="${print ? '#ccd' : '#e4e1ee'}" stroke-width="1"/><text x="${L - 6}" y="${y(i) + 4}" text-anchor="end" font-size="11" fill="#6e6a7c">${i} sa</text>`;
  for (let g = 0; g < 7; g++) {
    const v = (c.dayMin[g] || 0) / 60, x = L + g * bw + bw * 0.22, bwi = bw * 0.56;
    if (print) { for (let k = 0; k < maxH * 2; k++) { const yy = y((k + 1) / 2); s += `<rect x="${x}" y="${yy}" width="${bwi}" height="${y(k / 2) - yy}" fill="${(k + 1) / 2 <= v + 0.001 ? '#2a9d8f' : '#fff'}" stroke="#1f3a5f" stroke-width="0.8"/>`; } }
    else if (v) s += `<rect x="${x}" y="${y(Math.min(v, maxH))}" width="${bwi}" height="${y(0) - y(Math.min(v, maxH))}" rx="6" fill="url(#tkg)"/><text x="${x + bwi / 2}" y="${y(Math.min(v, maxH)) - 5}" text-anchor="middle" font-size="11" font-weight="700" fill="#4b3fc4">${fmt1(v)}</text>`;
    s += `<text x="${x + bwi / 2}" y="${Hh - 8}" text-anchor="middle" font-size="11" fill="#26232f">${TK_GUN[g]}</text>`;
  }
  const hd = n0(w.hSaat) / 7; if (hd) s += `<line x1="${L}" x2="${W - 6}" y1="${y(hd)}" y2="${y(hd)}" stroke="#d2463c" stroke-width="2" stroke-dasharray="6 4"/><text x="${W - 8}" y="${y(hd) - 5}" text-anchor="end" font-size="11" fill="#d2463c">günlük hedef ${fmt1(hd)} sa</text>`;
  return s + `<defs><linearGradient id="tkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4b3fc4"/></linearGradient></defs></svg>`;
}
function tkOzetTab(w, c) {
  let h = `<div class="card" style="padding:10px"><h2 style="padding:4px 6px 0">📊 Ders bazında haftalık sonuç</h2>`;
  if (!c.ders.length) h += `<p class="muted" style="padding:0 6px">Plan veya soru takibine ders girildikçe burada ders ders sonuçlar hesaplanır.</p>`;
  else {
    h += `<div class="tbl-wrap"><table class="tk"><thead><tr><th>Ders</th><th class="c">Hedef soru</th><th class="c">Çözülen</th><th class="c">Doğru</th><th class="c">Yanlış</th><th class="c">Boş</th><th class="c">Net</th><th class="c">Başarı %</th><th class="c">Süre (saat)</th><th class="c">Hedefe ulaştı mı?</th></tr></thead><tbody>
      ${c.ders.map((x, i) => `<tr><td><b>${esc(x.k)}</b></td><td style="width:90px">${tkNum('hd.' + x.k, (w.hd || {})[x.k])}</td><td class="c">${x.q || ''}</td><td class="c">${x.d || ''}</td><td class="c">${x.y || ''}</td><td class="c">${x.b || ''}</td><td class="c"><b>${x.q ? fmt1(x.net) : ''}</b></td><td class="c">${x.bas == null ? '' : '%' + x.bas}</td><td class="c">${x.saat ? fmt1(x.saat) : ''}</td><td class="c"><b data-c="ul${i}" class="${x.ul === false ? 'neg' : ''}">${c['ul' + i]}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td><b>TOPLAM</b></td><td></td><td class="c">${c.QQ}</td><td class="c">${c.DD}</td><td class="c">${c.YY}</td><td class="c">${c.BB}</td><td class="c">${c.NN}</td><td class="c">${c.Q ? '%' + Math.round(c.D / c.Q * 100) : ''}</td><td class="c">${c.T ? fmt1(c.T / 60) : ''}</td><td></td></tr></tfoot></table></div>`;
  }
  h += `</div><div class="card"><div class="row" style="margin-bottom:10px"><h2 style="margin:0">⏱ Günlük çalışma süresi</h2><span class="spacer"></span><span class="muted" style="font-size:13px">1 kutu = 30 dk</span></div>${tkBoxes(w, c)}
    <p class="muted" style="font-size:13px;margin:10px 0 0">Her gün çalıştığın kadar kutuya dokun (✓). Aynı kutuya tekrar dokunursan o kutu boşalır. İşaretlenmeyen günlerde süre plan / soru takibinden açık renkle gösterilir.${n0(w.hSaat) ? ' Kırmızı çizgili kutu: günlük hedef (haftalık hedef süre ÷ 7).' : ''}</p></div>`;
  const cols = (TK_SINAV[w.exam] || TK_SINAV.TYT).cols;
  h += `<div class="card" style="padding:10px"><div class="row" style="padding:4px 6px 10px"><h2 style="margin:0">📝 Bu haftaki deneme sınavları</h2><span class="spacer"></span><button class="btn ghost sm" data-act="tkAddList" data-p="den">＋ Deneme ekle</button></div>
    <div class="tbl-wrap"><table class="tk"><thead><tr><th>Deneme adı / Yayın</th><th class="c">Tarih</th>${cols.map(k => `<th class="c">${esc(k)}</th>`).join('')}<th class="c">Toplam net</th><th class="c">Puan</th><th class="c">Sıralama</th><th></th></tr></thead><tbody>`;
  const den = (w.den || []);
  if (!den.length) h += `<tr><td colspan="${cols.length + 6}" class="muted" style="padding:12px">Henüz deneme yok. “＋ Deneme ekle” ile ekleyin. Sütunlar hedef sınava göre değişir (${esc(w.exam)}).</td></tr>`;
  den.forEach((x, i) => { if (!x) return; h += `<tr><td>${tkIn(`den.${i}.ad`, x.ad, 'wide')}</td><td style="width:84px">${tkIn(`den.${i}.tar`, x.tar, '', 'placeholder="gg.aa"')}</td>${cols.map(k => `<td style="width:70px">${tkNum(`den.${i}.s.${k}`, (x.s || {})[k])}</td>`).join('')}<td class="c calc"><b data-c="dn${i}">${c['dn' + i] || ''}</b></td><td style="width:70px">${tkNum(`den.${i}.puan`, x.puan)}</td><td style="width:80px">${tkNum(`den.${i}.sira`, x.sira)}</td><td><button class="lnk x" data-act="tkDel" data-p="den" data-i="${i}" title="Sil">✕</button></td></tr>`; });
  return h + `</tbody></table></div></div>`;
}
function tkDegTab(w) {
  let h = `<div class="card" style="padding:10px"><div class="row" style="padding:4px 6px 10px"><h2 style="margin:0">🔁 Eksik konular ve tekrar planı</h2><span class="spacer"></span><span class="muted" style="font-size:13px">Hata nedeni: B bilgi eksiği · İ işlem hatası · D dikkat · S süre</span><button class="btn ghost sm" data-act="tkAddList" data-p="eks">＋ Eksik ekle</button></div>
    <div class="tbl-wrap"><table class="tk"><thead><tr><th>Ders</th><th>Konu / Soru tipi</th><th class="c">Hata nedeni</th><th>Ne yapılacak?</th><th class="c">Tekrar tarihi</th><th class="c">Yapıldı 1.</th><th class="c">2.</th><th></th></tr></thead><tbody>`;
  const eks = w.eks || [];
  if (!eks.length) h += `<tr><td colspan="8" class="muted" style="padding:12px">Eksik konu yok. “＋ Eksik ekle” ile ekleyin.</td></tr>`;
  eks.forEach((x, i) => { if (!x) return; h += `<tr><td style="width:130px">${tkIn(`eks.${i}.ders`, x.ders, '', 'list="tkDers"')}</td><td>${tkIn(`eks.${i}.konu`, x.konu, 'wide')}</td>
    <td style="width:120px"><select class="tkin" data-tk="eks.${i}.ne"><option value="">–</option>${Object.entries(TK_NEDEN).map(([k, l]) => `<option value="${k}"${x.ne === k ? ' selected' : ''}>${k} · ${l}</option>`).join('')}</select></td>
    <td>${tkIn(`eks.${i}.yap`, x.yap, 'wide')}</td><td style="width:140px"><input type="date" class="tkin" data-tk="eks.${i}.tar" value="${esc(x.tar || '')}"></td>
    <td class="c"><input type="checkbox" data-tk="eks.${i}.y1" ${x.y1 ? 'checked' : ''}></td><td class="c"><input type="checkbox" data-tk="eks.${i}.y2" ${x.y2 ? 'checked' : ''}></td><td><button class="lnk x" data-act="tkDel" data-p="eks" data-i="${i}" title="Sil">✕</button></td></tr>`; });
  h += `</tbody></table></div></div><div class="grid2"><div class="card"><h2>🙋 Öğrenci öz değerlendirmesi <span class="muted" style="font-weight:500;font-size:13px">1 çok zayıf … 5 çok iyi</span></h2>`;
  TK_OZ.forEach(([k, l]) => { const v = (w.oz || {})[k]; h += `<div class="tk-oz"><span>${l}</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button class="${v === n ? 'on' : ''}" data-act="tkOz" data-k="${k}" data-v="${n}">${n}</button>`).join('')}</div></div>`; });
  h += `<label class="f" style="margin-top:12px"><span>Bu hafta en iyi yaptığım şey</span><textarea class="tkin" data-tk="oz.iyi">${esc((w.oz || {}).iyi || '')}</textarea></label>
    <label class="f"><span>Gelecek hafta değiştireceğim şey</span><textarea class="tkin" data-tk="oz.deg">${esc((w.oz || {}).deg || '')}</textarea></label></div>
    <div><div class="card"><h2>👨‍🏫 Öğretmen değerlendirmesi</h2>${TK_OGR ? `${(w.ogr || {}).g ? `<p style="margin:0 0 8px">Genel durum: <span class="chip ${(w.ogr || {}).g === 'Geliştirilmeli' ? 'r' : 'g'}" style="font-size:14px">${esc(w.ogr.g)}</span></p>` : ''}<p style="margin:0;white-space:pre-wrap">${esc((w.ogr || {}).not || '') || '<span class="muted">Öğretmeniniz bu hafta için henüz değerlendirme yazmadı.</span>'}</p>` : `<div class="seg" style="margin-bottom:12px">${TK_GENEL.map((g, i) => `<button class="${(w.ogr || {}).g === g ? 'on' + (i === 3 ? ' x' : i === 2 ? ' w' : '') : ''}" data-act="tkGenel" data-v="${g}">${g}</button>`).join('')}</div>
      <textarea class="tkin" data-tk="ogr.not" placeholder="Görüşleriniz…" style="min-height:110px">${esc((w.ogr || {}).not || '')}</textarea>`}</div>
    <div class="card"><h2>🎯 Gelecek haftanın odak konuları</h2>${[0, 1, 2, 3].map(i => `<div class="tk-goal"><span class="qn">${i + 1}</span>${tkIn(`odak.${i}`, (w.odak || [])[i])}</div>`).join('')}
      <button class="btn ghost sm" data-act="tkOdakNext" style="margin-top:6px">→ İlk üçünü gelecek haftanın hedeflerine aktar</button></div></div></div>`;
  return h;
}
function tkGecmisTab(w, c, s) {
  const ws = live('weeks').filter(x => x.sid === s.id).sort((a, b) => a.wk < b.wk ? 1 : -1);
  if (!ws.length) return `<div class="card empty"><b>Henüz kayıtlı hafta yok</b>Bilgi girdiğiniz haftalar burada listelenir.</div>`;
  const rows = ws.map(x => ({ w: x, c: tkCalc(x) }));
  const last = rows.slice(0, 12).reverse(), W = 700, H = 200, L = 34, bw = Math.min(80, (W - L - 10) / Math.max(last.length, 1));
  const maxS = Math.max(1, ...last.map(r => r.c.G / 60)), maxQ = Math.max(1, ...last.map(r => r.c.Q));
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="tk-chart">`;
  last.forEach((r, i) => {
    const x = L + i * bw + bw * 0.2, b = bw * 0.6, hh = (H - 46) * (r.c.G / 60) / maxS;
    svg += `<rect x="${x}" y="${H - 26 - hh}" width="${b}" height="${hh}" rx="5" fill="#8b5cf6"/><text x="${x + b / 2}" y="${H - 30 - hh}" text-anchor="middle" font-size="11" font-weight="700" fill="#4b3fc4">${r.c.G ? fmt1(r.c.G / 60) : ''}</text><text x="${x + b / 2}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#26232f">${tkDM(tkDay(r.w.wk, 0))}</text>`;
  });
  const pts = last.map((r, i) => `${L + i * bw + bw / 2},${H - 26 - (H - 46) * r.c.Q / maxQ}`).join(' ');
  svg += `<polyline points="${pts}" fill="none" stroke="#d0458f" stroke-width="2.5"/>${last.map((r, i) => `<circle cx="${L + i * bw + bw / 2}" cy="${H - 26 - (H - 46) * r.c.Q / maxQ}" r="4" fill="#d0458f"/>`).join('')}</svg>`;
  return `<div class="card"><h2>📈 Son haftalar</h2><div class="row" style="gap:16px;font-size:13px;margin-bottom:6px"><span><i class="lg" style="background:#8b5cf6"></i>Çalışma (saat)</span><span><i class="lg" style="background:#d0458f"></i>Çözülen soru</span></div>${svg}</div>
    <div class="card" style="padding:8px"><div class="tbl-wrap"><table class="t"><thead><tr><th>Hafta</th><th class="c">Hedef sınav</th><th class="c">Plan (sa)</th><th class="c">Gerçek (sa)</th><th class="c">Uyum</th><th class="c">Soru</th><th class="c">Net</th><th class="c">Hedefler</th><th class="c">Öğretmen</th></tr></thead><tbody>
    ${rows.map(r => `<tr style="cursor:pointer" data-act="tkOpenWk" data-id="${r.w.wk}"><td><b>${tkRange(r.w.wk)}</b>${r.w.no ? ` <span class="muted">(${esc(r.w.no)}. hafta)</span>` : ''}</td><td class="c">${esc(r.w.exam)}</td><td class="c">${r.c.P ? fmt1(r.c.P / 60) : ''}</td><td class="c">${r.c.G ? fmt1(r.c.G / 60) : ''}</td><td class="c">${r.c.UY}</td><td class="c">${r.c.QQ}</td><td class="c">${r.c.NN}</td><td class="c">${r.c.goalsN ? r.c.goalsOk + '/' + r.c.goalsN : ''}</td><td class="c">${esc((r.w.ogr || {}).g || '')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function tkClassView(ss) {
  const t = ui.tk;
  if (!ss.length) return `<div class="card empty">Bu sınıfta öğrenci yok.</div>`;
  const rows = ss.map(s => { const w = get('weeks', tkId(s.id, t.wk)); return { s, w, c: w ? tkCalc(w) : null }; });
  const act = rows.filter(r => r.w);
  const sum = (f) => act.reduce((a, r) => a + f(r), 0);
  let h = `<div class="stats">${tkKpi('Kaydı olan öğrenci', `${act.length}/${ss.length}`, RENKLER[6])}${tkKpi('Ort. çalışma', act.length ? fmt1(sum(r => r.c.G) / 60 / act.length) + ' sa' : '–', RENKLER[2])}
    ${tkKpi('Ort. uyum', (() => { const u = act.filter(r => r.c.uyum != null); return u.length ? '%' + Math.round(u.reduce((a, r) => a + r.c.uyum, 0) / u.length) : '–'; })(), RENKLER[3])}${tkKpi('Toplam soru', sum(r => r.c.Q) || '–', RENKLER[1])}${tkKpi('Geliştirilmeli', act.filter(r => (r.w.ogr || {}).g === 'Geliştirilmeli').length, RENKLER[7])}</div>
    <div class="card" style="padding:8px"><div class="tbl-wrap"><table class="t"><thead><tr><th></th><th>No</th><th>Ad Soyad</th><th class="c">Hedef (sa)</th><th class="c">Plan (sa)</th><th class="c">Gerçek (sa)</th><th class="c">Uyum</th><th class="c">Soru</th><th class="c">Net</th><th class="c">Hedefler</th><th class="c">Öğretmen</th>${tkOnline() ? '<th class="c">📱</th>' : ''}</tr></thead><tbody>
    ${rows.map(({ s, w, c }) => `<tr style="cursor:pointer" data-act="tkPick" data-id="${s.id}"><td>${s.photo ? `<img class="mini" src="${s.photo}" alt="">` : ''}</td><td><b>${esc(s.no)}</b></td><td style="white-space:nowrap">${esc(s.name)}</td>
      ${w ? `<td class="c">${esc(w.hSaat || '')}</td><td class="c">${c.P ? fmt1(c.P / 60) : ''}</td><td class="c"><b>${c.G ? fmt1(c.G / 60) : ''}</b></td><td class="c ${c.uyum != null && c.uyum < 60 ? 'neg' : ''}">${c.UY}</td><td class="c">${c.QQ}${w.hSoru ? '<span class="muted">/' + esc(w.hSoru) + '</span>' : ''}</td><td class="c">${c.NN}</td><td class="c">${c.goalsN ? c.goalsOk + '/' + c.goalsN : ''}</td><td class="c">${esc((w.ogr || {}).g || '')}</td>`
      : `<td colspan="8" class="muted c">bu hafta kayıt yok — doldurmak için tıklayın</td>`}${tkOnline() ? `<td class="c">${Bulut.claimed(s.no) ? '<span class="chip g" title="Telefondan kayıtlı">✓</span>' : '<span class="muted">–</span>'}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
  return h;
}

/* ---------- olaylar ---------- */
Object.assign(ACT, {
  tkBox: el => { const g = el.dataset.g, k = +el.dataset.k; tkEdit(w => { const cur = n0((w.kutu || {})[g]); w.kutu = Object.assign({}, w.kutu, { [g]: cur === k + 1 ? k : k + 1 }); }); render(); },
  tkTab: el => { ui.tk.tab = el.dataset.id; render(); },
  tkWk: el => { const d = +el.dataset.d; ui.tk.wk = d ? tkShift(ui.tk.wk, d) : tkMonday(new Date()); render(); },
  tkPick: el => { ui.tk.sid = el.dataset.id; render(); window.scrollTo(0, 0); },
  tkOpenWk: el => { ui.tk.wk = el.dataset.id; ui.tk.tab = 'plan'; render(); window.scrollTo(0, 0); },
  tkSt: el => { tkEdit(w => { const p = `plan.${el.dataset.g}.${el.dataset.i}.st`; tkSet(w, p, tkVal(w, p) === el.dataset.v ? '' : el.dataset.v); }); render(); },
  tkAdd: el => { tkEdit(w => { const g = el.dataset.g, part = el.dataset.p; w[part] = w[part] || {}; const a = w[part][g] = (w[part][g] || []).slice(); while (a.length < tkMinRows(w, part, g)) a.push({}); a.push({}); }); render(); },
  tkAddList: el => { tkEdit(w => { w[el.dataset.p] = (w[el.dataset.p] || []).concat([{}]); }); render(); },
  tkDel: el => { tkEdit(w => { w[el.dataset.p] = (w[el.dataset.p] || []).filter((x, i) => i !== +el.dataset.i); }); render(); },
  tkOz: el => { tkEdit(w => { w.oz = w.oz || {}; const v = +el.dataset.v; w.oz[el.dataset.k] = w.oz[el.dataset.k] === v ? null : v; }); render(); },
  tkGenel: el => { tkEdit(w => { w.ogr = w.ogr || {}; w.ogr.g = w.ogr.g === el.dataset.v ? '' : el.dataset.v; }); render(); },
  tkCopyPlan: () => {
    const p = tkPrev(ui.tk.sid, ui.tk.wk); if (!p) return;
    tkEdit(w => { w.plan = {}; Object.entries(p.plan || {}).forEach(([g, a]) => { w.plan[g] = (a || []).filter(filledRow).map(r => ({ ders: r.ders || '', konu: r.konu || '', kay: r.kay || '', p: r.p || '', h: r.h || '' })); }); if (!(w.goals || []).some(x => x && x.t)) w.goals = (p.odak || []).slice(0, 3).map(t => ({ t: t || '' })); });
    render(); toast('Geçen haftanın planı kopyalandı (gerçekleşen süreler ve durumlar boş)');
  },
  tkOdakNext: () => {
    const w = tkCur(); const od = (w.odak || []).filter(Boolean); if (!od.length) return toast('Önce odak konularını yazın');
    const nwk = tkShift(ui.tk.wk, 1); const nx = JSON.parse(JSON.stringify(tkGet(ui.tk.sid, nwk)));
    const nb = JSON.parse(JSON.stringify(nx)); nx.goals = [0, 1, 2].map(i => Object.assign({}, (nx.goals || [])[i], od[i] ? { t: od[i] } : {})); if (tkStamp(nb, nx)) nx.ua = now(); put('weeks', nx); if (window.tkSaved) window.tkSaved(nx); toast('Gelecek haftanın hedeflerine aktarıldı');
  },
  tkPrint: () => { const s = get('students', ui.tk.sid); doPrint(tkPrintWeek(s, tkCur()), `${s.no || ''} ${s.name} - Haftalık Takip ${ui.tk.wk}`); },
  tkPrintBlank: () => { const ss = studentsOf(ui.tk.cid); if (!ss.length) return toast('Sınıfta öğrenci yok'); doPrint(ss.map(s => tkPrintWeek(s, get('weeks', tkId(s.id, ui.tk.wk)) || tkNew(s.id, ui.tk.wk), true)).join(''), `${(get('classes', ui.tk.cid) || {}).name || ''} Haftalık Formlar ${ui.tk.wk}`.replace('/', '-')); },
  tkPrintClass: () => doPrint(tkPrintClass(), `${(get('classes', ui.tk.cid) || {}).name || ''} Haftalık Özet ${ui.tk.wk}`.replace('/', '-')),
  tkGo: el => { const s = get('students', el.dataset.id); if (s) { ui.tk.cid = s.cid; ui.tk.sid = s.id; ui.tk.tab = 'plan'; } go('takip'); },
});
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.tk || route.page !== 'takip' || t.type === 'checkbox' || t.tagName === 'SELECT') return;
  tkEdit(w => tkSet(w, t.dataset.tk, t.value)); tkRefreshCalc();
});
document.addEventListener('change', e => {
  const t = e.target; if (route.page !== 'takip') return;
  if (t.id === 'tkC') { ui.tk.cid = t.value; ui.tk.sid = ''; render(); return; }
  if (t.id === 'tkS') { ui.tk.sid = t.value; render(); return; }
  if (!t.dataset || !t.dataset.tk) return;
  if (t.type === 'checkbox') { tkEdit(w => tkSet(w, t.dataset.tk, t.checked)); tkRefreshCalc(); }
  else if (t.tagName === 'SELECT') { tkEdit(w => tkSet(w, t.dataset.tk, t.value)); if (t.dataset.tk === 'exam') render(); }
  else if (/^hd\./.test(t.dataset.tk) || /\.ders$/.test(t.dataset.tk)) { if (ui.tk.tab === 'ozet') render(); }
});

/* ---------- yazdırma (formun 4 sayfası) ---------- */
function tkPrintWeek(s, w, blankish) {
  const c = tkCalc(w), cl = get('classes', s.cid) || {}, st = settings(), nd = tkNd(w);
  const v = x => x == null || x === '' ? '' : esc(x);
  const head = (t, sub, n) => `<div class="tp-h"><div><b>${t}</b><span>${sub}</span></div><div class="tp-r">Hafta: <b>${tkDM(tkDay(w.wk, 0))}.${tkDay(w.wk, 0).getFullYear()} – ${tkDM(tkDay(w.wk, 6))}.${tkDay(w.wk, 6).getFullYear()}</b><br>Öğrenci: <b>${esc(s.name)}</b></div></div>`;
  const foot = n => `<div class="tp-f"><span>Haftalık Çalışma Takip Formu · ${esc(st.school || '')}</span><span>Sayfa ${n} / 4</span></div>`;
  const sec = t => `<div class="tp-s">${t}</div>`;
  const box = on => `<span class="tp-o${on ? ' on' : ''}"></span>`;
  // 1. sayfa
  let h = `<div class="pg tp">${head('HAFTALIK ÇALIŞMA PLANI', 'Planla · Uygula · Kontrol et — haftanın başında doldurulur, gün gün işaretlenir')}
    <div class="tp-info"><div><i>Ad Soyad:</i> ${esc(s.name)}</div><div><i>Sınıf / Okul:</i> ${esc(cl.name || '')} · No ${esc(s.no || '')}${st.school ? ' · ' + esc(st.school) : ''}</div>
      <div><i>Hedef Sınav:</i> ${v(w.exam)}</div><div><i>Hafta No:</i> ${v(w.no)} &nbsp; <i>Öğretmen:</i> ${v(st.teacher)}</div>
      <div><i>Haftalık hedef çalışma süresi:</i> ${v(w.hSaat) || '_____'} saat</div><div><i>Haftalık hedef soru:</i> ${v(w.hSoru) || '_____'}</div></div>
    ${sec('Bu Haftanın 3 Ana Hedefi')}${[0, 1, 2].map(i => { const g = (w.goals || [])[i] || {}; return `<div class="tp-line"><b>${i + 1}</b><span>${v(g.t)}</span><em>Tamam ${box(g.ok)}</em></div>`; }).join('')}
    ${sec('Günlük Plan ve Gerçekleşen <small>✓ = tamamlandı · ½ = yarım kaldı · ✗ = yapılmadı</small>')}
    <table class="tp-t"><thead><tr><th style="width:21mm">Gün</th><th style="width:24mm">Ders</th><th>Konu / Etkinlik</th><th style="width:24mm">Kaynak / Sayfa</th><th style="width:11mm">Plan (dk)</th><th style="width:11mm">Gerçek (dk)</th><th style="width:11mm">Soru hedefi</th><th style="width:17mm">Durum<br>✓ ½ ✗</th></tr></thead><tbody>`;
  for (let g = 0; g < 7; g++) {
    const rows = tkRows(w, 'plan', g); const n = Math.max(3, rows.length);
    for (let i = 0; i < n; i++) {
      const r = rows[i] || {};
      h += `<tr class="${i === 0 ? 'ds' : ''}">${i === 0 ? `<td rowspan="${n}" class="tp-d ${g >= 5 ? 'we' : ''}"><b>${TK_GUN[g]}</b><br>Tarih: ${tkDM(tkDay(w.wk, g))}<br>Toplam: ${c['pr' + g] || '____'} dk</td>` : ''}<td>${v(r.ders)}</td><td>${v(r.konu)}</td><td>${v(r.kay)}</td><td class="c">${v(r.p)}</td><td class="c">${v(r.r)}</td><td class="c">${v(r.h)}</td><td class="c">${box(r.st === 'ok')}${box(r.st === 'half')}${box(r.st === 'no')}</td></tr>`;
    }
  }
  h += `</tbody></table><div class="tp-tot"><b>HAFTA TOPLAMI</b><span>Planlanan: <b>${c.PP || '_____'}</b> dk</span><span>Gerçekleşen: <b>${c.GG || '_____'}</b> dk</span><span>Uyum oranı: <b>${c.UY || '%_____'}</b></span></div>${foot(1)}</div>`;
  // 2. sayfa
  h += `<div class="pg tp">${head('GÜNLÜK SORU TAKİBİ', `Her çalışmadan sonra doldur · Net = Doğru − (Yanlış ÷ ${nd})`)}${sec('Soru Çözüm Çizelgesi <small>D: Doğru · Y: Yanlış · B: Boş</small>')}
    <table class="tp-t"><thead><tr><th style="width:21mm">Gün</th><th style="width:24mm">Ders</th><th>Konu</th><th style="width:26mm">Kaynak</th><th style="width:10mm">Soru</th><th style="width:9mm">D</th><th style="width:9mm">Y</th><th style="width:9mm">B</th><th style="width:11mm">Net</th><th style="width:11mm">Süre (dk)</th></tr></thead><tbody>`;
  for (let g = 0; g < 7; g++) {
    const rows = tkRows(w, 'soru', g); const n = Math.max(3, rows.length);
    for (let i = 0; i < n; i++) {
      const r = rows[i] || {};
      h += `<tr class="${i === 0 ? 'ds' : ''}">${i === 0 ? `<td rowspan="${n + 1}" class="tp-d ${g >= 5 ? 'we' : ''}"><b>${TK_GUN[g]}</b><br>Tarih: ${tkDM(tkDay(w.wk, g))}</td>` : ''}<td>${v(r.ders)}</td><td>${v(r.konu)}</td><td>${v(r.kay)}</td><td class="c">${v(r.q)}</td><td class="c">${v(r.d)}</td><td class="c">${v(r.y)}</td><td class="c">${v(r.b)}</td><td class="c">${c[`sn${g}_${i}`] || ''}</td><td class="c">${v(r.t)}</td></tr>`;
    }
    h += `<tr class="tp-dt"><td colspan="3">Gün toplamı</td><td class="c">${c['sq' + g]}</td><td class="c">${c['sd' + g]}</td><td class="c">${c['sy' + g]}</td><td class="c">${c['sb' + g]}</td><td class="c">${c['snt' + g]}</td><td class="c">${c['st' + g]}</td></tr>`;
  }
  h += `</tbody><tfoot><tr><td colspan="4">HAFTALIK TOPLAM</td><td class="c">${c.QQ}</td><td class="c">${c.DD}</td><td class="c">${c.YY}</td><td class="c">${c.BB}</td><td class="c">${c.NN}</td><td class="c">${c.TT}</td></tr></tfoot></table>
    <p class="tp-tip">İpucu: Yanlış ve boş bıraktığın soruları işaretle; 4. sayfadaki “Eksik Konular” listesine aktar.</p>${foot(2)}</div>`;
  // 3. sayfa
  const ds = c.ders.slice(); while (ds.length < 8) ds.push(null);
  const cols = (TK_SINAV[w.exam] || TK_SINAV.TYT).cols; const den = (w.den || []).filter(Boolean).slice(); while (den.length < 4) den.push(null);
  h += `<div class="pg tp">${head('HAFTALIK ÖZET VE ANALİZ', 'Hafta sonunda doldurulur · Sayılar 2. sayfadan aktarılır')}${sec('Ders Bazında Haftalık Sonuç')}
    <table class="tp-t"><thead><tr><th>Ders</th><th>Hedef soru</th><th>Çözülen</th><th>Doğru</th><th>Yanlış</th><th>Boş</th><th>Net</th><th>Başarı %</th><th>Süre (saat)</th><th style="width:26mm">Hedefe ulaştı mı?</th></tr></thead><tbody>
    ${ds.map(x => x ? `<tr><td>${esc(x.k)}</td><td class="c">${x.hd || ''}</td><td class="c">${x.q || ''}</td><td class="c">${x.d || ''}</td><td class="c">${x.y || ''}</td><td class="c">${x.b || ''}</td><td class="c">${x.q ? fmt1(x.net) : ''}</td><td class="c">${x.bas == null ? '' : '%' + x.bas}</td><td class="c">${x.saat ? fmt1(x.saat) : ''}</td><td class="c">${box(x.ul === true)} Evet ${box(x.ul === false)} Hayır</td></tr>`
    : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="c">${box()} Evet ${box()} Hayır</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>TOPLAM</td><td></td><td class="c">${c.QQ}</td><td class="c">${c.DD}</td><td class="c">${c.YY}</td><td class="c">${c.BB}</td><td class="c">${c.NN}</td><td class="c">${c.Q ? '%' + Math.round(c.D / c.Q * 100) : ''}</td><td class="c">${c.T ? fmt1(c.T / 60) : ''}</td><td></td></tr></tfoot></table>
    ${sec('Günlük Çalışma Süresi Grafiği <small>1 kutu = 30 dk</small>')}<div class="tp-chart">${tkChart(w, c, true)}</div>
    <p class="tp-tip">Kesikli kırmızı çizgi günlük hedef süreyi gösterir; çizginin altında kalan günleri birlikte konuşun.</p>
    ${sec('Bu Haftaki Deneme Sınavları')}<table class="tp-t"><thead><tr><th>Deneme Adı / Yayın</th><th>Tarih</th>${cols.map(k => `<th>${esc(k)}</th>`).join('')}<th>Toplam Net</th><th>Puan</th><th>Sıralama</th></tr></thead><tbody>
    ${den.map(x => x ? `<tr><td>${v(x.ad)}</td><td class="c">${v(x.tar)}</td>${cols.map(k => `<td class="c">${v((x.s || {})[k])}</td>`).join('')}<td class="c"><b>${(() => { const sm = Object.values(x.s || {}).reduce((a, y) => a + n0(y), 0); return sm ? fmt1(sm) : ''; })()}</b></td><td class="c">${v(x.puan)}</td><td class="c">${v(x.sira)}</td></tr>`
    : `<tr><td>&nbsp;</td><td></td>${cols.map(() => '<td></td>').join('')}<td></td><td></td><td></td></tr>`).join('')}</tbody></table>${foot(3)}</div>`;
  // 4. sayfa
  const eks = (w.eks || []).filter(Boolean).slice(); while (eks.length < 8) eks.push(null);
  const trd = x => { if (!x) return ''; const p = x.split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : x; };
  h += `<div class="pg tp">${head('HAFTA SONU DEĞERLENDİRME', 'Eksikler · Öz değerlendirme · Öğretmen görüşü')}${sec('Eksik Konular ve Tekrar Planı <small>Hata nedeni: B = bilgi eksiği · İ = işlem hatası · D = dikkat · S = süre</small>')}
    <table class="tp-t"><thead><tr><th style="width:24mm">Ders</th><th>Konu / Soru tipi</th><th style="width:13mm">Hata nedeni</th><th>Ne yapılacak?</th><th style="width:19mm">Tekrar tarihi</th><th style="width:9mm">1.</th><th style="width:9mm">2.</th></tr></thead><tbody>
    ${eks.map(x => x ? `<tr><td>${v(x.ders)}</td><td>${v(x.konu)}</td><td class="c">${v(x.ne)}</td><td>${v(x.yap)}</td><td class="c">${trd(x.tar)}</td><td class="c">${box(x.y1)}</td><td class="c">${box(x.y2)}</td></tr>` : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td class="c">${box()}</td><td class="c">${box()}</td></tr>`).join('')}</tbody></table>
    ${sec('Öğrenci Öz Değerlendirmesi <small>1 = çok zayıf … 5 = çok iyi</small>')}<div class="tp-oz">${TK_OZ.map(([k, l]) => `<div><span>${l}</span><em>${[1, 2, 3, 4, 5].map(n => `<i class="${(w.oz || {})[k] === n ? 'on' : ''}">${n}</i>`).join('')}</em></div>`).join('')}</div>
    <div class="tp-2"><div><b>Bu hafta en iyi yaptığım şey:</b><p>${v((w.oz || {}).iyi)}</p></div><div><b>Gelecek hafta değiştireceğim şey:</b><p>${v((w.oz || {}).deg)}</p></div></div>
    ${sec('Öğretmen Değerlendirmesi')}<div class="tp-ogr"><div><b>Genel durum:</b> ${TK_GENEL.map(g => `${box((w.ogr || {}).g === g)} ${g}`).join(' &nbsp; ')}</div><p>${v((w.ogr || {}).not)}</p></div>
    ${sec('Gelecek Haftanın Odak Konuları')}${[0, 1, 2, 3].map(i => `<div class="tp-line"><b>${i + 1}</b><span>${v((w.odak || [])[i])}</span></div>`).join('')}${foot(4)}</div>`;
  return h;
}
function tkPrintClass() {
  const cl = get('classes', ui.tk.cid) || {}; const ss = studentsOf(ui.tk.cid);
  return `<style>@page{size:A4 landscape;margin:9mm}</style><div class="pg"><div class="ps-h"><span style="font-size:9pt;color:#666">${esc(settings().school || '')}</span><b>${esc(cl.name || '')} Sınıfı — Haftalık Çalışma Özeti</b><span style="font-size:9pt;color:#666">${tkRange(ui.tk.wk)}</span></div>
    <table class="ps"><thead><tr><th>No</th><th>Ad Soyad</th><th>Hedef sınav</th><th>Hedef (sa)</th><th>Plan (sa)</th><th>Gerçek (sa)</th><th>Uyum</th><th>Hedef soru</th><th>Çözülen</th><th>Doğru</th><th>Yanlış</th><th>Net</th><th>Hedefler</th><th>Öğretmen</th></tr></thead><tbody>
    ${ss.map(s => { const w = get('weeks', tkId(s.id, ui.tk.wk)); const c = w ? tkCalc(w) : null; return `<tr><td><b>${esc(s.no)}</b></td><td class="l">${esc(s.name)}</td>${w ? `<td>${esc(w.exam)}</td><td>${esc(w.hSaat || '')}</td><td>${c.P ? fmt1(c.P / 60) : ''}</td><td>${c.G ? fmt1(c.G / 60) : ''}</td><td>${c.UY}</td><td>${esc(w.hSoru || '')}</td><td>${c.QQ}</td><td>${c.DD}</td><td>${c.YY}</td><td>${c.NN}</td><td>${c.goalsN ? c.goalsOk + '/' + c.goalsN : ''}</td><td>${esc((w.ogr || {}).g || '')}</td>` : '<td colspan="12" style="color:#999">kayıt yok</td>'}</tr>`; }).join('')}</tbody></table></div>`;
}

function tkOnline() { const c = get('classes', ui.tk.cid); return !!(window.Bulut && Bulut.on() && c && c.online); }

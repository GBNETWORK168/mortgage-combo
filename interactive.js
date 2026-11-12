const $i = id => document.getElementById(id);
const f0 = n => Math.round(n).toLocaleString('en-US');
const usd = n => 'US$' + f0(n);
const twd = n => 'NT$' + f0(n);
const wan = n => (n / 1e4).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '萬';
const M1 = Object.keys(M.js_meth)[0], M2 = '金融機構轉帳', SC = 2, TERM = 10;

const DEFAULTS = {
  loan: 5000000,
  rate: 2.2,
  yrs: 30,
  grace: 0,
  ratio: 60,
  yield: 8,
  g: 2,
  age: 50,
  fx: 31
};

function mortgage(P, r, yrs, grace) {
  const i = r / 100 / 12, n = (yrs - grace) * 12, pmt = i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n;
  const io = P * i, bal = y => {
    const m = y * 12 - grace * 12;
    if (m <= 0) return P;
    if (m >= n) return 0;
    return i ? P * Math.pow(1 + i, m) - pmt * (Math.pow(1 + i, m) - 1) / i : P - pmt * m;
  };
  return { pmt, io, bal };
}

function readInputs() {
  return {
    loan: +$i('loan').value,
    rate: +$i('rate').value,
    yrs: +$i('yrs').value,
    grace: +$i('grace').value,
    ratio: +$i('ratio').value,
    yield: +$i('yield').value,
    g: +$i('g').value,
    age: +$i('age').value,
    fx: +$i('fx').value
  };
}

function compute(raw) {
  const loan = +raw.loan, rate = +raw.rate, yrs = +raw.yrs, grace = +raw.grace;
  const ratio = +raw.ratio / 100, yl = +raw.yield / 100, g = +raw.g, age = +raw.age, fx = +raw.fx;
  const mg = mortgage(loan, rate, yrs, grace), fund = loan * ratio, budget = loan - fund, dist = fund * yl / 12;
  const pay1 = grace ? mg.io : mg.pmt, diff1 = dist - pay1, diff2 = dist - mg.pmt;
  const base = { loan, rate, yrs, grace, ratio, yl, g, age, fx, fund, budget, dist, pmt: mg.pmt, io: mg.io, pay1, diff1, diff2, mg };
  const [a0, a1] = M.terms[TERM];
  if (!(Number.isInteger(age) && age >= a0 && age <= a1)) {
    return { ...base, ok: false, error: `PFNC 10年期投保年齡須為 ${a0}~${a1} 歲` };
  }
  let best = null;
  for (let S = 0.5; S <= 60.0001; S = Math.round((S + 0.1) * 10) / 10) {
    const q = quote(g, age, TERM, S, SC, M1, M2);
    if (q && q.p1 * fx <= budget) best = { S, q };
  }
  if (!best) {
    return { ...base, ok: false, error: 'PFNC 預算不足最低保額' };
  }
  const { S, q } = best, key = ENG.key(M, g, age, TERM);
  const R = RPU_project(key, S, TERM, SC, q.p1, q.p2, 1, q.rows.length, age), rows = R.rows, Sp = R.Sp;
  let cs = 0;
  rows.forEach(r => { cs += r.surv; r.cs = cs; });
  const loss1 = q.p1 - rows[0].X, be = rows.find(r => r.X + r.cs >= r.cum);
  rows.forEach(r => {
    const bal = mg.bal(r.t), cov = fund + r.W * fx;
    r.bal = bal; r.cov = cov; r.ok = cov >= bal;
  });
  const d1 = rows[1] || rows[0], c1 = fund + d1.W * fx, b1 = mg.bal(d1.t);
  return { ...base, ok: true, error: '', S, q, key, Sp, rows, loss1, be, d1, c1, b1 };
}

function kv(label, value) {
  return `<div class="kv"><span>${label}</span><span>${value}</span></div>`;
}

function renderCashflow(r) {
  const sd = d => `<span class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '每月多出 ' : '每月不足 '}${twd(Math.abs(d))}</span>`;
  $i('cf').innerHTML = kv(`月配基金本金（${(r.ratio * 100).toFixed(0)}%）`, twd(r.fund)) +
    kv(`每月配息（${(r.yl * 100).toFixed(1)}%÷12）`, twd(r.dist)) +
    (r.grace ? kv(`寬限期 ${r.grace} 年內月付（只繳息）`, twd(r.io)) + kv('寬限期內', sd(r.diff1)) : '') +
    kv(`${r.grace ? '寬限期後' : ''}每月本息攤還（${r.yrs}年，${r.rate}%）`, twd(r.pmt)) +
    kv(`${r.grace ? '寬限期後' : '配息 vs 房貸'}`, sd(r.diff2));
}

function renderPF(r) {
  if (!r.ok) { $i('pf').innerHTML = ''; return; }
  $i('pf').innerHTML = kv('PFNC 預算', twd(r.budget)) +
    kv('原始保額', `US$${r.S.toFixed(1)}萬`) +
    kv('第1年保費（僅繳1年）', `${usd(r.q.p1)}<br><small>≈ ${twd(r.q.p1 * r.fx)}</small>`) +
    kv('減額繳清後保額', `${usd(r.Sp)}<br><small>≈ ${twd(r.Sp * r.fx)}</small>`) +
    kv('第1年末解約金', `${usd(r.rows[0].X)}<br><small>≈ ${twd(r.rows[0].X * r.fx)}</small>`) +
    kv('第1年帳面損失', `<span class="neg">${usd(r.loss1)}（${(r.loss1 / r.q.p1 * 100).toFixed(1)}%）<br><small>≈ ${twd(r.loss1 * r.fx)}</small></span>`) +
    kv('回本年度（解約金＋累計生存金 ≥ 已繳）', r.be ? `第${r.be.t}年（${r.be.age}歲）` : '期間內未回本') +
    (r.Sp < 20000 ? `<div class="warn">⚠️ 減額繳清後保額 ${usd(r.Sp)} 低於 US$20,000，下限需向公司確認</div>` : '');
}

function renderTable(r, year) {
  if (!r.ok) { $i('tb').innerHTML = ''; return; }
  let h = '';
  r.rows.forEach(row => {
    h += `<tr class="${row.t === year ? 'year-on' : ''}"><td>${row.t}<br><small>(${row.age})</small></td><td>${usd(row.X)}<br><small>${twd(row.X * r.fx)}</small></td><td>${usd(row.cs)}<br><small>${twd(row.cs * r.fx)}</small></td><td>${usd(row.W)}<br><small>${twd(row.W * r.fx)}</small></td><td>${twd(row.bal)}</td><td>${row.ok ? '✅' : '⚠️'} ${wan(row.cov)}<br><small>${row.ok ? '可覆蓋' : '差 ' + wan(row.bal - row.cov)}</small></td></tr>`;
  });
  $i('tb').innerHTML = h;
}

function renderCards(r) {
  if (!r.ok) { $i('cards').innerHTML = ''; return; }
  const d1 = r.d1, c1 = r.c1, b1 = r.b1;
  $i('cards').innerHTML = `<div class="c"><small>每月配息 vs 房貸</small><b class="${r.diff2 >= 0 ? 'pos' : 'neg'}">${r.diff2 >= 0 ? '+' : '−'}${twd(Math.abs(r.diff2))}</b><i>配息 ${twd(r.dist)}／月付 ${twd(r.pmt)}${r.grace ? `<br>寬限期內 ${r.diff1 >= 0 ? '+' : '−'}${twd(Math.abs(r.diff1))}` : ''}</i></div>
<div class="c"><small>保單只繳一年</small><b>${usd(r.q.p1)}</b><i>≈ ${twd(r.q.p1 * r.fx)}</i></div>
<div class="c"><small>減額繳清後保額</small><b>${usd(r.Sp)}</b><i>≈ ${twd(r.Sp * r.fx)}</i></div>
<div class="c"><small>第1年帳面損失</small><b class="neg">${usd(r.loss1)}</b><i>≈ ${twd(r.loss1 * r.fx)}；${r.be ? `第${r.be.t}年回本` : '未回本'}</i></div>
<div class="c" style="grid-column:1/-1"><small>萬一身故（第${d1.t}年）：基金本金＋保單身故金 vs 房貸餘額</small><b class="${c1 >= b1 ? 'pos' : 'neg'}">${c1 >= b1 ? '✅' : '⚠️'} ${wan(c1)} vs ${wan(b1)}</b><i>身故金 ${usd(d1.W)}（≈ ${twd(d1.W * r.fx)}）＋基金本金 ${twd(r.fund)}（假設不變）</i></div>`;
}

function renderScripts(r) {
  if (!r.ok) { $i('scripts').innerHTML = ''; return; }
  const rPct = (r.ratio * 100).toFixed(0);
  const yPct = (r.yl * 100).toFixed(1);
  const cf = r.diff2 >= 0
    ? `這份規劃把房貸總額的 ${rPct}%（${twd(r.fund)}）拿來做月配，假設年化配息率 ${yPct}%，每個月大約配出 ${twd(r.dist)}，用來支付房貸月付 ${twd(r.pmt)}，還多出約 ${twd(r.diff2)}。`
    : `這份規劃把房貸總額的 ${rPct}%（${twd(r.fund)}）拿來做月配，假設年化配息率 ${yPct}%，每個月大約配出 ${twd(r.dist)}，但房貸月付是 ${twd(r.pmt)}，還差約 ${twd(Math.abs(r.diff2))}。`;
  const graceLine = r.grace
    ? (r.diff1 >= 0
      ? `寬限期 ${r.grace} 年內每月只繳息 ${twd(r.io)}，這段期間還會多出約 ${twd(r.diff1)}。`
      : `寬限期 ${r.grace} 年內每月只繳息 ${twd(r.io)}，這段期間還差約 ${twd(Math.abs(r.diff1))}。`)
    : '';
  const ins = `保障的部分用紅運優（PFNC）10 年期，只繳第 1 年保費 ${usd(r.q.p1)}（約 ${twd(r.q.p1 * r.fx)}），原始保額 US$${r.S.toFixed(1)}萬；之後改成減額繳清，保額約 ${usd(r.Sp)}。${r.be ? `解約金加上累計生存金，大約在第 ${r.be.t} 年（${r.be.age} 歲）回到已繳保費。` : '在試算期間內，解約金加累計生存金還沒回到已繳保費。'}`;
  const cov = `以第 ${r.d1.t} 年來看，基金本金加上身故金約 ${wan(r.c1)}，當時房貸餘額約 ${wan(r.b1)}，${r.c1 >= r.b1 ? '可以覆蓋這筆房貸。' : '還差 ' + wan(r.b1 - r.c1) + '。'}`;
  $i('scripts').innerHTML =
    `<div class="script-item"><strong>可以這樣跟客戶說</strong><p>${cf}${graceLine ? ' ' + graceLine : ''}</p></div>` +
    `<div class="script-item"><strong>保障怎麼看</strong><p>${ins} ${cov}</p></div>`;
}

function snapshot(r) {
  if (!r.ok) {
    return {
      ok: false, error: r.error,
      fund: r.fund, budget: r.budget, dist: r.dist, pmt: r.pmt, io: r.io, diff1: r.diff1, diff2: r.diff2
    };
  }
  return {
    ok: true, error: '',
    fund: r.fund, budget: r.budget, dist: r.dist, pmt: r.pmt, io: r.io, diff1: r.diff1, diff2: r.diff2,
    S: r.S, p1: r.q.p1, p1twd: r.q.p1 * r.fx, Sp: r.Sp, SpTwd: r.Sp * r.fx,
    X1: r.rows[0].X, X1twd: r.rows[0].X * r.fx, loss1: r.loss1, loss1twd: r.loss1 * r.fx,
    lossPct: r.loss1 / r.q.p1 * 100,
    beYear: r.be ? r.be.t : null, beAge: r.be ? r.be.age : null,
    d1t: r.d1.t, d1W: r.d1.W, d1Wtwd: r.d1.W * r.fx, c1: r.c1, b1: r.b1, cover: r.c1 >= r.b1,
    years: r.rows.length,
    rows: r.rows.map(row => ({
      t: row.t, age: row.age, X: row.X, cs: row.cs, W: row.W, surv: row.surv,
      bal: row.bal, cov: row.cov, ok: row.ok, cum: row.cum
    }))
  };
}

function currentYear() {
  return Math.max(1, Math.round(+$i('year-slider').value || 1));
}

function yearRow(r, t) {
  if (!r.ok || !r.rows.length) return null;
  return r.rows.find(row => row.t === t) || r.rows[Math.min(t, r.rows.length) - 1];
}

function updateHouse(r, t) {
  const row = yearRow(r, t);
  const loan = r.loan;
  const bal = row ? row.bal : (r.mg ? r.mg.bal(t) : loan);
  const paid = loan > 0 ? Math.max(0, Math.min(1, 1 - bal / loan)) : 0;
  const cov = row ? row.cov : r.fund;
  const coverRatio = bal > 0 ? cov / bal : 1;
  const covered = coverRatio >= 1;
  const wallH = 148, wallBottom = 188 + wallH;
  const fillH = wallH * paid;
  const brick = $i('brick-fill');
  brick.setAttribute('y', String(wallBottom - fillH));
  brick.setAttribute('height', String(fillH));
  $i('roof-done').classList.toggle('is-off', paid < 0.999);
  $i('smoke').classList.toggle('is-off', !covered);
  const umb = $i('umbrella');
  const scale = Math.max(0.45, Math.min(1, coverRatio));
  umb.style.transform = `translate(560px,168px) scale(${scale})`;
  umb.style.opacity = String(0.45 + 0.55 * Math.min(1, coverRatio));
  $i('umb-badge').setAttribute('fill', covered ? '#2E7D32' : '#C0392B');
  $i('umb-check').style.display = covered ? '' : 'none';
  $i('coins').style.opacity = r.diff2 >= 0 ? '1' : '0.25';

  const age = row ? row.age : r.age + t - 1;
  $i('scene-year-label').textContent = `第 ${t} 年（${age} 歲）`;
  $i('stat-paid').textContent = (paid * 100).toFixed(1) + '%';
  $i('stat-bal').textContent = `餘額 ${twd(bal)}`;
  $i('stat-cov').textContent = wan(cov);
  $i('stat-cov').className = 'stat-value ' + (covered ? 'pos' : 'neg');
  $i('stat-cov-vs').textContent = covered ? `可覆蓋房貸餘額 ${twd(bal)}` : `還差 ${wan(Math.max(0, bal - cov))}`;
  $i('stat-ratio').textContent = bal <= 0 ? '房貸已還完' : (coverRatio * 100).toFixed(1) + '%';
  $i('stat-ratio').className = 'stat-value ' + (covered ? 'pos' : 'neg');
  $i('stat-ratio-note').textContent = covered ? '身故當下可以蓋住房貸' : '身故當下還蓋不住全部房貸';

  const chipCash = $i('chip-cash');
  if (r.diff2 >= 0) {
    chipCash.textContent = `每月還多出 ${twd(r.diff2)}`;
    chipCash.className = 'chip';
  } else {
    chipCash.textContent = `每月還差 ${twd(Math.abs(r.diff2))}`;
    chipCash.className = 'chip neg';
  }
  const chipCover = $i('chip-cover');
  chipCover.textContent = covered ? '這一層保護傘蓋得住' : '這一層保護傘還蓋不住';
  chipCover.className = 'chip ' + (covered ? 'chip-alt' : 'neg');
}

function syncYearLimits(r) {
  const max = r.ok ? r.rows.length : r.yrs;
  const sl = $i('year-slider'), num = $i('year-num');
  sl.max = num.max = String(max);
  if (+sl.value > max) sl.value = num.value = String(max);
}

function syncFieldDisplays() {
  const loan = +$i('loan').value, rate = +$i('rate').value, ratio = +$i('ratio').value;
  const yl = +$i('yield').value, age = +$i('age').value, fx = +$i('fx').value;
  $i('loan-wan').textContent = wan(loan);
  $i('rate-view').textContent = Number(rate).toFixed(2) + '%';
  $i('ratio-view').textContent = Math.round(ratio) + '%';
  $i('yield-view').textContent = Number(yl).toFixed(1) + '%';
  $i('age-view').textContent = Math.round(age) + ' 歲';
  $i('fx-view').textContent = Number(fx).toFixed(1);
  const a = Math.max(0, Math.min(100, ratio));
  $i('split-a').style.width = a + '%';
  $i('split-a').textContent = a > 8 ? `月配 ${Math.round(a)}%` : '';
  $i('split-b').textContent = (100 - a) > 8 ? `保障 ${Math.round(100 - a)}%` : '';
  $i('split-hint').textContent = `月配本金 ${twd(loan * a / 100)}　保障預算 ${twd(loan * (1 - a / 100))}`;
  document.querySelectorAll('#loan-presets button').forEach(b => {
    b.classList.toggle('on', +b.dataset.loan === loan);
  });
}

function setSeg(id, value) {
  const seg = $i(id);
  seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === String(value)));
}

function applyValues(v, runNow = true) {
  $i('loan').value = $i('loan-slider').value = v.loan;
  $i('rate').value = $i('rate-slider').value = v.rate;
  $i('yrs').value = v.yrs;
  $i('grace').value = v.grace;
  $i('ratio').value = $i('ratio-slider').value = v.ratio;
  $i('yield').value = $i('yield-slider').value = v.yield;
  $i('g').value = v.g;
  $i('age').value = $i('age-slider').value = v.age;
  $i('fx').value = $i('fx-slider').value = v.fx;
  setSeg('yrs-seg', v.yrs);
  setSeg('grace-seg', v.grace);
  setSeg('g-seg', v.g);
  $i('year-slider').value = $i('year-num').value = 1;
  syncFieldDisplays();
  if (runNow) run();
}

function run() {
  syncFieldDisplays();
  const r = compute(readInputs());
  window.__RESULT = snapshot(r);
  window.__RAW = r;
  $i('result-json').textContent = JSON.stringify(window.__RESULT);
  $i('msg').textContent = r.error || '';
  renderCashflow(r);
  renderPF(r);
  renderCards(r);
  renderScripts(r);
  syncYearLimits(r);
  const t = currentYear();
  renderTable(r, t);
  updateHouse(r, t);
  return window.__RESULT;
}

function bindPair(numId, sliderId) {
  const num = $i(numId), sl = $i(sliderId);
  sl.addEventListener('input', () => { num.value = sl.value; run(); });
  num.addEventListener('input', () => { sl.value = num.value; run(); });
}

function bindSeg(segId, inputId) {
  $i(segId).addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    $i(inputId).value = b.dataset.value;
    setSeg(segId, b.dataset.value);
    run();
  });
}

bindPair('loan', 'loan-slider');
bindPair('rate', 'rate-slider');
bindPair('ratio', 'ratio-slider');
bindPair('yield', 'yield-slider');
bindPair('age', 'age-slider');
bindPair('fx', 'fx-slider');
bindSeg('yrs-seg', 'yrs');
bindSeg('grace-seg', 'grace');
bindSeg('g-seg', 'g');
$i('loan-presets').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  $i('loan').value = $i('loan-slider').value = b.dataset.loan;
  run();
});
$i('year-slider').addEventListener('input', () => {
  $i('year-num').value = $i('year-slider').value;
  const r = window.__RAW;
  if (!r) return;
  const t = currentYear();
  updateHouse(r, t);
  renderTable(r, t);
});
$i('year-num').addEventListener('input', () => {
  $i('year-slider').value = $i('year-num').value;
  const r = window.__RAW;
  if (!r) return;
  const t = currentYear();
  updateHouse(r, t);
  renderTable(r, t);
});
$i('btn-reset').addEventListener('click', () => applyValues(DEFAULTS));
$i('btn-example').addEventListener('click', () => applyValues(DEFAULTS));
$i('tg').onclick = function () {
  const o = $i('tw').style.display == 'none';
  $i('tw').style.display = o ? '' : 'none';
  this.textContent = o ? '收合逐年明細 ▴' : '展開逐年明細 ▾';
};

window.runInteractive = run;
window.setInteractiveValues = function (v) {
  applyValues({ ...DEFAULTS, ...v }, true);
  return window.__RESULT;
};
window.getInteractiveResult = function () { return window.__RESULT; };

applyValues(DEFAULTS, true);

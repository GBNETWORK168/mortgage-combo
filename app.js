const $i=id=>document.getElementById(id),f0=n=>Math.round(n).toLocaleString('en-US');
const usd=n=>'US$'+f0(n),twd=n=>'NT$'+f0(n),wan=n=>(n/1e4).toLocaleString('en-US',{maximumFractionDigits:1})+'萬';
const M1=Object.keys(M.js_meth)[0],M2='金融機構轉帳',SC=2,TERM=10;
function mortgage(P,r,yrs,grace){const i=r/100/12,n=(yrs-grace)*12,pmt=i?P*i/(1-Math.pow(1+i,-n)):P/n;
 const io=P*i,bal=y=>{const m=y*12-grace*12;if(m<=0)return P;if(m>=n)return 0;return i?P*Math.pow(1+i,m)-pmt*(Math.pow(1+i,m)-1)/i:P-pmt*m;};return {pmt,io,bal};}
function run(){
 const loan=+$i('loan').value,rate=+$i('rate').value,yrs=+$i('yrs').value,grace=+$i('grace').value,ratio=+$i('ratio').value/100,yl=+$i('yield').value/100,g=+$i('g').value,age=+$i('age').value,fx=+$i('fx').value;
 $i('msg').textContent='';
 const mg=mortgage(loan,rate,yrs,grace),fund=loan*ratio,budget=loan-fund,dist=fund*yl/12;
 const pay1=grace?mg.io:mg.pmt,diff1=dist-pay1,diff2=dist-mg.pmt;
 const sd=d=>`<span class="${d>=0?'pos':'neg'}">${d>=0?'每月多出 ':'每月不足 '}${twd(Math.abs(d))}</span>`;
 $i('cf').innerHTML=`<div class="kv"><span>月配基金本金（${(ratio*100).toFixed(0)}%）</span><span>${twd(fund)}</span></div>
 <div class="kv"><span>每月配息（${(yl*100).toFixed(1)}%÷12）</span><span>${twd(dist)}</span></div>`+
 (grace?`<div class="kv"><span>寬限期 ${grace} 年內月付（只繳息）</span><span>${twd(mg.io)}</span></div><div class="kv"><span>寬限期內</span><span>${sd(diff1)}</span></div>`:'')+
 `<div class="kv"><span>${grace?'寬限期後':''}每月本息攤還（${yrs}年，${rate}%）</span><span>${twd(mg.pmt)}</span></div><div class="kv"><span>${grace?'寬限期後':'配息 vs 房貸'}</span><span>${sd(diff2)}</span></div>`;
 const [a0,a1]=M.terms[TERM];if(!(Number.isInteger(age)&&age>=a0&&age<=a1)){$i('msg').textContent=`PFNC 10年期投保年齡須為 ${a0}~${a1} 歲`;$i('pf').innerHTML='';$i('tb').innerHTML='';$i('cards').innerHTML='';return;}
 let best=null;for(let S=0.5;S<=60.0001;S=Math.round((S+0.1)*10)/10){const q=quote(g,age,TERM,S,SC,M1,M2);if(q&&q.p1*fx<=budget)best={S,q};}
 if(!best){$i('msg').textContent='PFNC 預算不足最低保額';$i('pf').innerHTML='';$i('tb').innerHTML='';$i('cards').innerHTML='';return;}
 const {S,q}=best,key=ENG.key(M,g,age,TERM),R=RPU_project(key,S,TERM,SC,q.p1,q.p2,1,q.rows.length,age),rows=R.rows,Sp=R.Sp;
 let cs=0;rows.forEach(r=>{cs+=r.surv;r.cs=cs;});const loss1=q.p1-rows[0].X,be=rows.find(r=>r.X+r.cs>=r.cum);
 $i('pf').innerHTML=`<div class="kv"><span>PFNC 預算</span><span>${twd(budget)}</span></div>
 <div class="kv"><span>原始保額</span><span>US$${S.toFixed(1)}萬</span></div>
 <div class="kv"><span>第1年保費（僅繳1年）</span><span>${usd(q.p1)}<br><small>≈ ${twd(q.p1*fx)}</small></span></div>
 <div class="kv"><span>減額繳清後保額</span><span>${usd(Sp)}<br><small>≈ ${twd(Sp*fx)}</small></span></div>
 <div class="kv"><span>第1年末解約金</span><span>${usd(rows[0].X)}<br><small>≈ ${twd(rows[0].X*fx)}</small></span></div>
 <div class="kv"><span>第1年帳面損失</span><span class="neg">${usd(loss1)}（${(loss1/q.p1*100).toFixed(1)}%）<br><small>≈ ${twd(loss1*fx)}</small></span></div>
 <div class="kv"><span>回本年度（解約金＋累計生存金 ≥ 已繳）</span><span>${be?`第${be.t}年（${be.age}歲）`:'期間內未回本'}</span></div>`+
 (Sp<20000?`<div class="warn">⚠️ 減額繳清後保額 ${usd(Sp)} 低於 US$20,000，下限需向公司確認</div>`:'');
 let h='';rows.forEach(r=>{const bal=mg.bal(r.t),cov=fund+r.W*fx,ok=cov>=bal;
  h+=`<tr><td>${r.t}<br><small>(${r.age})</small></td><td>${usd(r.X)}<br><small>${twd(r.X*fx)}</small></td><td>${usd(r.cs)}<br><small>${twd(r.cs*fx)}</small></td><td>${usd(r.W)}<br><small>${twd(r.W*fx)}</small></td><td>${twd(bal)}</td><td>${ok?'✅':'⚠️'} ${wan(cov)}<br><small>${ok?'可覆蓋':'差 '+wan(bal-cov)}</small></td></tr>`;});
 $i('tb').innerHTML=h;
 const d1=rows[1]||rows[0],c1=fund+d1.W*fx,b1=mg.bal(d1.t);
 $i('cards').innerHTML=`<div class="c"><small>每月配息 vs 房貸</small><b class="${diff2>=0?'pos':'neg'}">${diff2>=0?'+':'−'}${twd(Math.abs(diff2))}</b><i>配息 ${twd(dist)}／月付 ${twd(mg.pmt)}${grace?`<br>寬限期內 ${diff1>=0?'+':'−'}${twd(Math.abs(diff1))}`:''}</i></div>
 <div class="c"><small>保單只繳一年</small><b>${usd(q.p1)}</b><i>≈ ${twd(q.p1*fx)}</i></div>
 <div class="c"><small>減額繳清後保額</small><b>${usd(Sp)}</b><i>≈ ${twd(Sp*fx)}</i></div>
 <div class="c"><small>第1年帳面損失</small><b class="neg">${usd(loss1)}</b><i>≈ ${twd(loss1*fx)}；${be?`第${be.t}年回本`:'未回本'}</i></div>
 <div class="c" style="grid-column:1/-1"><small>萬一身故（第${d1.t}年）：基金本金＋保單身故金 vs 房貸餘額</small><b class="${c1>=b1?'pos':'neg'}">${c1>=b1?'✅':'⚠️'} ${wan(c1)} vs ${wan(b1)}</b><i>身故金 ${usd(d1.W)}（≈ ${twd(d1.W*fx)}）＋基金本金 ${twd(fund)}（假設不變）</i></div>`;
}
document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',run));
$i('tg').onclick=function(){const o=$i('tw').style.display=='none';$i('tw').style.display=o?'':'none';this.textContent=o?'收合逐年明細 ▴':'展開逐年明細 ▾';};
run();

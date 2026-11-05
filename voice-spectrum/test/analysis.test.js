const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const core=html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
const m={};new Function('m',core+';m.analyze=analyze;m.noteName=noteName;')(m);
const SR=16000;
let seed=99;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff*2-1};
const gauss=()=>{let s=0;for(let i=0;i<6;i++)s+=rnd();return s/Math.sqrt(2)};
// 1周期の波形
const table=(N=2048)=>{const t=new Float64Array(N);const fm=[700,1200,2600];for(let h=1;h<60;h++){let a=1/h;for(const c of fm)a*=1+6/(1+Math.pow((h*200-c)/120,2));for(let i=0;i<N;i++)t[i]+=a*Math.sin(2*Math.PI*h*i/N+h*h*.3)}return t};
const T=table();
// 周期ごとに長さと振幅を乱した発声。jit, shim は局所値(%)の目標
function cyc({f0=200,jit=0,shim=0,noise=0,sec=5,vibHz=0,vibC=0}){const out=[];let t=0,last=0;
 while(t<sec){const f=f0*Math.pow(2,vibC*Math.sin(2*Math.PI*vibHz*t)/1200);const per=SR/f*(1+jit/100*gauss()/1.128);const a=1+shim/100*gauss()/1.128;
  const n=per;const st=out.length;const whole=Math.floor(last+n);
  for(let i=Math.ceil(last);i<=whole;i++){const ph=(i-last)/n*2048;const k=Math.floor(ph)%2048;out[i]=T[k]*a}
  last+=n;t+=n/SR}
 const o=Float32Array.from(out,v=>v||0);let p=0;for(const v of o)p=Math.max(p,Math.abs(v));
 for(let i=0;i<o.length;i++)o[i]=o[i]/p*.5;
 if(noise)for(let i=0;i<o.length;i++)o[i]+=noise*gauss();return o}
const f=(v,d=2)=>v==null||isNaN(v)?'-':(+v).toFixed(d);
const sh=(l,c)=>{const t0=Date.now();const r=m.analyze(cyc(c),'hold');if(r.error)return console.log(l,r.error);
 console.log(l.padEnd(16),'ms',Date.now()-t0,'jit',f(r.cycle?.jitter),'shim',f(r.cycle?.shimmer),'cyc',r.cycle?.cycles,'hnr',f(r.hnr,1),'cpp',f(r.cpp,1),'breath',f(r.scores.breath,0),'rough',f(r.scores.rough,0),'sus',f(r.sustain,1),'tract',f(r.tract,1),'vib',r.vibrato?f(r.vibrato.rate)+'/'+f(r.vibrato.extent,0):'-')};
for(const c of [{f0:110},{f0:200},{f0:320}]) sh('clean'+c.f0,c);
for(const j of [.5,1,2]) sh('jit'+j,{jit:j});
for(const s of [3,6,10]) sh('shim'+s,{shim:s});
for(const j of [1]) for(const f0 of [120,300]) sh('jit1@'+f0,{jit:j,f0});
for(const n of [.005,.015,.03,.06]) sh('noise'+n,{noise:n});
sh('vib5.5/±50c',{vibHz:5.5,vibC:50});sh('vib6/±25',{f0:300,vibHz:6,vibC:25});
sh('short',{sec:2});
// 読む声: 発話を模した音節変調 + ポーズ
function read(){const sec=14,o=new Float32Array(SR*sec),A=.5;let ph=0;let t0=1,dur1=4.5,gap=.6,dur2=3.5;
 for(let i=0;i<o.length;i++){const t=i/SR;const inS=(t>t0&&t<t0+dur1)||(t>t0+dur1+gap&&t<t0+dur1+gap+dur2);if(!inS)continue;
  const f=170*Math.pow(2,(3*Math.sin(t*1.7)+1.5*Math.sin(t*4.1))/12);ph+=f/SR;const k=Math.floor((ph%1)*2048);
  const env=.5+.5*Math.sin(2*Math.PI*3.5*t);o[i]=T[k]*(.25+.75*env)}
 let p=0;for(const v of o)p=Math.max(p,Math.abs(v));return o.map(v=>v/p*A)}
let r=m.analyze(read(),'read');console.log('read',r.error||{f0:f(r.f0,0),span:f(r.span,1),pauses:r.pauses,share:f(r.pauseShare),rate:f(r.moraRate,1),inton:f(r.intonation),pspan:f(r.pitchSpan,1),dyn:f(r.dynamics,1),scores:Object.fromEntries(Object.entries(r.scores).map(([k,v])=>[k,Math.round(v)]))});
// 音域: 90Hz->700Hz->90Hz
function glide(brk){const sec=10,o=new Float32Array(SR*sec);let ph=0;for(let i=0;i<o.length;i++){const t=i/SR;if(t<.5||t>9.5)continue;const u=1-Math.abs((t-5)/4.5);let st=u*36;if(brk&&st>18)st+=4;const f=87*Math.pow(2,st/12);ph+=f/SR;const k=Math.floor((ph%1)*2048);o[i]=T[k]}
 let p=0;for(const v of o)p=Math.max(p,Math.abs(v));return o.map(v=>v/p*.5)}
for(const b of [0,1]){r=m.analyze(glide(b),'glide');console.log('glide',b,r.error||{low:f(r.low,0)+m.noteName(r.low),high:f(r.high,0)+m.noteName(r.high),st:f(r.rangeSt,1),breaks:r.breaks.map(x=>m.noteName(x.at)+' '+f(x.size,1))})}

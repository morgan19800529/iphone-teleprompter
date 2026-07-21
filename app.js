const $=id=>document.getElementById(id);
const app=$('app'),input=$('scriptInput'),promptText=$('promptText'),teleprompter=$('teleprompter');
const playBtn=$('playPauseBtn'),speed=$('speedRange'),font=$('fontRange'),guide=$('guideBtn');
let playing=false,lastTime=0,rafId=null;
const sample='47岁，我住在清迈。\n\n很多人以为，陪孩子读书，是一段轻松的生活。\n\n但真正让我焦虑的，不是现在辛苦，而是孩子毕业以后，我是谁。\n\n所以我决定，从今天开始重新学习、重新创作，也重新开始。';
const settings=JSON.parse(localStorage.getItem('teleprompter-settings')||'{}');
input.value=localStorage.getItem('teleprompter-script')||'';
speed.value=settings.speed||30;font.value=settings.font||44;
function save(){localStorage.setItem('teleprompter-script',input.value);localStorage.setItem('teleprompter-settings',JSON.stringify({speed:speed.value,font:font.value}))}
function apply(){promptText.style.fontSize=font.value+'px';$('speedValue').value=speed.value;$('fontValue').value=font.value;save()}
function step(t){if(!playing)return;const dt=Math.min((t-lastTime)/1000,.05);lastTime=t;teleprompter.scrollTop+=Number(speed.value)*dt;if(teleprompter.scrollTop+teleprompter.clientHeight>=teleprompter.scrollHeight-2){pause();return}rafId=requestAnimationFrame(step)}
function play(){playing=true;playBtn.textContent='Ⅱ';lastTime=performance.now();rafId=requestAnimationFrame(step)}
function pause(){playing=false;playBtn.textContent='▶';if(rafId)cancelAnimationFrame(rafId)}
async function countdown(){const el=$('countdown');el.hidden=false;for(let n=3;n>0;n--){el.textContent=n;await new Promise(r=>setTimeout(r,700))}el.textContent='开始';await new Promise(r=>setTimeout(r,350));el.hidden=true;play()}
$('startBtn').onclick=()=>{const text=input.value.trim();if(!text){input.focus();return}promptText.textContent=text;teleprompter.scrollTop=0;app.classList.add('is-reading');save();apply();countdown()};
$('editBtn').onclick=()=>{pause();app.classList.remove('is-reading')};
playBtn.onclick=()=>playing?pause():play();
$('restartBtn').onclick=()=>{pause();teleprompter.scrollTo({top:0,behavior:'smooth'})};
$('sampleBtn').onclick=()=>{input.value=sample;save()};
$('clearBtn').onclick=()=>{input.value='';save();input.focus()};
speed.oninput=apply;font.oninput=apply;input.oninput=save;
$('mirrorBtn').onclick=e=>{app.classList.toggle('mirror');const on=app.classList.contains('mirror');e.currentTarget.classList.toggle('active',on);e.currentTarget.textContent='镜像：'+(on?'开':'关');e.currentTarget.setAttribute('aria-pressed',on)};
guide.onclick=e=>{const on=guide.getAttribute('aria-pressed')!=='true';guide.setAttribute('aria-pressed',on);guide.classList.toggle('active',on);guide.textContent='引导线：'+(on?'开':'关');document.querySelector('.reading-guide').style.display=on?'block':'none'};
$('contrastBtn').onclick=e=>{app.classList.toggle('contrast');const on=app.classList.contains('contrast');e.currentTarget.classList.toggle('active',on);e.currentTarget.setAttribute('aria-pressed',on)};
$('fullscreenBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
document.addEventListener('keydown',e=>{if(!app.classList.contains('is-reading'))return;if(e.code==='Space'){e.preventDefault();playing?pause():play()}if(e.code==='ArrowUp')teleprompter.scrollTop-=80;if(e.code==='ArrowDown')teleprompter.scrollTop+=80});
apply();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

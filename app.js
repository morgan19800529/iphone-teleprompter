/* Morgan iPhone 提词器 */
const $ = id => document.getElementById(id);

const app = $('app');
const input = $('scriptInput');
const promptText = $('promptText');
const teleprompter = $('teleprompter');
const playBtn = $('playPauseBtn');
const speed = $('speedRange');
const font = $('fontRange');
const guide = $('guideBtn');
const hint = $('tapHint');

const sample = '47岁，我住在清迈。\n\n很多人以为，陪孩子读书，是一段轻松的生活。\n\n但真正让我焦虑的，不是现在辛苦，而是孩子毕业以后，我是谁。\n\n所以我决定，从今天开始重新学习、重新创作，也重新开始。';

/* ---------- 状态 ---------- */
let playing = false;      // 用户意图：是否处于播放
let suspended = false;    // 手指触摸期间临时挂起自动滚动
let lastTime = 0;
let rafId = null;
let wakeLock = null;
let settleTimer = null;

const settings = JSON.parse(localStorage.getItem('teleprompter-settings') || '{}');
input.value = localStorage.getItem('teleprompter-script') || '';
speed.value = settings.speed || 30;
font.value = settings.font || 44;

function save() {
  localStorage.setItem('teleprompter-script', input.value);
  localStorage.setItem('teleprompter-settings', JSON.stringify({ speed: speed.value, font: font.value }));
}

function apply() {
  promptText.style.fontSize = font.value + 'px';
  $('speedValue').value = speed.value;
  $('fontValue').value = font.value;
  save();
}

/* ---------- 防息屏 Wake Lock ---------- */
async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try { await wakeLock.release(); } catch {}
  wakeLock = null;
}

/* ---------- 滚动引擎 ---------- */
function step(t) {
  if (!playing) return;
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;

  if (!suspended) {
    teleprompter.scrollTop += Number(speed.value) * dt;
    if (teleprompter.scrollTop + teleprompter.clientHeight >= teleprompter.scrollHeight - 2) {
      pause();
      return;
    }
  }
  rafId = requestAnimationFrame(step);
}

function play() {
  playing = true;
  playBtn.textContent = 'Ⅱ';
  playBtn.setAttribute('aria-label', '暂停');
  lastTime = performance.now();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(step);
  acquireWakeLock();
}

function pause() {
  playing = false;
  playBtn.textContent = '▶';
  playBtn.setAttribute('aria-label', '播放');
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  releaseWakeLock();
}

function toggle() { playing ? pause() : play(); }

function flashHint(text) {
  if (!hint) return;
  hint.textContent = text;
  hint.classList.add('show');
  clearTimeout(flashHint._t);
  flashHint._t = setTimeout(() => hint.classList.remove('show'), 650);
}

/* ---------- 触摸：轻点切换播放 / 滑动手动定位 ---------- */
let touchStart = null;

teleprompter.addEventListener('pointerdown', e => {
  touchStart = { x: e.clientX, y: e.clientY, t: performance.now() };
  suspended = true;           // 手指按下即挂起自动滚动，避免和手动滑动打架
  clearTimeout(settleTimer);
});

teleprompter.addEventListener('pointerup', e => {
  if (!touchStart) return;
  const dx = Math.abs(e.clientX - touchStart.x);
  const dy = Math.abs(e.clientY - touchStart.y);
  const dt = performance.now() - touchStart.t;
  touchStart = null;

  const isTap = dx < 10 && dy < 10 && dt < 300;

  if (isTap) {
    suspended = false;
    toggle();
    flashHint(playing ? '继续' : '暂停');
  } else {
    // 滑动结束：等惯性滚动停下来再恢复自动滚动
    settleTimer = setTimeout(() => {
      suspended = false;
      lastTime = performance.now();
    }, 320);
  }
});

teleprompter.addEventListener('pointercancel', () => {
  touchStart = null;
  settleTimer = setTimeout(() => { suspended = false; lastTime = performance.now(); }, 320);
});

/* ---------- 倒计时 ---------- */
async function countdown() {
  const el = $('countdown');
  el.hidden = false;
  for (let n = 3; n > 0; n--) {
    el.textContent = n;
    await new Promise(r => setTimeout(r, 700));
  }
  el.textContent = '开始';
  await new Promise(r => setTimeout(r, 350));
  el.hidden = true;
  play();
}

/* ---------- 交互绑定 ---------- */
$('startBtn').onclick = () => {
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  promptText.textContent = text;
  teleprompter.scrollTop = 0;
  app.classList.add('is-reading');
  save();
  apply();
  countdown();
};

$('editBtn').onclick = () => { pause(); app.classList.remove('is-reading'); };
playBtn.onclick = toggle;
$('restartBtn').onclick = () => { pause(); teleprompter.scrollTo({ top: 0, behavior: 'smooth' }); };
$('sampleBtn').onclick = () => { input.value = sample; save(); };
$('clearBtn').onclick = () => { input.value = ''; save(); input.focus(); };

speed.oninput = apply;
font.oninput = apply;
input.oninput = save;

$('mirrorBtn').onclick = e => {
  app.classList.toggle('mirror');
  const on = app.classList.contains('mirror');
  e.currentTarget.classList.toggle('active', on);
  e.currentTarget.textContent = '镜像：' + (on ? '开' : '关');
  e.currentTarget.setAttribute('aria-pressed', on);
};

guide.onclick = () => {
  const on = guide.getAttribute('aria-pressed') !== 'true';
  guide.setAttribute('aria-pressed', on);
  guide.classList.toggle('active', on);
  guide.textContent = '引导线：' + (on ? '开' : '关');
  document.querySelector('.reading-guide').style.display = on ? 'block' : 'none';
};

$('contrastBtn').onclick = e => {
  app.classList.toggle('contrast');
  const on = app.classList.contains('contrast');
  e.currentTarget.classList.toggle('active', on);
  e.currentTarget.setAttribute('aria-pressed', on);
};

$('fullscreenBtn').onclick = async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {}
};

/* ---------- 前后台切换 ---------- */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
  } else if (playing) {
    acquireWakeLock();   // iOS 回到前台后 wake lock 会失效，需重申请
  }
});

document.addEventListener('keydown', e => {
  if (!app.classList.contains('is-reading')) return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'ArrowUp') teleprompter.scrollTop -= 80;
  if (e.code === 'ArrowDown') teleprompter.scrollTop += 80;
});

apply();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

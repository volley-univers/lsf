// app.js — orchestre l'interface : accueil, parcours, écran de pratique.
// Dépend de window.SIGNS / window.LESSONS / window.matchSign / window.extractFeatures
// (définis dans signs.js) et de window.HandTracking (défini dans hand-tracking.js).

const STORAGE_KEY = 'signeduo-progress-v1';

function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { completed: [], xp: 0, streak: 0, lastActiveDay: null };
    return JSON.parse(raw);
  }catch(e){
    return { completed: [], xp: 0, streak: 0, lastActiveDay: null };
  }
}

function saveProgress(p){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function todayKey(){
  return new Date().toISOString().slice(0,10);
}

function bumpStreak(progress){
  const today = todayKey();
  if(progress.lastActiveDay === today) return; // déjà compté aujourd'hui
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  if(progress.lastActiveDay === yesterday){
    progress.streak += 1;
  } else {
    progress.streak = 1;
  }
  progress.lastActiveDay = today;
}

let progress = loadProgress();

// ---------- Éléments du DOM ----------
const els = {
  home: document.getElementById('view-home'),
  lesson: document.getElementById('view-lesson'),
  lessonPath: document.getElementById('lesson-path'),
  statStreak: document.getElementById('stat-streak'),
  statXp: document.getElementById('stat-xp'),
  btnStart: document.getElementById('btn-start'),
  btnGoHome: document.getElementById('btn-go-home'),
  btnExitLesson: document.getElementById('btn-exit-lesson'),
  btnBackToPath: document.getElementById('btn-back-to-path'),
  btnEnableCam: document.getElementById('btn-enable-cam'),
  camPlaceholder: document.getElementById('camera-placeholder'),
  video: document.getElementById('webcam'),
  overlay: document.getElementById('overlay'),
  progressFill: document.getElementById('lesson-progress-fill'),
  comboCount: document.getElementById('combo-count'),
  targetCategory: document.getElementById('target-category'),
  targetGlyph: document.getElementById('target-glyph'),
  targetHint: document.getElementById('target-hint'),
  targetNote: document.getElementById('target-note'),
  feedback: document.getElementById('feedback'),
  practiceScreen: document.querySelector('.lesson-screen'),
  completeScreen: document.getElementById('lesson-complete'),
  completeXp: document.getElementById('complete-xp-earned'),
};

// ---------- Rendu du parcours ----------
function renderStats(){
  els.statStreak.textContent = progress.streak;
  els.statXp.textContent = progress.xp;
}

function isLessonUnlocked(index){
  if(index === 0) return true;
  return progress.completed.includes(LESSONS[index - 1].id);
}

function renderPath(){
  els.lessonPath.innerHTML = '';
  let lastUnit = null;
  LESSONS.forEach((lesson, i) => {
    if(lesson.unit !== lastUnit){
      const h = document.createElement('p');
      h.className = 'unit-heading';
      h.textContent = lesson.unit;
      els.lessonPath.appendChild(h);
      lastUnit = lesson.unit;
    }
    const done = progress.completed.includes(lesson.id);
    const unlocked = isLessonUnlocked(i);

    const btn = document.createElement('button');
    btn.className = 'node' + (done ? ' done' : unlocked ? ' next' : ' locked');
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <div class="node-badge">${done ? '✓' : lesson.signs[0] ? (SIGNS[lesson.signs[0]].glyph) : '·'}</div>
      <div class="node-body">
        <p class="node-title">${lesson.title}</p>
        <p class="node-sub">${lesson.signs.length} signes</p>
      </div>
      ${done ? '<span class="node-check">✓</span>' : ''}
    `;
    btn.addEventListener('click', () => startLesson(lesson));
    els.lessonPath.appendChild(btn);
  });
}

// ---------- Squelette décoratif du hero ----------
function renderHeroSkeleton(){
  const svg = document.getElementById('hero-skeleton');
  const points = [
    [150,260],[110,200],[95,150],[130,60],[150,90],
    [150,150],[150,40],
    [180,150],[185,45],
    [210,155],[218,60],
    [235,165],[245,85],
  ];
  const bones = [[0,1],[1,2],[2,3],[3,4],[1,5],[5,6],[1,7],[7,8],[1,9],[9,10],[1,11],[11,12]];
  let html = '';
  bones.forEach(([a,b]) => {
    html += `<line class="hs-line" x1="${points[a][0]}" y1="${points[a][1]}" x2="${points[b][0]}" y2="${points[b][1]}"/>`;
  });
  points.forEach((p, i) => {
    html += `<circle class="hs-dot hs-pulse" style="animation-delay:${(i*0.12).toFixed(2)}s" cx="${p[0]}" cy="${p[1]}" r="5.5"/>`;
  });
  svg.innerHTML = html;
}

// ---------- Navigation ----------
function showHome(){
  els.home.classList.remove('hidden');
  els.lesson.classList.add('hidden');
  window.HandTracking.stopCamera();
  renderPath();
  renderStats();
}

function showLesson(){
  els.home.classList.add('hidden');
  els.lesson.classList.remove('hidden');
  els.practiceScreen.classList.remove('hidden');
  els.completeScreen.classList.add('hidden');
}

els.btnStart.addEventListener('click', () => {
  const next = LESSONS.find((l, i) => isLessonUnlocked(i) && !progress.completed.includes(l.id));
  startLesson(next || LESSONS[0]);
});
els.btnGoHome.addEventListener('click', showHome);
els.btnExitLesson.addEventListener('click', showHome);
els.btnBackToPath.addEventListener('click', showHome);

// ---------- Boucle de pratique ----------
let currentLesson = null;
let currentIndex = 0;
let holdFrames = 0;
const HOLD_FRAMES_NEEDED = 18; // ~ 0.6s à 30fps, évite les faux positifs

// Source de vérité unique pour savoir si la caméra tourne réellement :
// on regarde le flux vidéo lui-même plutôt qu'un drapeau qui peut devenir périmé.
function isCameraActive(){
  return !!(els.video.srcObject && els.video.srcObject.active);
}

function resetCameraButton(){
  els.btnEnableCam.disabled = false;
  els.btnEnableCam.textContent = 'Activer la caméra';
  els.camPlaceholder.querySelector('p').textContent =
    "Autorise la caméra pour commencer à t'entraîner.";
}

async function ensureCameraRunning(){
  if(isCameraActive()){
    els.camPlaceholder.classList.add('hidden');
    return;
  }
  resetCameraButton();
  els.camPlaceholder.classList.remove('hidden');
}

function startLesson(lesson){
  currentLesson = lesson;
  currentIndex = 0;
  holdFrames = 0;
  els.comboCount.textContent = '0';
  showLesson();
  showTarget();
  ensureCameraRunning();
}

els.btnEnableCam.addEventListener('click', async () => {
  els.btnEnableCam.disabled = true;
  els.btnEnableCam.textContent = 'Activation…';
  try{
    await window.HandTracking.startCamera(els.video, els.overlay, onFrame);
    els.camPlaceholder.classList.add('hidden');
  }catch(err){
    els.camPlaceholder.querySelector('p').textContent =
      "Impossible d'accéder à la caméra. Vérifie les autorisations de ton navigateur.";
    els.btnEnableCam.disabled = false;
    els.btnEnableCam.textContent = 'Réessayer';
  }
});

function showTarget(){
  const signId = currentLesson.signs[currentIndex];
  const sign = SIGNS[signId];
  els.targetCategory.textContent = sign.category;
  els.targetGlyph.textContent = sign.glyph;
  els.targetHint.textContent = sign.hint;
  els.targetNote.textContent = sign.note || '';
  els.feedback.textContent = 'Montre ta main à la caméra';
  els.feedback.className = 'feedback';
  els.progressFill.style.width = `${(currentIndex / currentLesson.signs.length) * 100}%`;
  holdFrames = 0;
}

function onFrame(result){
  if(!currentLesson) return;
  const signId = currentLesson.signs[currentIndex];
  const sign = SIGNS[signId];

  if(!result.landmarks || result.landmarks.length === 0){
    els.feedback.textContent = 'Montre ta main à la caméra';
    els.feedback.className = 'feedback';
    holdFrames = 0;
    return;
  }

  const features = window.extractFeatures(result.landmarks[0]);
  const { score, isMatch } = window.matchSign(features, sign);

  if(isMatch){
    holdFrames++;
    els.feedback.textContent = `Continue à tenir la position… ${Math.min(100, Math.round((holdFrames/HOLD_FRAMES_NEEDED)*100))}%`;
    els.feedback.className = 'feedback good';
    if(holdFrames >= HOLD_FRAMES_NEEDED){
      onSignSuccess();
    }
  } else if(score >= 0.6){
    els.feedback.textContent = 'Presque ! Ajuste tes doigts.';
    els.feedback.className = 'feedback close';
    holdFrames = 0;
  } else {
    els.feedback.textContent = 'Essaie de reproduire la forme cible';
    els.feedback.className = 'feedback';
    holdFrames = 0;
  }
}

function onSignSuccess(){
  progress.xp += 10;
  els.comboCount.textContent = String(parseInt(els.comboCount.textContent, 10) + 1);
  renderStats();
  saveProgress(progress);

  currentIndex++;
  if(currentIndex >= currentLesson.signs.length){
    finishLesson();
  } else {
    showTarget();
  }
}

function finishLesson(){
  els.progressFill.style.width = '100%';
  if(!progress.completed.includes(currentLesson.id)){
    progress.completed.push(currentLesson.id);
    progress.xp += 20; // bonus de fin de leçon
  }
  bumpStreak(progress);
  saveProgress(progress);
  renderStats();

  els.practiceScreen.classList.add('hidden');
  els.completeScreen.classList.remove('hidden');
  els.completeXp.textContent = `+${currentLesson.signs.length * 10 + 20} XP`;
  currentLesson = null;
}

// ---------- Démarrage ----------
renderHeroSkeleton();
renderStats();
renderPath();

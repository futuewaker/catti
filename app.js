/* ===========================================================
   CATTI · 猫格测试 — app.js v2
   =========================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // Mock fallbacks (used only if JSON fetch fails — e.g. file://)
  // ------------------------------------------------------------
  const MOCK_QUESTIONS = [
    {
      id: 1, dim: 'EI', text: '周末到了，你会选择？',
      bubble: '一个人最诚实的时刻', avatar: 'images/black_cat.png',
      options: [
        { label: '呼朋唤友约饭唱K，越热闹越舒服', score: 1 },
        { label: '看心情，有局就去没局也不强求', score: 0 },
        { label: '关灯拉窗帘，一个人和我的猫',     score: -1 }
      ]
    }
  ];
  const MOCK_CATS = [
    {
      id: 'orange', name: '橘猫', name_title: '大橘大利的', image: 'images/orange.png',
      slogan: '十橘九胖，心宽路远',
      tags: ['朋友不多但都是精选', '懒是战略不是缺点', '白天乖巧晚上上头', '随遇而安但不将就'],
      vector: [2, 0, -1, 0],
      interpretation: '你是朋友圈里的小太阳，自带松弛感。你不是懒，只是比别人更早想通了。'
    }
  ];

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const state = {
    view: 'intro',
    questions: [],
    cats: [],
    currentIdx: 0,
    answers: [],        // [{id, dim, score}]
    result: null,
    userVec: [0, 0, 0, 0],
    isAnimating: false
  };

  const DIM_IDX = { EI: 0, PL: 1, TF: 2, JS: 3, MD: 4, NZ: 5 };
  // SBTI-style dimension labels (更戏剧化/网感化)
  const DIM_LABELS = ['社牛浓度', '干就完了指数', '讲道理指数', '强迫症指数', '恋爱脑指数', '内耗指数'];
  const DIM_COUNT = DIM_LABELS.length;
  const ANIM_MS = 280;
  const FLASH_MS = 320;
  const NEXT_DELAY = 260;

  // ------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    views: {
      intro:  $('view-intro'),
      quiz:   $('view-quiz'),
      result: $('view-result')
    },
    // intro
    scrollRows: [$('scroll-row-1'), $('scroll-row-2'), $('scroll-row-3')],
    btnStart:     $('btn-start'),
    // quiz
    btnHome:         $('btn-home'),
    progressFill:    $('progress-fill'),
    progressCurrent: $('progress-current'),
    progressTotal:   $('progress-total'),
    scenarioAvatar:  $('scenario-avatar-img'),
    scenarioAvatarBox: document.querySelector('.scenario-avatar'),
    scenarioBubble:  $('scenario-bubble'),
    quizCard:        $('quiz-card'),
    qText:           $('q-text'),
    optionsList:     $('options-list'),
    btnPrev:         $('btn-prev'),
    btnNext:         $('btn-next'),
    // result
    resultImage:          $('result-image'),
    resultNameTitle:      $('result-name-title'),
    resultName:           $('result-name'),
    resultMdValue:        $('result-md-value'),
    resultMdNote:         $('result-md-note'),
    resultNzValue:        $('result-nz-value'),
    resultNzNote:         $('result-nz-note'),
    resultQuote:          $('result-quote'),
    resultTags:           $('result-tags'),
    resultQuickReview:    $('result-quick-review'),
    resultInterpretation: $('result-interpretation'),
    resultCatchphrases:   $('result-catchphrases'),
    radarCanvas:          $('radar-canvas'),
    btnRestart:           $('btn-restart'),
    btnShare:             $('btn-share'),
    // inline share image
    shareImageFrame:       $('share-image-frame'),
    shareImagePlaceholder: $('share-image-placeholder'),
    shareImage:            $('share-image'),
    shareHint:             $('share-hint'),
    // hidden share card
    shareCardWrap: $('share-card-wrap'),
    shareCard:     $('share-card'),
    scAvatar:      $('sc-avatar'),
    scNameTitle:   $('sc-name-title'),
    scName:        $('sc-name'),
    scPunchline:   $('sc-punchline'),
    scTagsGrid:    $('sc-tags-grid'),
    scQuickReview: $('sc-quick-review')
  };

  // ------------------------------------------------------------
  // Init — load JSON + render
  // ------------------------------------------------------------
  async function init() {
    const [questions, cats] = await Promise.all([
      loadJSON('data/questions.json', MOCK_QUESTIONS),
      loadJSON('data/cats.json',      MOCK_CATS)
    ]);
    state.questions = Array.isArray(questions) && questions.length ? questions : MOCK_QUESTIONS;
    state.cats      = Array.isArray(cats)      && cats.length      ? cats      : MOCK_CATS;

    el.progressTotal.textContent = state.questions.length;

    renderIntroGallery();
    bindEvents();
    render();
  }

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[CATTI] fallback to mock for', path, err.message);
      return fallback;
    }
  }

  // ------------------------------------------------------------
  // Intro marquee (3 rows of scrolling pixel cats)
  // Each row contains all 24 cats × 2 for seamless -50% loop.
  // ------------------------------------------------------------
  function renderIntroGallery() {
    if (!el.scrollRows || !el.scrollRows.every(Boolean)) return;
    const ids = state.cats.map(c => c.id);
    if (!ids.length) return;

    // Shuffle helper (stable per session)
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const third = Math.ceil(ids.length / 3);
    const groups = [
      shuffle(ids).slice(0, third + 2),
      shuffle(ids).slice(0, third + 2),
      shuffle(ids).slice(0, third + 2)
    ];

    el.scrollRows.forEach((row, i) => {
      if (!row) return;
      // duplicate the list so a -50% translate wraps seamlessly
      const list = groups[i].concat(groups[i]);
      row.innerHTML = list.map(id => {
        const cat = state.cats.find(c => c.id === id);
        const src = cat ? cat.image : ('images/' + id + '.png');
        return '<div class="pet"><img src="' + src + '" alt=""></div>';
      }).join('');
    });
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  function bindEvents() {
    el.btnStart    && el.btnStart.addEventListener('click', startQuiz);
    el.btnHome     && el.btnHome.addEventListener('click',  goHome);
    el.btnPrev     && el.btnPrev.addEventListener('click',  previousQuestion);
    el.btnNext     && el.btnNext.addEventListener('click',  nextQuestion);
    el.btnRestart  && el.btnRestart.addEventListener('click', restart);
    el.btnShare    && el.btnShare.addEventListener('click',  shareLink);
  }

  // ------------------------------------------------------------
  // View routing
  // ------------------------------------------------------------
  function setView(name) {
    state.view = name;
    Object.entries(el.views).forEach(([k, node]) => {
      if (!node) return;
      node.classList.toggle('active', k === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    if (state.view === 'quiz')   renderQuiz();
    if (state.view === 'result') renderResult();
    setView(state.view);
  }

  // ------------------------------------------------------------
  // Intro actions
  // ------------------------------------------------------------
  function startQuiz() {
    state.view = 'quiz';
    state.currentIdx = 0;
    state.answers = [];
    render();
  }

  function goHome() {
    if (state.isAnimating) return;
    state.view = 'intro';
    render();
  }

  // ------------------------------------------------------------
  // QUIZ
  // ------------------------------------------------------------
  function renderQuiz() {
    renderProgress();
    renderScenarioHint();
    renderQuestion();
    updateNavButtons();
  }

  function renderProgress() {
    const total = state.questions.length;
    const current = state.currentIdx + 1;
    el.progressTotal.textContent = total;
    el.progressCurrent.textContent = current;
    const pct = Math.round((current / total) * 100);
    el.progressFill.style.width = pct + '%';
  }

  function renderScenarioHint() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.scenarioBubble.textContent = q.bubble || '';
    if (q.avatar) {
      el.scenarioAvatar.src = q.avatar;
      el.scenarioAvatar.alt = '';
    }
    // Replay pop animation
    if (el.scenarioAvatarBox) {
      el.scenarioAvatarBox.classList.remove('pop');
      // eslint-disable-next-line no-unused-expressions
      el.scenarioAvatarBox.offsetHeight;
      el.scenarioAvatarBox.classList.add('pop');
    }
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.qText.textContent = q.text || '';

    const prev = state.answers[state.currentIdx];

    el.optionsList.innerHTML = '';
    (q.options || []).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'option';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.score = String(opt.score);
      if (prev && prev.score === opt.score) li.classList.add('selected');
      li.innerHTML =
        '<span class="option-bullet" aria-hidden="true">' + String.fromCharCode(65 + i) + '</span>' +
        '<span class="option-label"></span>';
      li.querySelector('.option-label').textContent = opt.label;

      const handler = function (e) {
        if (e.type === 'keydown') {
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          e.preventDefault();
        }
        onSelectOption(li, opt.score);
      };
      li.addEventListener('click', handler);
      li.addEventListener('keydown', handler);

      el.optionsList.appendChild(li);
    });
  }

  function onSelectOption(node, score) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    // clear others, flash clicked
    [...el.optionsList.children].forEach(c => {
      c.classList.remove('selected', 'flashing');
    });
    node.classList.add('flashing');

    // record answer
    const q = state.questions[state.currentIdx];
    state.answers[state.currentIdx] = { id: q.id, dim: q.dim, score: score };

    setTimeout(function () {
      node.classList.remove('flashing');
      node.classList.add('selected');

      // auto-advance (or finish)
      setTimeout(function () {
        if (state.currentIdx < state.questions.length - 1) {
          animateTo(+1);
        } else {
          state.isAnimating = false;
          computeResult();
        }
      }, NEXT_DELAY);
    }, FLASH_MS);
  }

  function previousQuestion() {
    if (state.isAnimating || state.currentIdx === 0) return;
    animateTo(-1);
  }

  function nextQuestion() {
    if (state.isAnimating) return;
    // enabled only when current has an answer
    if (!state.answers[state.currentIdx]) return;
    if (state.currentIdx < state.questions.length - 1) {
      animateTo(+1);
    } else {
      computeResult();
    }
  }

  function animateTo(direction) {
    state.isAnimating = true;
    const card = el.quizCard;
    const outX = direction === 1 ? -28 : 28;
    const inX  = direction === 1 ? 28 : -28;

    card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
    card.style.transform  = 'translateX(' + outX + 'px)';
    card.style.opacity    = '0';

    setTimeout(function () {
      state.currentIdx += direction;

      card.style.transition = 'none';
      card.style.transform  = 'translateX(' + inX + 'px)';
      card.style.opacity    = '0';

      renderQuiz();

      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;

      card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
      card.style.transform  = 'translateX(0)';
      card.style.opacity    = '1';

      setTimeout(function () {
        state.isAnimating = false;
        card.style.transition = '';
        card.style.transform  = '';
        card.style.opacity    = '';
      }, ANIM_MS + 40);
    }, ANIM_MS);
  }

  function updateNavButtons() {
    el.btnPrev.disabled = state.currentIdx === 0;
    const hasAnswer = !!state.answers[state.currentIdx];
    const isLast = state.currentIdx === state.questions.length - 1;
    el.btnNext.disabled = !hasAnswer;
    // Label adjusts on last question
    const nextLabel = el.btnNext.querySelector('span');
    if (nextLabel) nextLabel.textContent = isLast ? '看结果' : '下一题';
  }

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------
  function computeResult() {
    // 1. Compute userVec (radar chart + highlight %, NOT used for matching)
    const userVec = new Array(DIM_COUNT).fill(0);
    state.answers.forEach(function (a) {
      if (!a) return;
      const idx = DIM_IDX[a.dim];
      if (typeof idx === 'number') userVec[idx] += a.score;
    });
    state.userVec = userVec;

    // 2. Tag voting: count hits per cat from option.cats array
    const hits = {};
    const trumpHit = {};
    state.cats.forEach(function (c) {
      hits[c.id] = 0;
      trumpHit[c.id] = false;
    });

    state.answers.forEach(function (a, i) {
      if (!a) return;
      const q = state.questions[i];
      if (!q) return;
      const opt = (q.options || []).find(function (o) { return o.score === a.score; });
      if (!opt) return;
      (opt.cats || []).forEach(function (catId) {
        if (catId in hits) hits[catId] += 1;
      });
      state.cats.forEach(function (c) {
        if (c.trump && c.trump.qId === q.id && c.trump.score === a.score) {
          trumpHit[c.id] = true;
        }
      });
    });

    // 3. Top hitter(s)
    let topHit = -1;
    state.cats.forEach(function (c) { if (hits[c.id] > topHit) topHit = hits[c.id]; });
    const tied = state.cats.filter(function (c) { return hits[c.id] === topHit; });

    let result;
    if (tied.length === 1) {
      result = tied[0];
    } else {
      // Tiebreaker 1: trump selected
      const trumpWinners = tied.filter(function (c) { return trumpHit[c.id]; });
      const pool = trumpWinners.length > 0 ? trumpWinners : tied;
      if (pool.length === 1) {
        result = pool[0];
      } else {
        // Tiebreaker 2: smallest euclidean distance (last-resort)
        let best = pool[0], bestDist = Infinity;
        pool.forEach(function (cat) {
          const vec = Array.isArray(cat.vector) ? cat.vector : new Array(DIM_COUNT).fill(0);
          let s = 0;
          for (let j = 0; j < DIM_COUNT; j++) {
            const d = (vec[j] || 0) - userVec[j];
            s += d * d;
          }
          const dist = Math.sqrt(s);
          if (dist < bestDist) { bestDist = dist; best = cat; }
        });
        result = best;
      }
    }

    state.result = result || state.cats[0];
    state.isAnimating = false;
    state.view = 'result';
    render();
  }

  function renderResult() {
    const cat = state.result;
    if (!cat) return;

    el.resultImage.src = cat.image || '';
    el.resultImage.alt = cat.name || '';

    // Add a space between code and name ("WILD" + " " + "野性基因-孟加拉猫")
    el.resultNameTitle.textContent = cat.name_title ? cat.name_title + ' ' : '';
    el.resultName.textContent      = cat.name || '';

    // The quote block now shows the cat's first-person punchline
    el.resultQuote.textContent = cat.punchline || cat.slogan || '';
    if (el.resultQuickReview) el.resultQuickReview.textContent = cat.quick_review || '';
    el.resultInterpretation.textContent = cat.interpretation || '';

    el.resultTags.innerHTML = '';
    (cat.tags || []).slice(0, 4).forEach(function (t) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      el.resultTags.appendChild(span);
    });

    if (el.resultCatchphrases) {
      el.resultCatchphrases.innerHTML = '';
      (cat.catchphrases || []).forEach(function (phrase) {
        const d = document.createElement('div');
        d.className = 'catchphrase';
        d.textContent = phrase;
        el.resultCatchphrases.appendChild(d);
      });
    }

    // Draw radar chart
    drawRadar(el.radarCanvas, state.userVec);

    // Highlight cards: 恋爱脑指数 (M) + 内耗指数 (N)
    const mdPct = Math.round(((state.userVec[4] + 4) / 8) * 100);
    const nzPct = Math.round(((state.userVec[5] + 4) / 8) * 100);
    if (el.resultMdValue) el.resultMdValue.textContent = mdPct + '%';
    if (el.resultNzValue) el.resultNzValue.textContent = nzPct + '%';
    if (el.resultMdNote)  el.resultMdNote.textContent  = mdNoteFor(mdPct);
    if (el.resultNzNote)  el.resultNzNote.textContent  = nzNoteFor(nzPct);

    // reset share button state
    el.btnShare.classList.remove('is-copied');
    el.btnShare.textContent = '复制分享链接';

    // Auto-generate inline share image (non-blocking)
    generateShareImage();
  }

  // ------------------------------------------------------------
  // Radar chart
  // Input: canvas, 4-dim vector in [-4, +4]
  // Maps to 0-100 score per axis for visual intuition.
  // ------------------------------------------------------------
  function drawRadar(canvas, vector) {
    if (!canvas || !canvas.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = 320;           // CSS size
    canvas.width  = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width  = logicalSize + 'px';
    canvas.style.height = logicalSize + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalSize, logicalSize);

    const cx = logicalSize / 2;
    const cy = logicalSize / 2;
    const r  = Math.min(cx, cy) - 56;
    const axisCount = DIM_COUNT;

    // Normalize [-4, +4] → [0, 1]
    const norm = vector.map(v => Math.max(0, Math.min(1, (v + 4) / 8)));

    // Angles: start top, go clockwise
    const angleFor = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / axisCount);

    // 1) Grid polygons at 25/50/75/100
    ctx.strokeStyle = '#D5D5D5';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(scale => {
      ctx.beginPath();
      for (let i = 0; i < axisCount; i++) {
        const a = angleFor(i);
        const x = cx + Math.cos(a) * r * scale;
        const y = cy + Math.sin(a) * r * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // 2) Axes lines
    ctx.strokeStyle = '#D5D5D5';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }

    // 3) User polygon
    ctx.fillStyle = 'rgba(26, 26, 26, 0.12)';
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4) User points
    ctx.fillStyle = '#1A1A1A';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5) Labels + percentage
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const labelDist = r + 26;
      const lx = cx + Math.cos(a) * labelDist;
      const ly = cy + Math.sin(a) * labelDist;
      ctx.fillStyle = '#1A1A1A';
      ctx.fillText(DIM_LABELS[i], lx, ly - 8);

      ctx.fillStyle = '#8A8A8A';
      ctx.font = '400 12px -apple-system, sans-serif';
      ctx.fillText(Math.round(norm[i] * 100) + '%', lx, ly + 8);
      ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    }
  }

  // ------------------------------------------------------------
  // Highlight card copy — 恋爱脑指数 / 内耗指数
  // ------------------------------------------------------------
  function mdNoteFor(pct) {
    if (pct >= 80) return '爱上就原地失忆三个月 · 解除状态需重启';
    if (pct >= 60) return '心动了,但还记得先刷个牙';
    if (pct >= 40) return '不上赶着 · 让对方先暴露自己';
    if (pct >= 20) return '心动需签三份意向书才生效';
    return '金甲护体 · 丘比特射一箭碎一箭';
  }
  function nzNoteFor(pct) {
    if (pct >= 80) return '一句话能在心里开庭审判三天三夜';
    if (pct >= 60) return '反刍三遍 · 两小时内自己把自己劝好';
    if (pct >= 40) return '偶尔想多 · 但能一键清缓存';
    if (pct >= 20) return '翻篇速度比 Ctrl+R 还快';
    return '佛到羽化登仙 · 内耗索引 0 条结果';
  }

  // ------------------------------------------------------------
  // Share / Restart
  // ------------------------------------------------------------
  async function shareLink() {
    const url = location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        legacyCopy(url);
      }
      showCopied();
    } catch (err) {
      try { legacyCopy(url); showCopied(); }
      catch (_) { el.btnShare.textContent = '复制失败 · 请手动复制'; }
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  function showCopied() {
    el.btnShare.classList.add('is-copied');
    el.btnShare.textContent = '已复制 ✓';
    clearTimeout(showCopied._t);
    showCopied._t = setTimeout(() => {
      el.btnShare.classList.remove('is-copied');
      el.btnShare.textContent = '复制分享链接';
    }, 2000);
  }

  function restart() {
    state.view = 'intro';
    state.currentIdx = 0;
    state.answers = [];
    state.result = null;
    state.userVec = [0, 0, 0, 0];
    state.isAnimating = false;
    render();
  }

  // ------------------------------------------------------------
  // Auto-generate inline share image (simplified card, no tags/radar)
  // Uses html-to-image via CDN. Image displays inline so users can
  // long-press to save on mobile or right-click on desktop.
  // ------------------------------------------------------------
  // Convert a (local) image URL to a data URL so html-to-image can reliably
  // capture it on mobile browsers (Safari sometimes misses <img> that hasn't
  // been fully decoded even when img.complete is true).
  async function imageToDataUrl(src) {
    if (!src) return '';
    if (src.startsWith('data:')) return src;
    try {
      const res = await fetch(src, { cache: 'force-cache' });
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[CATTI] imageToDataUrl failed, fallback to src', e);
      return src;
    }
  }

  async function generateShareImage() {
    const cat = state.result;
    if (!cat) return;

    // Pre-embed avatar as a data URL for mobile reliability
    const avatarDataUrl = await imageToDataUrl(cat.image || '');
    el.scAvatar.src = avatarDataUrl;
    el.scNameTitle.textContent   = cat.name_title ? cat.name_title + ' ' : '';
    el.scName.textContent        = cat.name || '';
    if (el.scPunchline) el.scPunchline.textContent = cat.punchline || cat.slogan || '';
    if (el.scQuickReview) el.scQuickReview.textContent = cat.quick_review || '';

    // Render first 4 tags into share card (2 per row × 2 rows) — matches result page
    if (el.scTagsGrid) {
      el.scTagsGrid.innerHTML = '';
      (cat.tags || []).slice(0, 4).forEach(function (t) {
        const d = document.createElement('div');
        d.className = 'sc-tag-item';
        d.textContent = t;
        el.scTagsGrid.appendChild(d);
      });
    }

    // reset inline image state
    el.shareImage.style.display = 'none';
    el.shareImage.src = '';
    if (el.shareImagePlaceholder) {
      el.shareImagePlaceholder.style.display = '';
      el.shareImagePlaceholder.innerHTML =
        '<div class="spinner"></div><p>正在生成你的专属结果图…</p>';
    }

    // Wait for avatar image to fully load
    try { await waitForImage(el.scAvatar); } catch (_) {}

    // Need to move the card off-screen but still rendered (not display:none)
    el.shareCardWrap.classList.add('visible');

    try {
      if (typeof window.htmlToImage === 'undefined') {
        throw new Error('html-to-image not loaded');
      }
      const dataUrl = await window.htmlToImage.toPng(el.shareCard, {
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
        cacheBust: true
      });
      el.shareImage.src = dataUrl;
      el.shareImage.style.display = 'block';
      el.shareImage.dataset.filename = 'catti-' + cat.id + '-' + Date.now() + '.png';
      if (el.shareImagePlaceholder) el.shareImagePlaceholder.style.display = 'none';
    } catch (err) {
      console.error('[CATTI] share image generation failed', err);
      if (el.shareImagePlaceholder) {
        el.shareImagePlaceholder.innerHTML = '<p class="share-image-error">结果图生成失败，请刷新重试</p>';
      }
    } finally {
      el.shareCardWrap.classList.remove('visible');
    }
  }

  function waitForImage(img) {
    return new Promise((resolve) => {
      if (!img || !img.src) { resolve(); return; }
      const decodeThenResolve = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(resolve).catch(() => resolve());
        } else {
          resolve();
        }
      };
      if (img.complete && img.naturalWidth > 0) { decodeThenResolve(); return; }
      const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); decodeThenResolve(); };
      img.addEventListener('load', done);
      img.addEventListener('error', done);
      setTimeout(resolve, 3000);
    });
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

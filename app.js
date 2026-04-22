/* ===========================================================
   CATTI · 猫格测试 — app.js
   =========================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // Mock fallbacks (used only when JSON fetch fails — e.g. file://)
  // ------------------------------------------------------------
  const MOCK_QUESTIONS = [
    {
      id: 1, dim: 'EI', text: '周末到了，你会选择？', scenario_emoji: '🛋️',
      options: [
        { label: '呼朋唤友约饭唱K，越热闹越舒服', score: 1 },
        { label: '看心情，有局就去没局也不强求',     score: 0 },
        { label: '关灯拉窗帘，一个人和我的猫',       score: -1 }
      ]
    },
    {
      id: 2, dim: 'PL', text: '遇到一个新奇的小玩意，你会？', scenario_emoji: '🎁',
      options: [
        { label: '立刻拆开研究，好奇心爆棚',  score: 1 },
        { label: '先观察一会儿再决定',       score: 0 },
        { label: '嗯…先放着，等心情对了再看', score: -1 }
      ]
    },
    {
      id: 3, dim: 'TF', text: '朋友跟你抱怨工作烦恼，你先？', scenario_emoji: '💭',
      options: [
        { label: '分析问题，给出解决方案',   score: 1 },
        { label: '听一听，顺便给点建议',     score: 0 },
        { label: '先抱抱，先抱抱再说',       score: -1 }
      ]
    }
  ];

  const MOCK_CATS = [
    {
      id: 'calico', name: '三花猫', image: 'images/calico.png',
      slogan: '一身三色，心有千机',
      tags: ['独立', '机灵', '傲娇'],
      vector: [1, 1, 1, 0],
      interpretation: '三花猫的你，外表温柔里藏着小聪明。你喜欢自己安排节奏，不愿被任何人牵着走；面对陌生的环境，先观察再决定是你的天性。看似慢热，其实心里有一本自己的小账本——谁真心、谁敷衍，你一清二楚。'
    },
    {
      id: 'orange', name: '橘猫', image: 'images/orange.png',
      slogan: '十橘九胖，心宽路远',
      tags: ['热情', '随和', '贪吃'],
      vector: [2, 0, -1, 0],
      interpretation: '你是朋友圈里的小太阳，自带松弛感。对生活的态度是“好吃好睡好心情”，能把最普通的日子过出温度。偶尔懒，偶尔怂，但该出现的时候绝不缺席。'
    },
    {
      id: 'black_cat', name: '黑猫', image: 'images/black_cat.png',
      slogan: '夜色是我的私人舞台',
      tags: ['神秘', '敏感', '忠诚'],
      vector: [-2, 2, 0, 1],
      interpretation: '黑猫般的你，安静中透着一种不动声色的锐利。你不爱喧闹，却很清楚自己要什么。对熟悉的人极度忠诚，对陌生的世界永远保留一层体面的距离。'
    }
  ];

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const state = {
    view: 'intro',          // 'intro' | 'quiz' | 'result'
    questions: [],
    cats: [],
    currentIdx: 0,
    answers: [],            // [{id, dim, score}]
    result: null,
    isAnimating: false
  };

  const DIM_IDX = { EI: 0, PL: 1, TF: 2, JS: 3 };
  const ANIM_MS = 340;      // must match CSS transition
  const LOCK_MS = 500;      // debounce rapid taps

  // ------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------
  const el = {
    views: {
      intro:  document.getElementById('view-intro'),
      quiz:   document.getElementById('view-quiz'),
      result: document.getElementById('view-result')
    },
    // intro
    btnStart: document.getElementById('btn-start'),
    // quiz
    progressPaws:    document.getElementById('progress-paws'),
    progressCurrent: document.getElementById('progress-current'),
    progressTotal:   document.getElementById('progress-total'),
    progressCaption: document.getElementById('progress-caption'),
    quizCard:        document.getElementById('quiz-card'),
    qEmoji:          document.getElementById('q-emoji'),
    qText:           document.getElementById('q-text'),
    optionsList:     document.getElementById('options-list'),
    btnPrev:         document.getElementById('btn-prev'),
    // result
    resultImage:          document.getElementById('result-image'),
    resultName:           document.getElementById('result-name'),
    resultSlogan:         document.getElementById('result-slogan'),
    resultTags:           document.getElementById('result-tags'),
    resultInterpretation: document.getElementById('result-interpretation'),
    btnRestart:           document.getElementById('btn-restart'),
    btnShare:             document.getElementById('btn-share')
  };

  // ------------------------------------------------------------
  // Init — fetch JSON (with graceful fallbacks)
  // ------------------------------------------------------------
  async function init() {
    const [questions, cats] = await Promise.all([
      loadJSON('data/questions.json', MOCK_QUESTIONS),
      loadJSON('data/cats.json',      MOCK_CATS)
    ]);
    state.questions = Array.isArray(questions) && questions.length ? questions : MOCK_QUESTIONS;
    state.cats      = Array.isArray(cats)      && cats.length      ? cats      : MOCK_CATS;

    if (el.progressTotal) el.progressTotal.textContent = state.questions.length;

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
  // Event binding
  // ------------------------------------------------------------
  function bindEvents() {
    el.btnStart   && el.btnStart.addEventListener('click', startQuiz);
    el.btnPrev    && el.btnPrev.addEventListener('click',  previousQuestion);
    el.btnRestart && el.btnRestart.addEventListener('click', restart);
    el.btnShare   && el.btnShare.addEventListener('click',  shareLink);
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
    // Scroll to top on view switch
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    if (state.view === 'quiz')   renderQuiz();
    if (state.view === 'result') renderResult();
    setView(state.view);
  }

  // ------------------------------------------------------------
  // INTRO
  // ------------------------------------------------------------
  function startQuiz() {
    state.view = 'quiz';
    state.currentIdx = 0;
    state.answers = [];
    render();
  }

  // ------------------------------------------------------------
  // QUIZ
  // ------------------------------------------------------------
  function renderQuiz() {
    renderProgress();
    renderQuestion();
    updatePrevButton();
  }

  function renderProgress() {
    const total = state.questions.length;
    el.progressTotal.textContent = total;
    el.progressCurrent.textContent = state.currentIdx + 1;

    el.progressPaws.setAttribute('aria-valuenow', state.currentIdx + 1);
    el.progressPaws.setAttribute('aria-valuemax', total);

    // Build / reuse paw dots
    if (el.progressPaws.childElementCount !== total) {
      el.progressPaws.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const span = document.createElement('span');
        span.className = 'paw-dot';
        span.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#icon-paw"/></svg>';
        el.progressPaws.appendChild(span);
      }
    }
    [...el.progressPaws.children].forEach((dot, i) => {
      dot.classList.toggle('active',  i < state.currentIdx + 1);
      dot.classList.toggle('current', i === state.currentIdx);
    });

    // Whimsical caption
    const total2 = total;
    const idx = state.currentIdx;
    let caption = '🐱 小猫正在观察你…';
    if (idx >= total2 - 1)         caption = '🐱 最后一题，猫猫屏住呼吸…';
    else if (idx >= total2 * 0.66) caption = '🐱 小猫已经开始记笔记了…';
    else if (idx >= total2 * 0.33) caption = '🐱 小猫眯起了眼睛…';
    el.progressCaption.textContent = caption;
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;

    el.qEmoji.textContent = q.scenario_emoji || '😺';
    el.qText.textContent  = q.text || '';

    el.optionsList.innerHTML = '';
    (q.options || []).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'option';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.score = String(opt.score);
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

    // Reset card state (re-play entering animation)
    el.quizCard.classList.remove('leaving', 'entering');
  }

  function onSelectOption(node, score) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    // mark selected
    [...el.optionsList.children].forEach(c => c.classList.remove('selected'));
    node.classList.add('selected');

    // record answer
    const q = state.questions[state.currentIdx];
    state.answers[state.currentIdx] = { id: q.id, dim: q.dim, score: score };

    // advance or finish after a brief beat
    setTimeout(function () {
      if (state.currentIdx < state.questions.length - 1) {
        animateToNext(+1);
      } else {
        computeResult();
      }
    }, 280);
  }

  function previousQuestion() {
    if (state.isAnimating || state.currentIdx === 0) return;
    animateToNext(-1);
  }

  function animateToNext(direction) {
    state.isAnimating = true;
    const card = el.quizCard;

    // leaving
    card.classList.remove('entering');
    card.classList.add('leaving');
    if (direction === -1) {
      // reverse direction for back-nav
      card.style.transform = 'translateX(44px)';
      card.style.opacity   = '0';
    }

    setTimeout(function () {
      state.currentIdx += direction;

      // entering from opposite side
      card.style.transform = '';
      card.style.opacity   = '';
      card.classList.remove('leaving');
      card.classList.add('entering');

      if (direction === -1) {
        card.style.transform = 'translateX(-44px)';
      }

      renderQuiz();

      // force reflow, then drop the entering class to transition in
      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;
      card.classList.remove('entering');
      card.style.transform = '';
      card.style.opacity   = '';

      // unlock after transition settles
      setTimeout(function () {
        state.isAnimating = false;
      }, Math.max(ANIM_MS, LOCK_MS) - ANIM_MS);
    }, ANIM_MS);
  }

  function updatePrevButton() {
    el.btnPrev.disabled = state.currentIdx === 0;
  }

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------
  function computeResult() {
    const userVec = [0, 0, 0, 0]; // [E, P, T, J]
    state.answers.forEach(function (a) {
      const idx = DIM_IDX[a.dim];
      if (typeof idx === 'number') userVec[idx] += a.score;
    });

    let best = null;
    let bestDist = Infinity;
    state.cats.forEach(function (cat) {
      const vec = Array.isArray(cat.vector) ? cat.vector : [0, 0, 0, 0];
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        const d = (vec[i] || 0) - userVec[i];
        sum += d * d;
      }
      const dist = Math.sqrt(sum);
      if (dist < bestDist) { bestDist = dist; best = cat; }
    });

    state.result = best || state.cats[0];
    state.isAnimating = false;
    state.view = 'result';
    render();
  }

  function renderResult() {
    const cat = state.result;
    if (!cat) return;

    // Image: re-trigger pop-in animation every render
    el.resultImage.classList.remove('animate');
    el.resultImage.src = cat.image || '';
    el.resultImage.alt = cat.name || '';
    // force reflow & restart animation
    // eslint-disable-next-line no-unused-expressions
    el.resultImage.offsetHeight;
    el.resultImage.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    el.resultImage.offsetHeight;
    el.resultImage.style.animation = '';

    el.resultName.textContent   = cat.name || '';
    el.resultSlogan.textContent = cat.slogan ? '“' + cat.slogan + '”' : '';

    el.resultTags.innerHTML = '';
    (cat.tags || []).forEach(function (t) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      el.resultTags.appendChild(span);
    });

    el.resultInterpretation.textContent = cat.interpretation || '';

    // reset share button state
    el.btnShare.classList.remove('is-copied');
    el.btnShare.textContent = '复制分享链接';
  }

  // ------------------------------------------------------------
  // Share & Restart
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
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  function showCopied() {
    el.btnShare.classList.add('is-copied');
    el.btnShare.textContent = '已复制 ✓';
    clearTimeout(showCopied._t);
    showCopied._t = setTimeout(function () {
      el.btnShare.classList.remove('is-copied');
      el.btnShare.textContent = '复制分享链接';
    }, 2000);
  }

  function restart() {
    state.view = 'intro';
    state.currentIdx = 0;
    state.answers = [];
    state.result = null;
    state.isAnimating = false;
    render();
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

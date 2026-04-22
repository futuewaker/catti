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
      id: 1, dim: 'EI', text: '周末到了，你会选择？',
      options: [
        { label: '呼朋唤友约饭唱K，越热闹越舒服', score: 1 },
        { label: '看心情，有局就去没局也不强求',   score: 0 },
        { label: '关灯拉窗帘，一个人和我的猫',     score: -1 }
      ]
    },
    {
      id: 2, dim: 'PL', text: '遇到一个新奇的小玩意，你会？',
      options: [
        { label: '立刻拆开研究，好奇心爆棚',   score: 1 },
        { label: '先观察一会儿再决定',         score: 0 },
        { label: '嗯…先放着，等心情对了再看', score: -1 }
      ]
    },
    {
      id: 3, dim: 'TF', text: '朋友跟你抱怨工作烦恼，你先？',
      options: [
        { label: '分析问题，给出解决方案', score: 1 },
        { label: '听一听，顺便给点建议',   score: 0 },
        { label: '先抱抱，先抱抱再说',     score: -1 }
      ]
    }
  ];

  const MOCK_CATS = [
    {
      id: 'calico', name: '三花猫', image: 'images/calico.png',
      slogan: '一身三色，心有千机',
      tags: ['独立', '机灵', '傲娇', '情绪稳定'],
      vector: [1, 1, 1, 0],
      interpretation: '三花猫的你，外表温柔里藏着小聪明。你喜欢自己安排节奏，不愿被任何人牵着走。'
    },
    {
      id: 'orange', name: '橘猫', image: 'images/orange.png',
      slogan: '十橘九胖，心宽路远',
      tags: ['热情', '随和', '贪吃', '社牛'],
      vector: [2, 0, -1, 0],
      interpretation: '你是朋友圈里的小太阳，自带松弛感。'
    },
    {
      id: 'black_cat', name: '黑猫', image: 'images/black_cat.png',
      slogan: '夜色是我的私人舞台',
      tags: ['神秘', '敏感', '忠诚', '洞察力强'],
      vector: [-2, 2, 0, 1],
      interpretation: '黑猫般的你，安静中透着一种不动声色的锐利。'
    }
  ];

  // Dim-based scenario hints (shown in the gray bubble)
  const DIM_HINTS = {
    EI: '社交还是独处，这是个问题',
    PL: '出手还是躺平，这是种本能',
    TF: '用脑还是用心，各有道理',
    JS: '按计划还是凭感觉，都挺好'
  };

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const state = {
    view: 'intro',
    questions: [],
    cats: [],
    currentIdx: 0,
    answers: [],          // [{id, dim, score}] or undefined
    result: null,
    isAnimating: false
  };

  const DIM_IDX = { EI: 0, PL: 1, TF: 2, JS: 3 };
  const ANIM_MS = 280;

  // ------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------
  const el = {
    views: {
      intro:  document.getElementById('view-intro'),
      quiz:   document.getElementById('view-quiz'),
      result: document.getElementById('view-result')
    },
    btnStart:        document.getElementById('btn-start'),
    progressCurrent: document.getElementById('progress-current'),
    progressTotal:   document.getElementById('progress-total'),
    scenarioBubble:  document.getElementById('scenario-bubble'),
    quizCard:        document.getElementById('quiz-card'),
    qText:           document.getElementById('q-text'),
    optionsList:     document.getElementById('options-list'),
    btnPrev:         document.getElementById('btn-prev'),
    btnContinue:     document.getElementById('btn-continue'),
    resultImage:          document.getElementById('result-image'),
    resultName:           document.getElementById('result-name'),
    resultSlogan:         document.getElementById('result-slogan'),
    resultQuote:          document.getElementById('result-quote'),
    resultTags:           document.getElementById('result-tags'),
    resultInterpretation: document.getElementById('result-interpretation'),
    btnRestart:           document.getElementById('btn-restart'),
    btnShare:             document.getElementById('btn-share')
  };

  // ------------------------------------------------------------
  // Init
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
  // Events
  // ------------------------------------------------------------
  function bindEvents() {
    el.btnStart    && el.btnStart.addEventListener('click', startQuiz);
    el.btnPrev     && el.btnPrev.addEventListener('click',  previousQuestion);
    el.btnContinue && el.btnContinue.addEventListener('click', continueQuiz);
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
    renderScenarioHint();
    renderQuestion();
    updateNavButtons();
  }

  function renderProgress() {
    const total = state.questions.length;
    el.progressTotal.textContent = total;
    el.progressCurrent.textContent = state.currentIdx + 1;
  }

  function renderScenarioHint() {
    const q = state.questions[state.currentIdx];
    if (!q || !el.scenarioBubble) return;
    const hint = DIM_HINTS[q.dim] || '轻轻观察一下你自己';
    el.scenarioBubble.textContent = hint;
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;

    el.qText.textContent = q.text || '';

    // Read previously-selected answer for this question (for back-nav)
    const prevAnswer = state.answers[state.currentIdx];

    el.optionsList.innerHTML = '';
    (q.options || []).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'option';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.score = String(opt.score);

      if (prevAnswer && prevAnswer.score === opt.score) li.classList.add('selected');

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

    el.quizCard.classList.remove('leaving', 'entering');
  }

  function onSelectOption(node, score) {
    if (state.isAnimating) return;

    // mark selected (single-select)
    [...el.optionsList.children].forEach(c => c.classList.remove('selected'));
    node.classList.add('selected');

    // record answer
    const q = state.questions[state.currentIdx];
    state.answers[state.currentIdx] = { id: q.id, dim: q.dim, score: score };

    updateNavButtons();
  }

  function continueQuiz() {
    if (state.isAnimating) return;
    if (!state.answers[state.currentIdx]) return;
    if (state.currentIdx < state.questions.length - 1) {
      animateToNext(+1);
    } else {
      computeResult();
    }
  }

  function previousQuestion() {
    if (state.isAnimating || state.currentIdx === 0) return;
    animateToNext(-1);
  }

  function animateToNext(direction) {
    state.isAnimating = true;
    const card = el.quizCard;

    const outX = direction === 1 ? -32 : 32;
    const inX  = direction === 1 ? 32 : -32;

    card.style.transition = 'transform 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease';
    card.style.transform  = 'translateX(' + outX + 'px)';
    card.style.opacity    = '0';

    setTimeout(function () {
      state.currentIdx += direction;

      // jump to entering position (no transition)
      card.style.transition = 'none';
      card.style.transform  = 'translateX(' + inX + 'px)';
      card.style.opacity    = '0';

      renderQuiz();

      // force reflow to commit the jump
      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;

      card.style.transition = 'transform 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease';
      card.style.transform  = 'translateX(0)';
      card.style.opacity    = '1';

      setTimeout(function () {
        state.isAnimating = false;
        // cleanup inline styles so CSS classes take over
        card.style.transition = '';
        card.style.transform  = '';
        card.style.opacity    = '';
      }, ANIM_MS + 40);
    }, ANIM_MS);
  }

  function updateNavButtons() {
    // Back arrow: enabled when not at first question
    el.btnPrev.disabled = state.currentIdx === 0;

    // Continue button: enabled when current question has an answer
    const hasAnswer = !!state.answers[state.currentIdx];
    el.btnContinue.disabled = !hasAnswer;

    // Label: change to "查看结果" on last question
    const isLast = state.currentIdx === state.questions.length - 1;
    el.btnContinue.innerHTML = isLast
      ? '查看结果<span class="btn-arrow" aria-hidden="true">→</span>'
      : '继续<span class="btn-arrow" aria-hidden="true">→</span>';
  }

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------
  function computeResult() {
    const userVec = [0, 0, 0, 0];
    state.answers.forEach(function (a) {
      if (!a) return;
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

    el.resultImage.src = cat.image || '';
    el.resultImage.alt = cat.name || '';

    el.resultName.textContent   = cat.name || '';
    el.resultSlogan.textContent = cat.slogan || '';

    // Quote bubble: use first sentence of interpretation; main text shows the rest
    const interp = cat.interpretation || '';
    const firstSentMatch = interp.match(/^[^。！？\n]*[。！？]/);
    let quoteText = '';
    let bodyText  = interp;
    if (firstSentMatch) {
      quoteText = firstSentMatch[0];
      bodyText  = interp.slice(firstSentMatch[0].length).trim();
    } else {
      quoteText = cat.slogan || '';
    }
    el.resultQuote.textContent = quoteText;

    el.resultTags.innerHTML = '';
    (cat.tags || []).forEach(function (t) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = t;
      el.resultTags.appendChild(span);
    });

    el.resultInterpretation.textContent = bodyText || cat.interpretation || '';

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

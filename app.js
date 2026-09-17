/**
 * دوري أبطال الكتاب المقدس 2026 - الموسم التاسع
 * Core Application Engine: Navigation, History Back, Sound & Interactive Quiz
 * مطرانية شبرا الخيمة للأقباط الأرثوذكس - تحت رعاية نيافة الأنبا مرقس
 */

(function () {
  'use strict';

  // Application State
  const state = {
    currentPage: 'home', // 'home' | 'ot' | 'nt' | 'quiz' | 'results'
    pageHistory: ['home'],
    mode: 'championship', // 'championship' | 'practice' | 'speed'
    sound: localStorage.getItem('dawry_sound_2026') !== 'false',
    bookId: '1_kings',
    chapterNum: '1',
    questions: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    userAnswers: [],
    timer: null,
    timeLeft: 20,
    maxTime: 20,
    isAnswered: false
  };

  // Helper to retrieve all book data safely
  function getDataSource() {
    if (window.DAWRY_DATA && Object.keys(window.DAWRY_DATA).length > 0) {
      return window.DAWRY_DATA;
    }
    return Object.assign({}, window.DAWRY_OT_DATA || {}, window.DAWRY_NT_DATA || {});
  }

  // Audio Synthesizer (Web Audio API - Completely Local, Zero External Files)
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, type, duration, delay = 0) {
    if (!state.sound) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToTimeConstant(0.001, ctx.currentTime + duration, 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }, delay);
    } catch (e) {
      console.warn('Audio notice:', e);
    }
  }

  function playSoundCorrect() {
    playTone(523.25, 'sine', 0.12, 0);   // C5
    playTone(659.25, 'sine', 0.14, 70);  // E5
    playTone(783.99, 'sine', 0.25, 140); // G5
  }

  function playSoundWrong() {
    playTone(280, 'triangle', 0.15, 0);
    playTone(220, 'sawtooth', 0.25, 80);
  }

  function playSoundVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => playTone(n, 'triangle', 0.28, i * 100));
  }

  function playSoundClick() {
    playTone(440, 'sine', 0.04, 0);
  }

  // DOM Elements Reference
  const DOM = {
    // Header & Navigation
    headerBrand: document.getElementById('header-brand'),
    navHome: document.getElementById('nav-home'),
    navOt: document.getElementById('nav-ot'),
    navNt: document.getElementById('nav-nt'),
    bnavHome: document.getElementById('bnav-home'),
    bnavOt: document.getElementById('bnav-ot'),
    bnavNt: document.getElementById('bnav-nt'),
    soundToggle: document.getElementById('sound-toggle'),
    historyBar: document.getElementById('history-bar'),
    btnBack: document.getElementById('btn-back'),
    breadcrumbs: document.getElementById('breadcrumbs'),

    // Views
    viewHome: document.getElementById('view-home'),
    viewOt: document.getElementById('view-ot'),
    viewNt: document.getElementById('view-nt'),
    viewQuiz: document.getElementById('view-quiz'),
    viewResults: document.getElementById('view-results'),

    // Home View Elements
    otBooksList: document.getElementById('ot-books-list'),
    ntBooksList: document.getElementById('nt-books-list'),
    modes: document.querySelectorAll('.mode-card'),
    statBooks: document.getElementById('stat-books'),
    statChapters: document.getElementById('stat-chapters'),
    statQuestions: document.getElementById('stat-questions'),

    // Quiz View Elements
    quizBadge: document.getElementById('quiz-badge'),
    quizChapterTag: document.getElementById('quiz-chapter-tag'),
    streakVal: document.getElementById('streak-val'),
    timerPill: document.getElementById('timer-pill'),
    timerVal: document.getElementById('timer-val'),
    progressFill: document.getElementById('progress-fill'),
    questionCount: document.getElementById('question-count'),
    questionText: document.getElementById('question-text'),
    optionsGrid: document.getElementById('options-grid'),
    explanationBox: document.getElementById('explanation-box'),
    explanationText: document.getElementById('explanation-text'),
    btnNext: document.getElementById('btn-next'),
    btnQuit: document.getElementById('btn-quit'),

    // Results View Elements
    resScore: document.getElementById('res-score'),
    resMax: document.getElementById('res-max'),
    resCorrect: document.getElementById('res-correct'),
    resWrong: document.getElementById('res-wrong'),
    resAccuracy: document.getElementById('res-accuracy'),
    reviewList: document.getElementById('review-list'),
    btnRestart: document.getElementById('btn-restart'),
    btnChooseOther: document.getElementById('btn-choose-other'),
    btnResHome: document.getElementById('btn-res-home')
  };

  // =========================================================================
  // NAVIGATION & HISTORY BACK ENGINE
  // =========================================================================

  function navigateTo(page, params = {}, pushHistory = true) {
    // Confirmation if quitting quiz in progress
    if (state.currentPage === 'quiz' && page !== 'quiz' && page !== 'results') {
      clearInterval(state.timer);
    }

    state.currentPage = page;

    // Toggle quiz active class on body to optimize mobile layout
    if (page === 'quiz') {
      document.body.classList.add('quiz-active');
    } else {
      document.body.classList.remove('quiz-active');
    }

    // Update History Stack
    if (pushHistory) {
      state.pageHistory.push(page);
      try {
        window.history.pushState({ page: page, params: params }, '', '#' + page);
      } catch (e) {
        // file:/// security restriction fallback
      }
    }

    // Hide all views
    [DOM.viewHome, DOM.viewOt, DOM.viewNt, DOM.viewQuiz, DOM.viewResults].forEach(v => {
      if (v) v.style.display = 'none';
    });

    // Reset nav links active state
    [DOM.navHome, DOM.navOt, DOM.navNt, DOM.bnavHome, DOM.bnavOt, DOM.bnavNt].forEach(n => {
      if (n) n.classList.remove('active');
    });

    // Render Target View
    switch (page) {
      case 'home':
        if (DOM.viewHome) DOM.viewHome.style.display = 'block';
        if (DOM.navHome) DOM.navHome.classList.add('active');
        if (DOM.bnavHome) DOM.bnavHome.classList.add('active');
        updateBreadcrumbs(['الرئيسية']);
        if (DOM.btnBack) DOM.btnBack.style.visibility = 'hidden';
        break;

      case 'ot':
        if (DOM.viewOt) DOM.viewOt.style.display = 'block';
        if (DOM.navOt) DOM.navOt.classList.add('active');
        if (DOM.bnavOt) DOM.bnavOt.classList.add('active');
        updateBreadcrumbs(['الرئيسية', 'العهد القديم (3 أسفار)']);
        if (DOM.btnBack) DOM.btnBack.style.visibility = 'visible';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'nt':
        if (DOM.viewNt) DOM.viewNt.style.display = 'block';
        if (DOM.navNt) DOM.navNt.classList.add('active');
        if (DOM.bnavNt) DOM.bnavNt.classList.add('active');
        updateBreadcrumbs(['الرئيسية', 'العهد الجديد (5 رسائل)']);
        if (DOM.btnBack) DOM.btnBack.style.visibility = 'visible';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'quiz':
        if (DOM.viewQuiz) DOM.viewQuiz.style.display = 'block';
        const data = getDataSource();
        const book = data[state.bookId];
        const bTitle = book ? (book.shortTitle || book.title) : '';
        const testTitle = book && book.testament === 'ot' ? 'العهد القديم' : 'العهد الجديد';
        updateBreadcrumbs(['الرئيسية', testTitle, `${bTitle} - إصحاح ${state.chapterNum}`]);
        if (DOM.btnBack) DOM.btnBack.style.visibility = 'visible';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'results':
        if (DOM.viewResults) DOM.viewResults.style.display = 'block';
        updateBreadcrumbs(['الرئيسية', 'نتيجة الاختبار والتقييم']);
        if (DOM.btnBack) DOM.btnBack.style.visibility = 'visible';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
    }
  }

  function handleBackAction() {
    playSoundClick();
    if (state.currentPage === 'quiz') {
      if (!confirm('هل تريد إنهاء الاختبار الحالي والرجوع؟')) {
        return;
      }
      clearInterval(state.timer);
      const data = getDataSource();
      const book = data[state.bookId];
      if (book && book.testament === 'ot') {
        navigateTo('ot', {}, true);
      } else if (book && book.testament === 'nt') {
        navigateTo('nt', {}, true);
      } else {
        navigateTo('home', {}, true);
      }
      return;
    }

    if (state.currentPage === 'results') {
      const data = getDataSource();
      const book = data[state.bookId];
      if (book && book.testament === 'ot') {
        navigateTo('ot', {}, true);
      } else if (book && book.testament === 'nt') {
        navigateTo('nt', {}, true);
      } else {
        navigateTo('home', {}, true);
      }
      return;
    }

    // Standard history pop
    if (state.pageHistory.length > 1) {
      state.pageHistory.pop(); // Remove current
      const prev = state.pageHistory[state.pageHistory.length - 1] || 'home';
      navigateTo(prev, {}, false);
    } else {
      navigateTo('home', {}, false);
    }
  }

  function updateBreadcrumbs(items) {
    if (!DOM.breadcrumbs) return;
    DOM.breadcrumbs.innerHTML = items.map((item, index) => {
      if (index === items.length - 1) {
        return `<span class="breadcrumbs-current">${item}</span>`;
      }
      return `<a data-crumb="${index}">${item}</a> <span>/</span> `;
    }).join('');
  }

  // =========================================================================
  // BOOKS RENDERING & STATS
  // =========================================================================

  function calculateAndDisplayStats() {
    const data = getDataSource();
    const booksArr = Object.values(data);
    let totalChapters = 0;
    let totalQuestions = 0;

    booksArr.forEach(b => {
      totalChapters += (b.chaptersCount || 0);
      if (b.chapters) {
        Object.values(b.chapters).forEach(qList => {
          totalQuestions += qList.length;
        });
      }
    });

    if (DOM.statBooks) DOM.statBooks.textContent = booksArr.length || 8;
    if (DOM.statChapters) DOM.statChapters.textContent = totalChapters || 109;
    if (DOM.statQuestions) DOM.statQuestions.textContent = totalQuestions ? totalQuestions.toLocaleString('ar-EG') : '1,000+';
  }

  function renderBooks() {
    const data = getDataSource();
    if (DOM.otBooksList) DOM.otBooksList.innerHTML = '';
    if (DOM.ntBooksList) DOM.ntBooksList.innerHTML = '';

    const otEntries = Object.entries(data).filter(([_, b]) => b.testament === 'ot');
    const ntEntries = Object.entries(data).filter(([_, b]) => b.testament === 'nt');

    // Render Old Testament Books
    otEntries.forEach(([key, book]) => {
      if (DOM.otBooksList) {
        DOM.otBooksList.appendChild(createBookCardElement(key, book));
      }
    });

    // Render New Testament Books
    ntEntries.forEach(([key, book]) => {
      if (DOM.ntBooksList) {
        DOM.ntBooksList.appendChild(createBookCardElement(key, book));
      }
    });
  }

  function createBookCardElement(bookKey, book) {
    const card = document.createElement('div');
    card.className = 'book-card';

    let chipsHtml = '';
    for (let c = 1; c <= book.chaptersCount; c++) {
      const hasQ = book.chapters && book.chapters[c] && book.chapters[c].length > 0;
      const count = hasQ ? book.chapters[c].length : 0;
      chipsHtml += `
        <button class="chapter-btn" 
                data-book="${bookKey}" 
                data-chapter="${c}" 
                title="الإصحاح ${c} (${count} أسئلة)"
                ${!hasQ ? 'disabled style="opacity: 0.35;"' : ''}>
          ${c}
        </button>
      `;
    }

    const isOt = (book.testament === 'ot');
    const badgeClass = isOt ? 'book-badge ot' : 'book-badge nt';
    const testTitle = isOt ? 'العهد القديم' : 'العهد الجديد';

    card.innerHTML = `
      <div class="book-header">
        <div class="book-icon">${book.icon || '📜'}</div>
        <div class="book-title-info">
          <h3>${book.title}</h3>
          <span class="${badgeClass}">${testTitle} • ${book.chaptersCount} إصحاحاً</span>
        </div>
      </div>
      <p class="book-desc">${book.desc}</p>
      <div class="chapters-selector-wrap">
        <div class="chapters-title">
          <span>اختر الإصحاح لبدء الاختبار:</span>
          <span style="font-size: 0.78rem; color: var(--gold-primary); font-weight: 700;">${book.chaptersCount} إصحاحاً</span>
        </div>
        <div class="chapters-chips">${chipsHtml}</div>
      </div>
    `;

    return card;
  }

  // =========================================================================
  // QUIZ ENGINE
  // =========================================================================

  function startQuiz(bookKey, chapterNum) {
    const data = getDataSource();
    const book = data[bookKey];
    if (!book || !book.chapters || !book.chapters[chapterNum] || book.chapters[chapterNum].length === 0) {
      alert('عفواً، أسئلة هذا الإصحاح قيد المراجعة والتحضير وسيتم توفيرها قريباً.');
      return;
    }

    state.bookId = bookKey;
    state.chapterNum = chapterNum;

    // Clone questions
    const rawQuestions = JSON.parse(JSON.stringify(book.chapters[chapterNum]));

    // Configure mode
    if (state.mode === 'speed') {
      state.maxTime = 10;
      state.questions = shuffleArray(rawQuestions).slice(0, 10);
    } else if (state.mode === 'practice') {
      state.maxTime = 0;
      state.questions = rawQuestions;
    } else {
      // Championship
      state.maxTime = 20;
      state.questions = rawQuestions;
    }

    state.currentIndex = 0;
    state.score = 0;
    state.streak = 0;
    state.maxStreak = 0;
    state.userAnswers = [];

    // Header Info
    const bTitle = book.shortTitle || book.title;
    if (DOM.quizChapterTag) DOM.quizChapterTag.textContent = `${bTitle} - الإصحاح ${chapterNum}`;
    
    if (DOM.quizBadge) {
      if (state.mode === 'championship') DOM.quizBadge.textContent = '🏆 وضع البطولة الرسمية';
      else if (state.mode === 'practice') DOM.quizBadge.textContent = '📖 وضع التدريب والمذاكرة';
      else DOM.quizBadge.textContent = '⚡ تحدي السرعة الخاطف';
    }

    navigateTo('quiz');
    loadCurrentQuestion();
  }

  function loadCurrentQuestion() {
    clearInterval(state.timer);
    state.isAnswered = false;

    const q = state.questions[state.currentIndex];
    const total = state.questions.length;

    // Progress and Counter
    if (DOM.questionCount) {
      DOM.questionCount.textContent = `السؤال ${state.currentIndex + 1} من ${total}`;
    }
    if (DOM.progressFill) {
      DOM.progressFill.style.width = `${((state.currentIndex) / total) * 100}%`;
    }
    if (DOM.streakVal) {
      DOM.streakVal.textContent = state.streak;
    }

    // Question text
    if (DOM.questionText) {
      DOM.questionText.textContent = q.q;
    }

    // Hide explanation box
    if (DOM.explanationBox) {
      DOM.explanationBox.style.display = 'none';
    }
    if (DOM.btnNext) {
      DOM.btnNext.disabled = true;
      DOM.btnNext.textContent = (state.currentIndex === total - 1) ? 'عرض النتيجة النهائية 🏆' : 'السؤال التالي ⬅️';
    }

    // Render Options
    if (DOM.optionsGrid) {
      DOM.optionsGrid.innerHTML = '';
      const letters = ['أ', 'ب', 'ج', 'د'];

      q.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `
          <span class="option-letter">${letters[index] || index + 1}</span>
          <span class="option-text">${optText}</span>
        `;
        btn.addEventListener('click', () => handleOptionSelection(index, btn));
        DOM.optionsGrid.appendChild(btn);
      });
    }

    // Handle Timer
    if (state.mode !== 'practice') {
      if (DOM.timerPill) DOM.timerPill.style.display = 'flex';
      state.timeLeft = state.maxTime;
      updateTimerUI();
      state.timer = setInterval(() => {
        state.timeLeft--;
        updateTimerUI();
        if (state.timeLeft <= 0) {
          clearInterval(state.timer);
          handleTimeOut();
        }
      }, 1000);
    } else {
      if (DOM.timerPill) DOM.timerPill.style.display = 'none';
    }
  }

  function updateTimerUI() {
    if (!DOM.timerVal) return;
    DOM.timerVal.textContent = state.timeLeft;
    if (state.timeLeft <= 5) {
      DOM.timerPill.classList.add('urgent');
    } else {
      DOM.timerPill.classList.remove('urgent');
    }
  }

  function handleOptionSelection(selectedIndex, selectedBtn) {
    if (state.isAnswered) return;
    state.isAnswered = true;
    clearInterval(state.timer);

    const q = state.questions[state.currentIndex];
    const isCorrect = (selectedIndex === q.correct);
    const allBtns = DOM.optionsGrid.querySelectorAll('.option-btn');

    // Disable all options
    allBtns.forEach(btn => btn.disabled = true);

    if (isCorrect) {
      playSoundCorrect();
      selectedBtn.classList.add('correct');
      state.score += 10;
      state.streak++;
      if (state.streak > state.maxStreak) state.maxStreak = state.streak;
    } else {
      playSoundWrong();
      selectedBtn.classList.add('wrong');
      state.streak = 0;
      // Highlight correct answer
      if (allBtns[q.correct]) {
        allBtns[q.correct].classList.add('correct');
      }
    }

    if (DOM.streakVal) DOM.streakVal.textContent = state.streak;

    // Record answer
    state.userAnswers.push({
      question: q.q,
      options: q.options,
      correctIndex: q.correct,
      selectedIndex: selectedIndex,
      isCorrect: isCorrect,
      ref: q.ref || '',
      explanation: q.explanation || ''
    });

    // Show Explanation
    if (DOM.explanationBox && DOM.explanationText) {
      let expContent = '';
      if (q.ref) expContent += `<strong>الشاهد:</strong> ${q.ref}<br>`;
      if (q.explanation) expContent += q.explanation;
      if (expContent) {
        DOM.explanationText.innerHTML = expContent;
        DOM.explanationBox.style.display = 'block';
      }
    }

    if (DOM.btnNext) DOM.btnNext.disabled = false;
  }

  function handleTimeOut() {
    if (state.isAnswered) return;
    state.isAnswered = true;
    playSoundWrong();

    const q = state.questions[state.currentIndex];
    const allBtns = DOM.optionsGrid.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);
    if (allBtns[q.correct]) {
      allBtns[q.correct].classList.add('correct');
    }

    state.streak = 0;
    if (DOM.streakVal) DOM.streakVal.textContent = 0;

    state.userAnswers.push({
      question: q.q,
      options: q.options,
      correctIndex: q.correct,
      selectedIndex: -1,
      isCorrect: false,
      ref: q.ref || '',
      explanation: q.explanation || ''
    });

    if (DOM.explanationBox && DOM.explanationText) {
      DOM.explanationText.innerHTML = `<strong>انتهى الوقت!</strong> الإجابة الصحيحة كانت: (${q.options[q.correct]})` + (q.ref ? ` [${q.ref}]` : '');
      DOM.explanationBox.style.display = 'block';
    }

    if (DOM.btnNext) DOM.btnNext.disabled = false;
  }

  function goToNextQuestion() {
    state.currentIndex++;
    if (state.currentIndex < state.questions.length) {
      loadCurrentQuestion();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    clearInterval(state.timer);
    const total = state.questions.length;
    const correct = state.userAnswers.filter(a => a.isCorrect).length;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (DOM.resScore) DOM.resScore.textContent = correct * 10;
    if (DOM.resMax) DOM.resMax.textContent = ` / ${total * 10}`;
    if (DOM.resCorrect) DOM.resCorrect.textContent = correct;
    if (DOM.resWrong) DOM.resWrong.textContent = wrong;
    if (DOM.resAccuracy) DOM.resAccuracy.textContent = `${accuracy}%`;

    // Render review
    if (DOM.reviewList) {
      DOM.reviewList.innerHTML = '';
      state.userAnswers.forEach((ans, i) => {
        const item = document.createElement('div');
        item.className = `review-item ${ans.isCorrect ? 'is-correct' : 'is-wrong'}`;
        const userChoice = ans.selectedIndex >= 0 ? ans.options[ans.selectedIndex] : 'لم تتم الإجابة (انتهى الوقت)';
        const correctChoice = ans.options[ans.correctIndex];

        item.innerHTML = `
          <div class="review-q-header">
            <span class="review-q-num">السؤال ${i + 1}</span>
            <span style="font-weight: 800; color: ${ans.isCorrect ? 'var(--color-success)' : 'var(--color-wrong)'}">
              ${ans.isCorrect ? '✓ إجابة صحيحة' : '✕ إجابة غير دقيقة'}
            </span>
          </div>
          <div class="review-q-title">${ans.question}</div>
          <div class="review-ans-grid">
            <div class="review-your-ans">
              <strong>إجابتك:</strong> <span>${userChoice}</span>
            </div>
            <div class="review-right-ans">
              <strong>الإجابة النموذجية:</strong> <span>${correctChoice}</span>
            </div>
            ${ans.ref ? `<div class="review-ref">📖 الشاهد الكتابي: ${ans.ref}</div>` : ''}
          </div>
        `;
        DOM.reviewList.appendChild(item);
      });
    }

    if (accuracy >= 70) {
      playSoundVictory();
      triggerConfetti();
    }

    navigateTo('results');
  }

  // =========================================================================
  // CONFETTI EFFECT
  // =========================================================================

  function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#f59e0b', '#fbbf24', '#c41c48', '#8f1233', '#ffffff', '#15803d'];
    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 4 + 2,
        tilt: Math.random() * 10 - 5
      });
    }

    let frame = 0;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(p.tilt);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      frame++;
      if (frame < 160) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    render();
  }

  // Utility: Shuffle
  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // =========================================================================
  // GLOBAL EVENTS ATTACHMENT
  // =========================================================================

  function attachEvents() {
    // Brand header click -> Home
    if (DOM.headerBrand) {
      DOM.headerBrand.addEventListener('click', () => {
        playSoundClick();
        navigateTo('home');
      });
    }

    // Back Buttons
    if (DOM.btnBack) {
      DOM.btnBack.addEventListener('click', handleBackAction);
    }

    // Breadcrumb clicks
    if (DOM.breadcrumbs) {
      DOM.breadcrumbs.addEventListener('click', e => {
        const a = e.target.closest('a');
        if (!a) return;
        const crumbIndex = parseInt(a.getAttribute('data-crumb'), 10);
        if (crumbIndex === 0) navigateTo('home');
        else if (crumbIndex === 1) {
          const data = getDataSource();
          const book = data[state.bookId];
          if (book && book.testament === 'ot') navigateTo('ot');
          else if (book && book.testament === 'nt') navigateTo('nt');
          else navigateTo('home');
        }
      });
    }

    // Any button with data-page attribute
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-page]');
      if (!btn) return;
      const targetPage = btn.getAttribute('data-page');
      if (targetPage) {
        playSoundClick();
        navigateTo(targetPage);
      }
    });

    // Browser Popstate (Native Back/Forward Button)
    window.addEventListener('popstate', e => {
      if (e.state && e.state.page) {
        navigateTo(e.state.page, e.state.params, false);
      } else {
        const hash = window.location.hash.replace('#', '');
        if (['home', 'ot', 'nt', 'quiz', 'results'].includes(hash)) {
          navigateTo(hash, {}, false);
        } else {
          navigateTo('home', {}, false);
        }
      }
    });

    // Sound toggle
    if (DOM.soundToggle) {
      DOM.soundToggle.addEventListener('click', () => {
        state.sound = !state.sound;
        localStorage.setItem('dawry_sound_2026', state.sound);
        DOM.soundToggle.innerHTML = state.sound 
          ? '<span class="sound-icon">🔊</span><span class="sound-text"> الصوت: مفعل</span>' 
          : '<span class="sound-icon">🔇</span><span class="sound-text"> الصوت: صامت</span>';
        if (state.sound) playSoundClick();
      });
    }

    // Modes
    DOM.modes.forEach(card => {
      card.addEventListener('click', () => {
        playSoundClick();
        DOM.modes.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.mode = card.getAttribute('data-mode');
      });
    });

    // Chapter Click in OT and NT grids
    document.addEventListener('click', e => {
      const btn = e.target.closest('.chapter-btn');
      if (!btn || btn.disabled) return;
      playSoundClick();
      const b = btn.getAttribute('data-book');
      const c = btn.getAttribute('data-chapter');
      startQuiz(b, c);
    });

    // Quiz Controls
    if (DOM.btnNext) {
      DOM.btnNext.addEventListener('click', () => {
        playSoundClick();
        goToNextQuestion();
      });
    }

    if (DOM.btnQuit) {
      DOM.btnQuit.addEventListener('click', () => {
        handleBackAction();
      });
    }

    // Results Actions
    if (DOM.btnRestart) {
      DOM.btnRestart.addEventListener('click', () => {
        playSoundClick();
        startQuiz(state.bookId, state.chapterNum);
      });
    }

    if (DOM.btnChooseOther) {
      DOM.btnChooseOther.addEventListener('click', () => {
        playSoundClick();
        const data = getDataSource();
        const b = data[state.bookId];
        if (b && b.testament === 'ot') navigateTo('ot');
        else navigateTo('nt');
      });
    }

    if (DOM.btnResHome) {
      DOM.btnResHome.addEventListener('click', () => {
        playSoundClick();
        navigateTo('home');
      });
    }
  }

  // =========================================================================
  // BOOTSTRAP APPLICATION
  // =========================================================================

  function initApp() {
    if (DOM.soundToggle) {
      DOM.soundToggle.innerHTML = state.sound 
        ? '<span class="sound-icon">🔊</span><span class="sound-text"> الصوت: مفعل</span>' 
        : '<span class="sound-icon">🔇</span><span class="sound-text"> الصوت: صامت</span>';
    }

    calculateAndDisplayStats();
    renderBooks();
    attachEvents();

    // Check initial route hash
    const hash = window.location.hash.replace('#', '');
    if (['home', 'ot', 'nt'].includes(hash)) {
      navigateTo(hash, {}, false);
    } else {
      navigateTo('home', {}, false);
    }
  }

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();

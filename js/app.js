import { getFilteredItems, loadDataset, TOPIC_COLORS } from './data.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'interview'];
const state = {
  dataset: null,
  screen: 'terms',
  filters: { subjectId: '', topicNames: new Set(), levels: new Set(), search: '' }
};

const app = document.querySelector('#app');

async function start() {
  renderLoading();
  try {
    state.dataset = await loadDataset();
    state.filters.subjectId = state.dataset.subjects[0].id;
    render();
  } catch (error) {
    renderError(error);
  }
}

function renderLoading() {
  app.innerHTML = '<main class="loading-screen" aria-live="polite"><p class="eyebrow">STUDY CLUB / JAVASCRIPT</p><h1>Loading your study desk…</h1><p>Gathering every topic before opening the app.</p></main>';
}

function renderError(error) {
  app.innerHTML = `<main class="loading-screen error-panel" role="alert"><p class="eyebrow">LOAD ERROR</p><h1>Could not load the study data.</h1><p>${escapeHtml(error.message)}</p><button class="button button-dark" data-action="retry">Try again</button></main>`;
  app.querySelector('[data-action="retry"]').addEventListener('click', start);
}

function render() {
  const terms = getFilteredItems(state, 'terms');
  const questions = getFilteredItems(state, 'questions');
  const subject = state.dataset.subjects.find(item => item.id === state.filters.subjectId);
  const topicLabel = state.filters.topicNames.size
    ? [...state.filters.topicNames].join(' · ')
    : 'All topics';

  app.innerHTML = `
    <div class="app-shell">
      <aside class="rail">
        <a class="brand" href="#" aria-label="Study Club home"><span class="brand-mark">S</span><span>study club</span></a>
        <nav class="primary-nav" aria-label="Main navigation">
          ${navButton('terms', 'Terms', '✳')}
          ${navButton('practice', 'Practice', '↗')}
          ${navButton('progress', 'Progress', '▥')}
        </nav>
        <div class="rail-scope">
          <p class="eyebrow">YOUR SCOPE</p>
          <strong>${escapeHtml(topicLabel)}</strong>
          <span>${terms.length} terms · ${questions.length} questions</span>
        </div>
        <p class="rail-note">Small steps.<br>Big brain energy.</p>
      </aside>
      <main class="main-content">
        <header class="topbar">
          <div class="subject-picker">
            <label class="sr-only" for="subject-select">Subject</label>
            <select id="subject-select">${state.dataset.subjects.map(item =>
              `<option value="${escapeHtml(item.id)}" ${item.id === state.filters.subjectId ? 'selected' : ''}>${escapeHtml(titleCase(item.id))}</option>`
            ).join('')}</select>
          </div>
          <div class="scope-pill" aria-live="polite"><span class="scope-dot"></span>Scope: ${escapeHtml(topicLabel)} · ${terms.length} terms · ${questions.length} questions</div>
        </header>
        <section class="filter-panel" aria-label="Study filters">
          <div class="filter-row">
            <span class="filter-label">TOPICS</span>
            <div class="chip-list" id="topic-chips">
              <button class="chip ${state.filters.topicNames.size === 0 ? 'is-selected' : ''}" data-topic="">All topics</button>
              ${subject.topics.map(topic => {
                const name = topic.meta.topic;
                return `<button class="chip ${state.filters.topicNames.has(name) ? 'is-selected' : ''}" data-topic="${escapeHtml(name)}" style="--topic-color:${TOPIC_COLORS.get(name)}">${escapeHtml(name)}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="filter-row level-row">
            <span class="filter-label">LEVEL</span>
            <div class="chip-list" id="level-chips">
              <button class="chip ${state.filters.levels.size === 0 ? 'is-selected' : ''}" data-level="">All levels</button>
              ${LEVELS.map(level => `<button class="chip ${state.filters.levels.has(level) ? 'is-selected' : ''}" data-level="${level}">${titleCase(level)}</button>`).join('')}
            </div>
            <label class="search-wrap"><span aria-hidden="true">⌕</span><input id="search-input" type="search" value="${escapeHtml(state.filters.search)}" placeholder="Search terms or questions" aria-label="Search terms or questions"></label>
          </div>
        </section>
        <div id="screen-content">${renderPlaceholder(terms.length, questions.length)}</div>
      </main>
      <nav class="mobile-nav" aria-label="Main navigation">
        ${navButton('terms', 'Terms', '✳')}
        ${navButton('practice', 'Practice', '↗')}
        ${navButton('progress', 'Progress', '▥')}
      </nav>
    </div>`;
  bindShellEvents();
}

function navButton(screen, label, icon) {
  return `<button class="nav-button ${state.screen === screen ? 'is-active' : ''}" data-screen="${screen}" ${state.screen === screen ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
}

function renderPlaceholder(termCount, questionCount) {
  const messages = {
    terms: ['Words make worlds.', 'Your term library is loaded and ready for flashcards, spelling, and quick picks.', `${termCount} terms in this scope`],
    practice: ['Make it stick.', 'Build a question session from the topics and levels selected above.', `${questionCount} questions in this scope`],
    progress: ['Look how far you came.', 'Your study streaks and weak spots will live here.', 'Progress is saved on this device']
  };
  const [title, copy, tag] = messages[state.screen];
  return `<section class="welcome-grid"><div class="welcome-card tilt-left"><p class="eyebrow">${state.screen.toUpperCase()} / READY</p><h1>${title}</h1><p>${copy}</p><span class="count-tag">${tag}</span></div><div class="welcome-aside tilt-right"><span class="sticker" aria-hidden="true">✦</span><p class="eyebrow">ACTIVE FILTERS</p><p>${escapeHtml([...state.filters.topicNames].join(', ') || 'Every topic')}</p><p>${escapeHtml([...state.filters.levels].map(titleCase).join(', ') || 'Every level')}</p></div></section>`;
}

function bindShellEvents() {
  app.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
    state.screen = button.dataset.screen;
    render();
  }));
  app.querySelector('#subject-select').addEventListener('change', event => {
    state.filters.subjectId = event.target.value;
    state.filters.topicNames.clear();
    render();
  });
  app.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.topic;
    if (!name) state.filters.topicNames.clear();
    else {
      state.filters.topicNames.has(name) ? state.filters.topicNames.delete(name) : state.filters.topicNames.add(name);
    }
    render();
  }));
  app.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
    const level = button.dataset.level;
    if (!level) state.filters.levels.clear();
    else {
      state.filters.levels.has(level) ? state.filters.levels.delete(level) : state.filters.levels.add(level);
    }
    render();
  }));
  app.querySelector('#search-input').addEventListener('input', event => {
    const selectionStart = event.target.selectionStart;
    state.filters.search = event.target.value;
    render();
    const search = app.querySelector('#search-input');
    search.focus();
    search.setSelectionRange(selectionStart, selectionStart);
  });
}

function titleCase(value) {
  return String(value).replace(/[-_]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

start();

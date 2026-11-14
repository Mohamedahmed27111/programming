import { normalizeText, TOPIC_COLORS } from './data.js';
import { escapeHtml, highlightCode, shuffle } from './ui.js';
import { recordTermSession, saveProgress } from './progress.js';

const SESSION_SIZE = 10;

export function renderTerms(state, terms) {
  const ts = state.termState;
  const poolKey = terms.map(term => term.id).join('|');
  if (!ts || ts.poolKey !== poolKey) resetTermMode(state, terms, ts?.mode || 'flashcards');
  const termState = state.termState;
  termState.known = new Set(Object.keys(state.progress?.terms || {}).filter(id => state.progress.terms[id] === 'known'));
  termState.learning = new Set(Object.keys(state.progress?.terms || {}).filter(id => state.progress.terms[id] === 'learning'));
  return `<section class="terms-screen">
    <div class="screen-heading"><div><p class="eyebrow">TERMS / ${terms.length} AVAILABLE</p><h1>Words make worlds.</h1></div><p>Learn a little, remember a lot.</p></div>
    <div class="segmented-control" role="group" aria-label="Term study mode">
      ${modeButton(termState.mode, 'flashcards', 'Flashcards')}
      ${modeButton(termState.mode, 'choose', 'Choose')}
      ${modeButton(termState.mode, 'spell-en', 'Spell EN')}
      ${modeButton(termState.mode, 'spell-ar', 'Spell AR')}
    </div>
    ${terms.length ? renderMode(state, terms) : '<div class="empty-state"><h2>No terms in this scope</h2><p>Change your topic, level, or search filters to continue.</p></div>'}
  </section>`;
}

export function bindTerms(app, state, terms, rerender, onTermStatus) {
  const ts = state.termState;
  if (state.termKeyHandler) window.removeEventListener('keydown', state.termKeyHandler);
  app.querySelectorAll('[data-term-mode]').forEach(button => button.addEventListener('click', () => {
    resetTermMode(state, terms, button.dataset.termMode);
    rerender();
  }));
  app.querySelector('.flashcard')?.addEventListener('click', event => {
    if (event.target.closest('button')) return;
    ts.flipped = !ts.flipped;
    rerender();
  });
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const action = button.dataset.action;
    if (action === 'copy') copyTerm(button.dataset.resultCopy ?? ts.currentTerm?.term, button);
    if (action === 'flip') ts.flipped = !ts.flipped;
    if (action === 'next-card') {
      ts.index = (ts.index + 1) % terms.length;
      ts.flipped = false;
    }
    if (action === 'mark-known' || action === 'mark-learning') {
      const status = action === 'mark-known' ? 'known' : 'learning';
      (status === 'known' ? ts.learning : ts.known).delete(ts.currentTerm.id);
      (status === 'known' ? ts.known : ts.learning).add(ts.currentTerm.id);
      onTermStatus?.(ts.currentTerm.id, status);
      ts.index = (ts.index + 1) % terms.length;
      ts.flipped = false;
    }
    if (action === 'select-option') ts.selected = Number(button.dataset.option);
    if (action === 'check-choice') checkChoice(ts);
    if (action === 'check-spelling') checkSpelling(ts);
    if (action === 'hint-pattern') ts.hints = Math.max(ts.hints, 1);
    if (action === 'hint-definition') ts.hints = Math.max(ts.hints, 2);
    if (action === 'quiz-next') advanceQuiz(state);
    if (action === 'retry-missed') retryMissed(state, terms);
    if (action === 'new-quiz') resetTermMode(state, terms, ts.mode);
    rerender();
  }));
  app.querySelector('[data-term-answer]')?.addEventListener('input', event => {
    ts.answer = event.target.value;
    if (ts.feedback) ts.feedback = null;
  });

  state.termKeyHandler = event => {
    if (state.screen !== 'terms' || terms.length === 0) return;
    const editing = event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
    if (ts.mode === 'flashcards') {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        ts.index = (ts.index + (event.key === 'ArrowRight' ? 1 : -1) + terms.length) % terms.length;
        ts.flipped = false;
        rerender();
      } else if (!editing && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        ts.flipped = !ts.flipped;
        rerender();
      } else if (!editing && ['k', 'l'].includes(event.key.toLowerCase())) {
        const status = event.key.toLowerCase() === 'k' ? 'known' : 'learning';
        (status === 'known' ? ts.learning : ts.known).delete(ts.currentTerm.id);
        (status === 'known' ? ts.known : ts.learning).add(ts.currentTerm.id);
        onTermStatus?.(ts.currentTerm.id, status);
        ts.index = (ts.index + 1) % terms.length;
        ts.flipped = false;
        rerender();
      }
    } else if (ts.mode === 'choose' && !editing && /^[1-4]$/.test(event.key) && !ts.feedback) {
      ts.selected = Number(event.key) - 1;
      rerender();
    } else if (event.key === 'Enter' &&
      (!editing || (ts.mode.startsWith('spell-') && event.target.matches('[data-term-answer]')))) {
      event.preventDefault();
      if (ts.feedback) advanceQuiz(state);
      else if (ts.mode === 'choose' && ts.selected !== null) checkChoice(ts);
      else if (ts.mode.startsWith('spell-')) checkSpelling(ts);
      rerender();
    }
  };
  window.addEventListener('keydown', state.termKeyHandler);
}

function renderMode(state, terms) {
  const ts = state.termState;
  if (ts.result) return renderResult(ts);
  if (ts.mode === 'flashcards') return renderFlashcard(ts, terms);
  if (!ts.session.length) return '<div class="empty-state"><h2>Not enough unique terms</h2><p>Choose needs four distinct terms; spelling needs at least one.</p></div>';
  return ts.mode === 'choose' ? renderChoose(ts) : renderSpelling(ts);
}

function renderFlashcard(ts, terms) {
  const term = terms[ts.index % terms.length];
  ts.currentTerm = term;
  return `<div class="flashcard-layout">
    <p class="session-progress">CARD ${ts.index + 1} <span>/</span> ${terms.length} <span class="progress-spacer"></span><span>${ts.known.size} known · ${ts.learning.size} learning</span></p>
    <article class="flashcard ${ts.flipped ? 'is-flipped' : ''}" tabindex="0" role="button" aria-label="${ts.flipped ? 'Flashcard back. Activate to see the term' : 'Flashcard front. Activate to see definitions'}">
      <div class="flashcard-face flashcard-front">
        <div class="card-topline">${topicTag(term.topic)}<button class="copy-button" type="button" data-action="copy" aria-label="Copy term">Copy term</button></div>
        <span class="flash-term">${escapeHtml(term.display || term.term)}</span>
        <span class="card-hint">Click, Enter, or Space to flip</span>
      </div>
      <div class="flashcard-face flashcard-back">
        <div class="card-topline">${topicTag(term.topic)}<button class="copy-button" type="button" data-action="copy" aria-label="Copy term">Copy term</button></div>
        <div class="definition-pair"><p>${escapeHtml(term.definitionEn)}</p><p class="definition-ar" dir="rtl">${escapeHtml(term.definitionAr)}</p></div>
        ${term.example ? `<pre class="code-block"><code>${highlightCode(term.example)}</code></pre>` : ''}
        <span class="card-hint">Click the card to return to the term</span>
      </div>
    </article>
    <div class="flash-actions"><button class="button button-quiet" data-action="mark-learning">Still learning <kbd>L</kbd></button><button class="button button-dark" data-action="mark-known">Got it <kbd>K</kbd></button><button class="button button-quiet" data-action="next-card">Next →</button></div>
  </div>`;
}

function renderChoose(ts) {
  const question = ts.session[ts.index];
  const definitionToTerm = question.direction === 'definition';
  return `<div class="quiz-card tilt-left">
    <div class="quiz-topline">${topicTag(question.term.topic)}<span>${ts.index + 1} / ${ts.session.length}</span></div>
    <p class="eyebrow">${definitionToTerm ? 'DEFINITION → TERM' : 'TERM → DEFINITION'}</p>
    <h2 class="${definitionToTerm ? 'definition-ar' : ''}" ${definitionToTerm ? 'dir="rtl"' : ''}>${escapeHtml(definitionToTerm ? question.term.definitionEn : question.term.display || question.term.term)}</h2>
    <div class="answer-options">${question.options.map((option, index) => {
      const selected = ts.selected === index;
      const correct = ts.feedback && index === question.correctIndex;
      const wrong = ts.feedback && selected && !correct;
      const text = definitionToTerm ? option.display || option.term : option.definitionEn;
      return `<button class="answer-option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}" data-action="select-option" data-option="${index}" ${ts.feedback ? 'disabled' : ''}><kbd>${index + 1}</kbd><span>${escapeHtml(text)}</span></button>`;
    }).join('')}</div>
    ${ts.feedback ? `<p class="inline-feedback ${ts.feedback.correct ? 'success' : 'failure'}" aria-live="polite">${ts.feedback.correct ? 'Correct!' : `Not quite — ${escapeHtml(question.term.term)}.`}</p>` : ''}
    <div class="quiz-footer"><span>Choose an answer · keys 1–4</span>${ts.feedback ? '<button class="button button-dark" data-action="quiz-next">Next →</button>' : '<button class="button button-dark" data-action="check-choice" ' + (ts.selected === null ? 'disabled' : '') + '>Check answer</button>'}</div>
  </div>`;
}

function renderSpelling(ts) {
  const item = ts.session[ts.index];
  ts.currentTerm = item.term;
  const arabicPrompt = ts.mode === 'spell-ar';
  const definition = arabicPrompt ? item.term.definitionAr : item.term.definitionEn;
  const accepted = [item.term.term, ...(item.term.aliases || [])];
  return `<div class="quiz-card spelling-card tilt-right">
    <div class="quiz-topline">${topicTag(item.term.topic)}<span>${ts.index + 1} / ${ts.session.length}</span></div>
    <p class="eyebrow">${arabicPrompt ? 'TYPE THE ENGLISH TERM / ARABIC CLUE' : 'SPELL IN ENGLISH'}</p>
    <h2 class="spelling-definition ${arabicPrompt ? 'definition-ar' : ''}" ${arabicPrompt ? 'dir="rtl"' : ''}>${escapeHtml(maskTerm(definition, accepted))}</h2>
    <label class="sr-only" for="term-answer">Type the term</label>
    <input id="term-answer" data-term-answer autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="${escapeHtml(ts.answer)}" placeholder="Type the term…" ${ts.feedback ? 'disabled' : ''}>
    ${ts.hints > 0 && !ts.feedback ? `<p class="hint-text">${hintPattern(item.term.term)}</p>` : ''}
    ${ts.hints > 1 && !ts.feedback ? `<p class="hint-text definition-ar" dir="${arabicPrompt ? 'ltr' : 'rtl'}">${escapeHtml(arabicPrompt ? item.term.definitionEn : item.term.definitionAr)}</p>` : ''}
    ${ts.feedback ? renderSpellingFeedback(ts, item.term) : ''}
    <div class="hint-actions">${!ts.feedback ? '<button class="text-button" data-action="hint-pattern">Hint 1 <span>letter pattern</span></button><button class="text-button" data-action="hint-definition">Hint 2 <span>other language</span></button>' : ''}<span class="hint-count">${ts.hints ? `${ts.hints} hint${ts.hints > 1 ? 's' : ''} used` : ''}</span></div>
    <div class="quiz-footer"><span>Press Enter to check / continue</span>${ts.feedback ? `${ts.feedback.correct ? '' : '<button class="button button-quiet" data-action="copy">Copy term</button>'}<button class="button button-dark" data-action="quiz-next">Next →</button>` : '<button class="button button-dark" data-action="check-spelling">Check answer</button>'}</div>
  </div>`;
}

function renderSpellingFeedback(ts, term) {
  if (ts.feedback.correct) return '<div class="inline-feedback success" aria-live="polite">Correct! Nicely spelled.</div>';
  return `<div class="inline-feedback failure" aria-live="polite"><strong>Not quite.</strong> ${renderDiff(ts.feedback.answer, term.term, term.caseSensitive)}<p>The answer is <strong>${escapeHtml(term.term)}</strong>.</p>${term.example ? `<pre class="code-block"><code>${highlightCode(term.example)}</code></pre>` : ''}</div>`;
}

function renderResult(ts) {
  const missed = ts.result.missed;
  return `<section class="results-card">
    <p class="eyebrow">SPELLING / RESULTS</p><h2>${ts.result.score} / ${ts.result.total} correct</h2>
    ${ts.mode.startsWith('spell-') ? `<p>You used ${ts.result.hints} hint${ts.result.hints === 1 ? '' : 's'}.</p>` : ''}
    ${missed.length ? `<h3>Review these terms</h3><ul class="missed-list">${missed.map(item => `<li><strong>${escapeHtml(item.term.term)}</strong><span>${escapeHtml(item.term.definitionEn)}</span><button data-action="copy" data-result-copy="${escapeHtml(item.term.term)}">Copy</button></li>`).join('')}</ul><button class="button button-dark" data-action="retry-missed">Retry missed (${missed.length})</button>` : '<p class="all-correct">Perfect round ✦</p>'}
    <button class="button button-quiet" data-action="new-quiz">New round</button>
  </section>`;
}

function resetTermMode(state, terms, mode) {
  const previous = state.termState;
  const poolKey = terms.map(term => term.id).join('|');
  const unique = uniqueTerms(terms);
  const required = mode === 'choose' ? 4 : 1;
  const ts = state.termState = {
    mode, poolKey, index: 0, flipped: false,
    known: previous?.known || new Set(Object.keys(state.progress?.terms || {}).filter(id => state.progress.terms[id] === 'known')),
    learning: previous?.learning || new Set(Object.keys(state.progress?.terms || {}).filter(id => state.progress.terms[id] === 'learning')),
    session: [], selected: null, feedback: null, answer: '', hints: 0,
    result: null, results: [], totalHints: 0, currentTerm: terms[0] || null
  };
  ts.pool = unique;
  if (mode !== 'flashcards' && unique.length >= required) ts.session = makeQuiz(unique, mode);
}

function makeQuiz(terms, mode, distractorPool = terms) {
  return shuffle(uniqueTerms(terms)).slice(0, SESSION_SIZE).map(term => {
    if (mode !== 'choose') return { term };
    const direction = Math.random() < .5 ? 'term' : 'definition';
    const choices = shuffle([term, ...shuffle(distractorPool.filter(other => other.id !== term.id)).slice(0, 3)]);
    return { term, direction, options: choices, correctIndex: choices.findIndex(choice => choice.id === term.id) };
  });
}

function uniqueTerms(terms) {
  const found = new Set();
  return terms.filter(term => {
    const key = normalizeText(term.term);
    if (found.has(key)) return false;
    found.add(key);
    return true;
  });
}

function checkChoice(ts) {
  if (ts.selected === null || ts.feedback) return;
  ts.feedback = { correct: ts.selected === ts.session[ts.index].correctIndex };
}

function checkSpelling(ts) {
  if (ts.feedback) return;
  const item = ts.session[ts.index];
  const actual = normalizeSpelling(ts.answer, item.term.caseSensitive);
  const correct = [item.term.term, ...(item.term.aliases || [])]
    .some(answer => actual === normalizeSpelling(answer, item.term.caseSensitive));
  ts.feedback = { correct, answer: ts.answer };
}

function advanceQuiz(state) {
  const ts = state.termState;
  const item = ts.session[ts.index];
  const result = { correct: Boolean(ts.feedback?.correct), term: item.term };
  if (ts.mode.startsWith('spell-')) Object.assign(result, { answer: ts.answer, hints: ts.hints });
  ts.results.push(result);
  if (ts.mode.startsWith('spell-')) ts.totalHints += ts.hints;
  if (ts.index + 1 >= ts.session.length) {
    const missed = ts.mode === 'choose'
      ? ts.session.filter((_, index) => !ts.results[index].correct)
      : ts.results.filter(entry => !entry.correct);
    ts.result = {
      score: ts.results.filter(entry => entry.correct).length,
      total: ts.session.length,
      hints: ts.totalHints,
      missed
    };
    if (state.progress) {
      recordTermSession(state.progress, ts.mode, ts.results);
      state.progressMessage = saveProgress(state.progress);
    }
    return;
  }
  ts.index += 1;
  ts.selected = null;
  ts.feedback = null;
  ts.answer = '';
  ts.hints = 0;
  requestAnimationFrame(() => document.querySelector('[data-term-answer]')?.focus());
}

function retryMissed(state, terms) {
  const ts = state.termState;
  const missedTerms = ts.result.missed.map(item => item.term);
  ts.session = ts.mode === 'choose' ? makeQuiz(missedTerms, 'choose', ts.pool) : missedTerms.map(term => ({ term }));
  ts.result = null;
  ts.index = 0;
  ts.results = [];
  ts.totalHints = 0;
  ts.feedback = null;
  ts.answer = '';
  ts.hints = 0;
  if (!ts.session.length) resetTermMode(state, terms, ts.mode);
}

function normalizeSpelling(value, caseSensitive) {
  const normalized = String(value).trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
  return caseSensitive ? normalized : normalized.toLocaleLowerCase();
}

function hintPattern(term) {
  return [...term].map(char => /\s/.test(char) || char === '-' ? ' / ' : '_').join(' ');
}

function maskTerm(text, candidates) {
  let masked = String(text);
  for (const candidate of candidates) {
    if (!candidate) continue;
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
    masked = masked.replace(new RegExp(escaped, 'gi'), match => '_'.repeat([...match].length));
  }
  return masked;
}

function renderDiff(answer, expected, caseSensitive) {
  const input = [...answer];
  const target = [...expected];
  let html = '';
  for (let index = 0; index < Math.max(input.length, target.length); index += 1) {
    const actualChar = input[index] ?? '·';
    const expectedChar = target[index] ?? '·';
    const same = caseSensitive ? actualChar === expectedChar : actualChar.toLocaleLowerCase() === expectedChar.toLocaleLowerCase();
    html += `<span class="${same ? 'diff-correct' : 'diff-wrong'}">${escapeHtml(actualChar)}</span>`;
  }
  return `<p class="letter-diff" aria-label="Your answer compared with the correct spelling">${html}</p>`;
}

async function copyTerm(value, button) {
  if (!value) return;
  button.textContent = 'Copying…';
  let timeout;
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Clipboard API timed out')), 700);
        })
      ]);
    }
    else fallbackCopy(value);
  } catch {
    try { fallbackCopy(value); }
    catch {
      button.textContent = 'Copy unavailable';
      return;
    }
  } finally {
    clearTimeout(timeout);
  }
  button.textContent = 'Copied ✓';
  setTimeout(() => { if (button.isConnected) button.textContent = button.dataset.action === 'copy' ? 'Copy term' : 'Copy'; }, 1500);
}

function fallbackCopy(value) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy was not available');
}

function modeButton(active, mode, label) {
  return `<button class="mode-button ${active === mode ? 'is-active' : ''}" data-term-mode="${mode}" aria-pressed="${active === mode}">${label}</button>`;
}

function topicTag(topic) {
  return `<span class="topic-tag" style="--topic-color:${TOPIC_COLORS.get(topic) || '#ffd166'}">${escapeHtml(topic)}</span>`;
}

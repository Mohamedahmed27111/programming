import { runWriteCode } from './worker-runner.js';
import { escapeHtml, formatValue, highlightCode, shuffle } from './ui.js';
import { TOPIC_COLORS } from './data.js';

const QUESTION_TYPES = ['whatDoes', 'predictOutput', 'completeCode', 'writeCode', 'interview'];

export function renderPractice(state, questions) {
  const signature = questions.map(question => question.id).join('|');
  if (!state.practice || state.practice.poolKey !== signature) {
    const previousOptionOrders = state.practice?.previousOptionOrders || new Map();
    state.practice = {
      poolKey: signature, phase: 'setup', count: '10',
      selectedTypes: new Set(QUESTION_TYPES), session: [], index: 0,
      answerResult: null, answers: [], blankValues: [], selected: null,
      revealed: false, covered: new Set(), workerRunning: false,
      solutionShown: false, previousOptionOrders
    };
  }
  const practice = state.practice;
  if (practice.phase === 'setup') return renderSetup(practice, questions);
  if (practice.phase === 'results') return renderResults(practice);
  return renderActive(practice);
}

export function bindPractice(app, state, questions, rerender) {
  const practice = state.practice;
  app.querySelectorAll('[data-type-toggle]').forEach(input => input.addEventListener('change', () => {
    input.checked ? practice.selectedTypes.add(input.value) : practice.selectedTypes.delete(input.value);
  }));
  app.querySelector('[data-count-select]')?.addEventListener('change', event => { practice.count = event.target.value; });
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.action;
    if (action === 'start-session') {
      startSession(practice, questions);
    } else if (action === 'select-answer') {
      practice.selected = Number(button.dataset.option);
    } else if (action === 'check-answer') {
      checkAnswer(practice);
    } else if (action === 'run-tests') {
      await runTests(practice, app, rerender);
      return;
    } else if (action === 'give-up') {
      practice.solutionShown = true;
      practice.answerResult = { correct: false, answer: currentUserAnswer(app, practice) };
    } else if (action === 'show-solution') {
      practice.solutionShown = true;
    } else if (action === 'reveal-interview') {
      practice.revealed = true;
      practice.answerResult = { correct: false };
    } else if (action === 'toggle-point') {
      const point = Number(button.dataset.point);
      practice.covered.has(point) ? practice.covered.delete(point) : practice.covered.add(point);
      practice.answerResult = { correct: practice.covered.size === currentQuestion(practice).keyPoints.length };
    } else if (action === 'next-question') {
      finishQuestion(practice, app);
    } else if (action === 'retry-missed') {
      retryMissed(practice);
    } else if (action === 'new-session') {
      practice.phase = 'setup';
      practice.session = [];
      practice.answers = [];
      practice.answerResult = null;
    }
    rerender();
  }));
  app.querySelectorAll('[data-answer-input]').forEach(input => input.addEventListener('input', () => {
    practice.answer = input.value;
  }));
  app.querySelectorAll('[data-blank-index]').forEach(input => input.addEventListener('input', () => {
    practice.blankValues[Number(input.dataset.blankIndex)] = input.value;
  }));
  app.querySelectorAll('[data-code-editor]').forEach(editor => {
    editor.addEventListener('input', () => { practice.answer = editor.value; });
    editor.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.setRangeText('  ', start, end, 'end');
      practice.answer = editor.value;
    });
  });
  app.querySelectorAll('[data-point]').forEach(button => button.addEventListener('change', () => {
    const point = Number(button.dataset.point);
    button.checked ? practice.covered.add(point) : practice.covered.delete(point);
    practice.answerResult = { correct: practice.covered.size === currentQuestion(practice).keyPoints.length };
  }));
  app.querySelectorAll('[data-interview-reveal]').forEach(button => button.addEventListener('click', () => {
    practice.revealed = true;
    practice.answerResult = { correct: false };
    rerender();
  }));

  window.onkeydown = event => {
    if (state.screen !== 'practice' || practice.phase !== 'question') return;
    const current = currentQuestion(practice);
    if (['whatDoes', 'predictOutput'].includes(current.type) &&
        (current.type === 'whatDoes' || current.mode === 'choose') &&
        /^[1-4]$/.test(event.key) && !practice.answerResult) {
      practice.selected = Number(event.key) - 1;
      rerender();
    } else if (event.key === 'Enter' && !event.target.matches('textarea, input, select') &&
      current.type !== 'writeCode' && current.type !== 'interview') {
      event.preventDefault();
      if (practice.answerResult) finishQuestion(practice, app);
      else checkAnswer(practice);
      rerender();
    }
  };
}

function renderSetup(practice, questions) {
  return `<section class="practice-screen">
    <div class="screen-heading"><div><p class="eyebrow">PRACTICE / SETUP</p><h1>Make it stick.</h1></div><p>Choose your question mix. Current filters define the session pool.</p></div>
    <div class="practice-setup">
      <div class="setup-card"><p class="eyebrow">QUESTION TYPES</p><div class="type-checks">${QUESTION_TYPES.map(type =>
        `<label class="type-check"><input type="checkbox" data-type-toggle value="${type}" ${practice.selectedTypes.has(type) ? 'checked' : ''}><span>${typeLabel(type)}</span></label>`
      ).join('')}</div>
        <label class="setup-count">SESSION SIZE<select data-count-select><option value="10" ${practice.count === '10' ? 'selected' : ''}>10 questions</option><option value="20" ${practice.count === '20' ? 'selected' : ''}>20 questions</option><option value="all" ${practice.count === 'all' ? 'selected' : ''}>All available</option></select></label>
        <p class="pool-note">${questions.length} questions available in this scope.</p>
        <button class="button button-dark" data-action="start-session" ${questions.length === 0 ? 'disabled' : ''}>Start practice →</button>
      </div>
      <aside class="setup-aside"><span class="sticker" aria-hidden="true">↗</span><p class="eyebrow">SESSION TIP</p><h2>Mix it up.</h2><p>Each session shuffles question order and answer choices.</p><p class="shortcut-note">Shortcuts: 1–4 choose · Enter check/continue · Tab indents code</p></aside>
    </div>
  </section>`;
}

function renderActive(practice) {
  const question = currentQuestion(practice);
  return `<section class="practice-screen">
    <div class="practice-progress"><span class="eyebrow">PRACTICE / ${practice.index + 1} OF ${practice.session.length}</span><button class="text-button" data-action="new-session">Exit session</button></div>
    ${renderQuestion(practice, question)}
  </section>`;
}

function renderQuestion(practice, question) {
  const header = `<div class="question-tags">${topicTag(question.topic)}<span class="small-tag">${escapeHtml(question.level)}</span><span class="small-tag">${escapeHtml(question.sourceSection)}</span></div>`;
  const footer = practice.answerResult
    ? `<div class="practice-feedback ${practice.answerResult.correct ? 'success' : 'failure'}" aria-live="polite">${practice.answerResult.correct ? 'Nice work — correct.' : 'Not quite. Review the answer below.'}<p>${escapeHtml(question.explanation || '')}</p>${question.explanationAr ? `<p class="definition-ar" dir="rtl">${escapeHtml(question.explanationAr)}</p>` : ''}</div><button class="button button-dark next-question" data-action="next-question">${practice.index + 1 === practice.session.length ? 'See results →' : 'Next question →'}</button>`
    : '';
  if (question.type === 'whatDoes') {
    return `<article class="question-card">${header}<h2>${escapeHtml(question.question)}</h2>${renderCode(question.code)}${renderOptions(practice, question)}${footer}</article>`;
  }
  if (question.type === 'predictOutput') {
    const choose = question.mode === 'choose';
      const typeInput = `<label class="answer-label" for="practice-answer">Your output</label><textarea id="practice-answer" data-answer-input rows="4" placeholder="Type the exact output…">${escapeHtml(practice.answer || '')}</textarea>`;
    const expected = practice.answerResult ? `<div class="expected-output"><span class="eyebrow">EXPECTED OUTPUT</span><pre>${escapeHtml(question.expectedOutput)}</pre></div>` : '';
    return `<article class="question-card">${header}<h2>What does this code print?</h2>${renderCode(question.code)}${choose ? renderOptions(practice, question) : typeInput}${expected}${choose ? '' : (!practice.answerResult ? '<button class="button button-dark" data-action="check-answer">Check output</button>' : '')}${footer}</article>`;
  }
  if (question.type === 'completeCode') {
    return `<article class="question-card">${header}<h2>${escapeHtml(question.prompt)}</h2>${renderInlineBlanks(practice, question)}${footer}${practice.answerResult ? '' : '<button class="button button-dark" data-action="check-answer">Check blanks</button>'}</article>`;
  }
  if (question.type === 'writeCode') {
    const results = practice.runResults ? renderTestResults(practice.runResults) : '';
    const solution = practice.solutionShown ? `<h3>Solution</h3>${renderCode(question.solution)}` : '';
    const solutionLabel = practice.solutionShown ? 'Solution shown' : practice.answerResult ? 'Show solution' : 'Give up / show solution';
    return `<article class="question-card">${header}<h2>${escapeHtml(question.prompt)}</h2><label class="answer-label" for="code-editor">Your solution</label><textarea id="code-editor" class="code-editor" data-code-editor spellcheck="false" autocapitalize="off" autocomplete="off">${escapeHtml(practice.answer ?? question.starter)}</textarea><div class="write-actions"><button class="button button-dark" data-action="run-tests" ${practice.workerRunning ? 'disabled' : ''}>${practice.workerRunning ? 'Running…' : 'Run tests'}</button><button class="text-button" data-action="${practice.solutionShown ? 'show-solution' : 'give-up'}">${solutionLabel}</button></div>${results}${solution}${footer}</article>`;
  }
  const keyPoints = practice.revealed ? `<div class="key-points"><p class="eyebrow">KEY POINTS — TICK WHAT YOU COVERED</p>${question.keyPoints.map((point, index) =>
    `<label><input type="checkbox" data-point="${index}" ${practice.covered.has(index) ? 'checked' : ''}><span>${escapeHtml(point)}</span></label>`
  ).join('')}</div><div class="model-answer"><p class="eyebrow">MODEL ANSWER</p><p>${escapeHtml(question.modelAnswer)}</p></div>` : '';
  return `<article class="question-card">${header}<h2>${escapeHtml(question.question)}</h2><label class="answer-label" for="interview-answer">Your answer</label><textarea id="interview-answer" data-answer-input rows="5" placeholder="Explain it in your own words…">${escapeHtml(practice.answer || '')}</textarea>${practice.revealed ? keyPoints : '<button class="button button-dark" data-interview-reveal>Reveal key points</button>'}${footer}</article>`;
}

function renderOptions(practice, question) {
  return `<div class="answer-options">${question.options.map((option, index) => {
    const selected = practice.selected === index;
    const correct = practice.answerResult && index === question.correctOption;
    const wrong = practice.answerResult && selected && !correct;
    return `<button class="answer-option ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}" data-action="select-answer" data-option="${index}" ${practice.answerResult ? 'disabled' : ''}><kbd>${index + 1}</kbd><span>${escapeHtml(option)}</span></button>`;
  }).join('')}</div>${practice.answerResult ? '' : `<button class="button button-dark" data-action="check-answer" ${practice.selected === null ? 'disabled' : ''}>Check answer</button>`}`;
}

function renderInlineBlanks(practice, question) {
  let blankIndex = 0;
  const chunks = question.code.split('____');
  const markup = chunks.map((chunk, index) => {
    const part = `<span>${highlightCode(chunk)}</span>`;
    if (index === chunks.length - 1) return part;
    const inputIndex = blankIndex++;
    return `${part}<input class="inline-blank" data-blank-index="${inputIndex}" aria-label="Blank ${inputIndex + 1}" value="${escapeHtml(practice.blankValues[inputIndex] || '')}" ${practice.answerResult ? 'disabled' : ''}>`;
  }).join('');
  return `<pre class="code-block inline-code"><code>${markup}</code></pre>`;
}

function renderTestResults(results) {
  return `<div class="test-results"><h3>Test results</h3>${results.map((result, index) =>
    `<article class="test-result ${result.passed ? 'is-pass' : 'is-fail'}"><strong>Test ${index + 1} · ${result.passed ? 'PASS' : 'FAIL'}</strong><p>Args: <code>${escapeHtml(formatValue(result.args))}</code></p><p>Expected: <code>${escapeHtml(formatValue(result.expected))}</code></p><p>Actual: <code>${escapeHtml(result.actualDisplay ?? formatValue(result.actual))}</code></p>${result.error ? `<p class="test-error">${escapeHtml(result.error)}</p>` : ''}</article>`
  ).join('')}</div>`;
}

function renderResults(practice) {
  const score = practice.answers.filter(answer => answer.correct).length;
  return `<section class="practice-results"><p class="eyebrow">PRACTICE / FINISHED</p><h1>${score} / ${practice.answers.length} correct</h1>
    <div class="result-actions">${practice.answers.some(answer => !answer.correct) ? '<button class="button button-dark" data-action="retry-missed">Retry missed</button>' : ''}<button class="button button-quiet" data-action="new-session">New session</button></div>
    <div class="review-list">${practice.answers.map((answer, index) => `<article class="review-card ${answer.correct ? 'review-pass' : 'review-fail'}"><div class="question-tags">${topicTag(answer.question.topic)}<span class="small-tag">${escapeHtml(answer.question.level)}</span><span class="small-tag">${escapeHtml(answer.question.sourceSection)}</span></div><h2>${index + 1}. ${escapeHtml(answer.question.question || answer.question.prompt)}</h2><p><strong>Your answer:</strong> <code>${escapeHtml(formatValue(answer.userAnswer))}</code></p><p><strong>Correct answer:</strong> <code>${escapeHtml(formatValue(answer.correctAnswer))}</code></p><p>${escapeHtml(answer.question.explanation || '')}</p>${answer.question.explanationAr ? `<p class="definition-ar" dir="rtl">${escapeHtml(answer.question.explanationAr)}</p>` : ''}</article>`).join('')}</div>
  </section>`;
}

function startSession(practice, questions) {
  const pool = questions.filter(question => practice.selectedTypes.has(question.type));
  if (!pool.length) return;
  const count = practice.count === 'all' ? pool.length : Math.min(Number(practice.count), pool.length);
  practice.session = makeSession(pool, count, practice.previousOptionOrders);
  practice.previousOptionOrders = new Map(practice.session
    .filter(question => question.options)
    .map(question => [question.id, question.options.join('\u0000')]));
  practice.phase = 'question';
  practice.index = 0;
  practice.answerResult = null;
  practice.answers = [];
  practice.blankValues = [];
  practice.selected = null;
  practice.revealed = false;
  practice.covered = new Set();
  practice.answer = undefined;
  practice.runResults = null;
  practice.solutionShown = false;
}

function makeSession(pool, count, previousOrders = new Map()) {
  return shuffle(pool).slice(0, count).map(input => {
    const source = input.sourceQuestion || input;
    const question = { ...source, sourceQuestion: source };
    if (source.options && Number.isInteger(source.correctOption)) {
      let options = shuffle(source.options.map((text, index) => ({ text, correct: index === source.correctOption })));
      const order = options.map(option => option.text).join('\u0000');
      if (order === previousOrders.get(source.id)) options = [...options.slice(1), options[0]];
      question.options = options.map(option => option.text);
      question.correctOption = options.findIndex(option => option.correct);
    }
    return question;
  });
}

function checkAnswer(practice) {
  if (practice.answerResult) return;
  const question = currentQuestion(practice);
  if (question.type === 'whatDoes' || (question.type === 'predictOutput' && question.mode === 'choose')) {
    if (practice.selected === null) return;
    practice.answerResult = { correct: practice.selected === question.correctOption, answer: question.options[practice.selected], correctAnswer: question.options[question.correctOption] };
  } else if (question.type === 'predictOutput') {
    practice.answerResult = { correct: normalizeOutput(practice.answer) === normalizeOutput(question.expectedOutput), answer: practice.answer, correctAnswer: question.expectedOutput };
  } else if (question.type === 'completeCode') {
    const values = question.blanks.map((answers, index) => String(practice.blankValues[index] ?? '').trim());
    const correct = values.every((value, index) => question.blanks[index].some(answer =>
      question.caseSensitive ? value === answer : value.toLocaleLowerCase() === answer.toLocaleLowerCase()
    ));
    practice.answerResult = { correct, answer: values, correctAnswer: question.blanks.map(answers => answers[0]) };
  }
}

async function runTests(practice, app, rerender) {
  if (practice.workerRunning) return;
  const question = currentQuestion(practice);
  const code = app.querySelector('[data-code-editor]')?.value ?? question.starter;
  practice.answer = code;
  practice.workerRunning = true;
  practice.runResults = null;
  rerender();
  try {
    const response = await runWriteCode(code, question.functionName, question.tests);
    practice.runResults = (response.results || []).map((result, index) => ({ ...result, args: question.tests[index].args }));
    if (response.error) {
      practice.runResults = question.tests.map(test => ({ passed: false, expected: test.expect, actual: null, error: response.error, args: test.args }));
    }
    practice.answerResult = {
      correct: !response.error && !response.timedOut && practice.runResults.length === question.tests.length && practice.runResults.every(result => result.passed),
      answer: code,
      correctAnswer: question.solution
    };
  } catch (error) {
    practice.runResults = question.tests.map(test => ({ passed: false, expected: test.expect, actual: null, error: error.message, args: test.args }));
    practice.answerResult = { correct: false, answer: code, correctAnswer: question.solution };
  }
  practice.workerRunning = false;
  if (!practice.answerResult.correct) practice.solutionShown = false;
  rerender();
}

function currentUserAnswer(app, practice) {
  return app.querySelector('[data-code-editor]')?.value ?? practice.answer;
}

function finishQuestion(practice) {
  const question = currentQuestion(practice);
  if (!practice.answerResult) return;
  practice.answers.push({
    question,
    correct: practice.answerResult.correct,
    userAnswer: practice.answerResult.answer ?? practice.answer ?? '',
    correctAnswer: practice.answerResult.correctAnswer ??
      (question.type === 'interview' ? question.modelAnswer : question.expectedOutput ?? question.solution ?? question.options?.[question.correctOption] ?? question.blanks?.[0]?.[0])
  });
  if (practice.index + 1 >= practice.session.length) {
    practice.phase = 'results';
    return;
  }
  practice.index += 1;
  practice.answerResult = null;
  practice.blankValues = [];
  practice.selected = null;
  practice.revealed = false;
  practice.covered = new Set();
  practice.answer = undefined;
  practice.runResults = null;
  practice.solutionShown = false;
}

function retryMissed(practice) {
  const missed = practice.answers.filter(answer => !answer.correct).map(answer => answer.question);
  practice.session = makeSession(missed, missed.length, practice.previousOptionOrders);
  practice.phase = practice.session.length ? 'question' : 'setup';
  practice.index = 0;
  practice.answers = [];
  practice.answerResult = null;
  practice.blankValues = [];
  practice.selected = null;
  practice.revealed = false;
  practice.covered = new Set();
  practice.answer = undefined;
  practice.runResults = null;
  practice.solutionShown = false;
}

function normalizeOutput(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
}

function renderCode(code) {
  return `<pre class="code-block"><code>${highlightCode(code)}</code></pre>`;
}

function currentQuestion(practice) {
  return practice.session[practice.index];
}

function typeLabel(type) {
  return ({ whatDoes: 'What does this do?', predictOutput: 'Predict output', completeCode: 'Complete code', writeCode: 'Write code', interview: 'Interview' })[type];
}

function topicTag(topic) {
  return `<span class="topic-tag" style="--topic-color:${TOPIC_COLORS.get(topic) || '#ffd166'}">${escapeHtml(topic)}</span>`;
}

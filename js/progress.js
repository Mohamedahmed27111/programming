export const STORAGE_KEY = 'studyProgress:v1';
const VERSION = 1;
const MAX_SESSIONS = 50;

export function emptyProgress() {
  return {
    version: VERSION,
    terms: Object.create(null),
    questions: Object.create(null),
    streak: { days: 0, lastStudyDate: null },
    sessions: []
  };
}

export function renderProgress(state, subject, terms, questions) {
  const progress = state.progress;
  const visibleTopicNames = state.filters.topicNames;
  const topics = subject.topics
    .filter(topic => visibleTopicNames.size === 0 || visibleTopicNames.has(topic.meta.topic))
    .map(topic => ({
      ...topic,
      questions: topic.questions.filter(question => questions.some(item => item.id === question.id)),
      terms: topic.terms.filter(term => terms.some(item => item.id === term.id))
    }));
  const mastery = topicMastery(progress, topics);
  const weak = getWeakQuestions(progress, questions);
  const known = terms.filter(term => progress.terms[term.id] === 'known').length;
  const learning = terms.filter(term => progress.terms[term.id] === 'learning').length;
  const stats = questions.map(question => progress.questions[question.id]).filter(stat => stat?.attempts > 0);
  const attempts = stats.reduce((sum, stat) => sum + stat.attempts, 0);
  const correct = stats.reduce((sum, stat) => sum + stat.correct, 0);
  const recent = [...progress.sessions].reverse().slice(0, 6);

  return `<section class="progress-screen">
    <div class="screen-heading"><div><p class="eyebrow">PROGRESS / YOUR JOURNEY</p><h1>Look how far you came.</h1></div><p>Saved on this device. Your progress follows the active scope.</p></div>
    ${state.progressMessage ? `<p class="storage-message" role="status">${escapeHtml(state.progressMessage)}</p>` : ''}
    <div class="progress-stats">
      <article class="progress-stat"><span class="eyebrow">STREAK</span><strong>${progress.streak.days}</strong><span>day${progress.streak.days === 1 ? '' : 's'}</span></article>
      <article class="progress-stat"><span class="eyebrow">TERMS</span><strong>${known}</strong><span>known · ${learning} learning</span></article>
      <article class="progress-stat"><span class="eyebrow">QUESTION ACCURACY</span><strong>${attempts ? Math.round(correct / attempts * 100) : 0}%</strong><span>${attempts} attempts in scope</span></article>
      <article class="progress-stat"><span class="eyebrow">SESSIONS</span><strong>${progress.sessions.length}</strong><span>recent sessions saved</span></article>
    </div>
    <div class="progress-grid">
      <section class="progress-panel mastery-panel"><div class="panel-heading"><div><p class="eyebrow">TOPIC MASTERY</p><h2>Steady progress</h2></div><span>${mastery.length} topics</span></div>
        <div class="mastery-list">${mastery.map(item => `<div class="mastery-row"><div class="mastery-label"><strong>${escapeHtml(item.topic)}</strong><span>${item.attempts ? `${item.attempts} attempts / marks` : 'Not started'}</span></div><div class="mastery-track"><span style="width:${item.value}%;--topic-color:${TOPIC_COLORS.get(item.topic) || '#ffd166'}"></span></div><b>${item.value}%</b></div>`).join('')}</div>
      </section>
      <section class="progress-panel weak-panel"><div class="panel-heading"><div><p class="eyebrow">WEAK SPOTS</p><h2>Practice what’s tricky</h2></div><span>${weak.length}</span></div>
        ${weak.length ? `<ul class="weak-list">${weak.slice(0, 8).map(question => `<li><div>${topicTag(question.topic)}<strong>${escapeHtml(question.question || question.prompt)}</strong><span>${progress.questions[question.id].correct} / ${progress.questions[question.id].attempts} correct</span></div></li>`).join('')}</ul><button class="button button-dark" data-action="practice-weak">Practice my weak questions (${weak.length}) →</button>` : `<p class="empty-progress">No missed questions in this scope yet. Finish a practice session to discover weak spots.</p>`}
      </section>
    </div>
    <section class="progress-panel history-panel"><div class="panel-heading"><div><p class="eyebrow">SESSION HISTORY</p><h2>Recent rounds</h2></div></div>
      ${recent.length ? `<div class="history-list">${recent.map(session => `<article class="history-item"><span class="history-kind">${escapeHtml(session.kind)}</span><strong>${session.correct} / ${session.total}</strong><span>${new Date(session.at).toLocaleString()}</span></article>`).join('')}</div>` : '<p class="empty-progress">Your completed sessions will show up here.</p>'}
    </section>
    <section class="progress-panel data-panel"><div><p class="eyebrow">YOUR DATA</p><h2>Take it with you.</h2><p>Export a backup, import a previous backup, or reset this device.</p></div><div class="data-actions"><button class="button button-quiet" data-action="export">Export progress</button><button class="button button-quiet" data-action="choose-import">Import progress</button><input class="sr-only" type="file" accept="application/json,.json" data-import-file aria-label="Choose progress JSON file"><button class="button button-danger" data-action="reset">Reset progress</button></div></section>
  </section>`;
}

export function bindProgress(app, state, questions, rerender, startWeak) {
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.action === 'export') exportProgress(state.progress);
    if (button.dataset.action === 'choose-import') app.querySelector('[data-import-file]').click();
    if (button.dataset.action === 'reset') {
      if (confirm('Reset all saved study progress on this device? This cannot be undone.')) {
        state.progress = emptyProgress();
        state.progressMessage = saveProgress(state.progress) || 'Progress reset.';
        rerender();
      }
    }
    if (button.dataset.action === 'practice-weak') startWeak();
  }));
  app.querySelector('[data-import-file]').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = sanitizeProgress(JSON.parse(await file.text()));
      state.progress = imported;
      state.progressMessage = saveProgress(imported) || 'Progress imported successfully.';
    } catch (error) {
      state.progressMessage = `Import failed: ${error.message}`;
    }
    event.target.value = '';
    rerender();
  });
}

function exportProgress(progress) {
  const blob = new Blob([`${JSON.stringify(progress, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `study-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function topicTag(topic) {
  return `<span class="topic-tag" style="--topic-color:${TOPIC_COLORS.get(topic) || '#ffd166'}">${escapeHtml(topic)}</span>`;
}

export function loadProgress() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { progress: emptyProgress(), warning: '' };
    return { progress: sanitizeProgress(JSON.parse(stored)), warning: '' };
  } catch (error) {
    return {
      progress: emptyProgress(),
      warning: `Progress could not be loaded: ${error.message}`
    };
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return '';
  } catch (error) {
    return `Progress could not be saved: ${error.message}`;
  }
}

export function sanitizeProgress(value) {
  if (!isRecord(value) || value.version !== VERSION) {
    throw new Error('Unsupported or invalid progress version.');
  }
  const progress = emptyProgress();
  if (isRecord(value.terms)) {
    for (const [id, status] of Object.entries(value.terms)) {
      if (typeof id === 'string' && (status === 'known' || status === 'learning')) progress.terms[id] = status;
    }
  }
  if (isRecord(value.questions)) {
    for (const [id, stat] of Object.entries(value.questions)) {
      if (!isRecord(stat)) continue;
      const attempts = finiteNonNegative(stat.attempts);
      const correct = Math.min(attempts, finiteNonNegative(stat.correct));
      progress.questions[id] = {
        attempts, correct,
        lastCorrect: typeof stat.lastCorrect === 'boolean' ? stat.lastCorrect : null,
        lastAt: typeof stat.lastAt === 'string' ? stat.lastAt : null
      };
    }
  }
  if (isRecord(value.streak)) {
    progress.streak = {
      days: finiteNonNegative(value.streak.days),
      lastStudyDate: typeof value.streak.lastStudyDate === 'string' ? value.streak.lastStudyDate : null
    };
  }
  if (Array.isArray(value.sessions)) {
    progress.sessions = value.sessions
      .filter(session => isRecord(session) && typeof session.at === 'string')
      .slice(-MAX_SESSIONS)
      .map(session => ({
        at: session.at,
        kind: typeof session.kind === 'string' ? session.kind : 'practice',
        total: finiteNonNegative(session.total),
        correct: finiteNonNegative(session.correct),
        ids: Array.isArray(session.ids) ? session.ids.filter(id => typeof id === 'string') : []
      }));
  }
  return progress;
}

export function recordPracticeSession(progress, answers) {
  const now = new Date();
  const at = now.toISOString();
  for (const answer of answers) {
    const previous = progress.questions[answer.question.id] || { attempts: 0, correct: 0 };
    progress.questions[answer.question.id] = {
      attempts: previous.attempts + 1,
      correct: previous.correct + Number(answer.correct),
      lastCorrect: Boolean(answer.correct),
      lastAt: at
    };
  }
  appendSession(progress, {
    at, kind: 'practice', total: answers.length,
    correct: answers.filter(answer => answer.correct).length,
    ids: answers.map(answer => answer.question.id)
  }, now);
}

export function recordTermSession(progress, mode, results) {
  const now = new Date();
  appendSession(progress, {
    at: now.toISOString(), kind: mode,
    total: results.length,
    correct: results.filter(result => result.correct).length,
    ids: results.map(result => result.term?.id).filter(Boolean)
  }, now);
}

export function getWeakQuestions(progress, questions) {
  return questions
    .filter(question => (progress.questions[question.id]?.attempts || 0) > 0 &&
      progress.questions[question.id].correct < progress.questions[question.id].attempts)
    .sort((left, right) => {
      const leftStats = progress.questions[left.id];
      const rightStats = progress.questions[right.id];
      const leftRate = leftStats.correct / leftStats.attempts;
      const rightRate = rightStats.correct / rightStats.attempts;
      return leftRate - rightRate || leftStats.attempts - rightStats.attempts;
    });
}

export function topicMastery(progress, topics) {
  return topics.map(topic => {
    const questionStats = topic.questions
      .map(question => progress.questions[question.id])
      .filter(stat => stat && stat.attempts > 0);
    const attempts = questionStats.reduce((sum, stat) => sum + stat.attempts, 0);
    const correct = questionStats.reduce((sum, stat) => sum + stat.correct, 0);
    if (attempts > 0) return { topic: topic.meta.topic, value: Math.round(correct / attempts * 100), attempts };
    const terms = topic.terms;
    const known = terms.filter(term => progress.terms[term.id] === 'known').length;
    const learning = terms.filter(term => progress.terms[term.id] === 'learning').length;
    const marked = known + learning;
    return { topic: topic.meta.topic, value: marked ? Math.round(known / marked * 100) : 0, attempts: marked };
  });
}

export function updateStreak(progress, date = new Date()) {
  const today = toLocalDate(date);
  const last = progress.streak.lastStudyDate;
  if (last === today) return;
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  progress.streak.days = last === toLocalDate(yesterday) ? progress.streak.days + 1 : 1;
  progress.streak.lastStudyDate = today;
}

function appendSession(progress, session, date) {
  updateStreak(progress, date);
  progress.sessions.push(session);
  progress.sessions = progress.sessions.slice(-MAX_SESSIONS);
}

function toLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
import { TOPIC_COLORS } from './data.js';
import { escapeHtml } from './ui.js';

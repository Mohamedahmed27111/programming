export const TOPIC_COLORS = new Map();

const topicPalette = [
  '#ff927d', '#ffd166', '#83e0cf', '#c8a9f4', '#91baff',
  '#ffb86b', '#a8dd8b', '#f4a8cc', '#83d7ef', '#e9c46a',
  '#b9c5ff', '#f3a683', '#9be7c4', '#e5aaff', '#a7d8f0',
  '#ffc785', '#b8e986', '#f0a6a6', '#9fe3dd', '#d2b5ff',
  '#f0d27a'
];

export async function loadDataset() {
  const indexResponse = await fetch('./data/index.json');
  if (!indexResponse.ok) throw new Error(`Could not load data/index.json (${indexResponse.status})`);
  const index = await indexResponse.json();
  if (!Array.isArray(index.subjects) || index.subjects.length === 0) {
    throw new Error('The data index does not contain any subjects.');
  }

  const loadedSubjects = await Promise.all(index.subjects.map(async subject => {
    if (!Array.isArray(subject.topics)) throw new Error(`Subject "${subject.id}" has no topic list.`);
    const topics = await Promise.all(subject.topics.map(async topic => {
      const response = await fetch(`./${topic.file}`);
      if (!response.ok) throw new Error(`Could not load ${topic.file} (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.terms) || !Array.isArray(data.questions)) {
        throw new Error(`${topic.file} is missing terms or questions.`);
      }
      if (data.meta?.subject !== subject.id) {
        throw new Error(`${topic.file} does not match subject "${subject.id}".`);
      }
      return { ...topic, ...data, id: topic.file, subjectId: subject.id };
    }));
    return { ...subject, topics };
  }));

  TOPIC_COLORS.clear();
  let colorIndex = 0;
  for (const subject of loadedSubjects) {
    for (const topic of subject.topics) {
      if (!TOPIC_COLORS.has(topic.meta.topic)) {
        TOPIC_COLORS.set(topic.meta.topic, topicPalette[colorIndex % topicPalette.length]);
        colorIndex += 1;
      }
    }
  }

  return { index, subjects: loadedSubjects };
}

export function getFilteredItems(state, type) {
  const subject = state.dataset.subjects.find(item => item.id === state.filters.subjectId);
  if (!subject) return [];
  const needle = normalizeText(state.filters.search);
  return subject.topics
    .filter(topic => state.filters.topicNames.size === 0 || state.filters.topicNames.has(topic.meta.topic))
    .flatMap(topic => topic[type]
      .filter(item => state.filters.levels.size === 0 || state.filters.levels.has(item.level))
      .filter(item => !needle || normalizeText(searchableText(item)).includes(needle))
      .map(item => ({ ...item, topic: topic.meta.topic, topicOrder: topic.meta.order })));
}

export function normalizeText(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function searchableText(item) {
  return [
    item.term, item.display, item.definitionEn, item.definitionAr,
    item.question, item.prompt, item.code, item.sourceSection,
    item.solution, item.modelAnswer
  ].filter(Boolean).join(' ');
}

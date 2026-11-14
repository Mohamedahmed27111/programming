import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT, 'data', 'index.json');
const LEVELS = ['beginner', 'intermediate', 'advanced', 'interview'];
const TYPES = ['whatDoes', 'predictOutput', 'completeCode', 'writeCode', 'interview'];

let existingIndex = { subjects: [] };
try {
  existingIndex = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const subjectDirs = [];
for (const entry of await fs.readdir(path.join(ROOT, 'data'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const entries = await fs.readdir(path.join(ROOT, 'data', entry.name));
  if (entries.some(file => file.endsWith('.json') && !file.startsWith('_'))) {
    subjectDirs.push(entry.name);
  }
}
const previousOrder = new Map((existingIndex.subjects ?? []).map((subject, index) => [subject.id, index]));
const previousSubjects = new Map((existingIndex.subjects ?? []).map(subject => [subject.id, subject]));
subjectDirs.sort((left, right) => {
  const leftOrder = previousOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = previousOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.localeCompare(right);
});
const subjects = [];

for (const subjectId of subjectDirs) {
  const existingSubject = previousSubjects.get(subjectId);
  if (existingSubject) {
    subjects.push(existingSubject);
    continue;
  }

  const subjectDir = path.join(ROOT, 'data', subjectId);
  const files = (await fs.readdir(subjectDir))
    .filter(file => file.endsWith('.json') && !file.startsWith('_'))
    .sort();
  const topics = [];

  for (const file of files) {
    const topic = JSON.parse(await fs.readFile(path.join(subjectDir, file), 'utf8'));
    const byLevel = Object.fromEntries(LEVELS.map(level => [level, topic.questions.filter(question => question.level === level).length]));
    const byType = Object.fromEntries(TYPES.map(type => [type, topic.questions.filter(question => question.type === type).length]));
    topics.push({
      order: topic.meta.order,
      topic: topic.meta.topic,
      file: `data/${subjectId}/${file}`,
      counts: { terms: topic.terms.length, questions: topic.questions.length, byLevel, byType }
    });
  }

  topics.sort((left, right) => left.order - right.order);
  subjects.push({ id: subjectId, topics });
}

const index = { subjects };
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} with ${subjects.length} subject(s).`);

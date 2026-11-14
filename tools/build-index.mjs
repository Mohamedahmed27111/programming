import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPICS_DIR = path.join(ROOT, 'data', 'javascript');
const OUTPUT_PATH = path.join(ROOT, 'data', 'index.json');
const LEVELS = ['beginner', 'intermediate', 'advanced', 'interview'];
const TYPES = ['whatDoes', 'predictOutput', 'completeCode', 'writeCode', 'interview'];

const files = (await fs.readdir(TOPICS_DIR))
  .filter(file => file.endsWith('.json') && !file.startsWith('_'))
  .sort();
const topics = [];

for (const file of files) {
  const topic = JSON.parse(await fs.readFile(path.join(TOPICS_DIR, file), 'utf8'));
  const byLevel = Object.fromEntries(LEVELS.map(level => [level, topic.questions.filter(question => question.level === level).length]));
  const byType = Object.fromEntries(TYPES.map(type => [type, topic.questions.filter(question => question.type === type).length]));
  topics.push({
    order: topic.meta.order,
    topic: topic.meta.topic,
    file: `data/javascript/${file}`,
    counts: { terms: topic.terms.length, questions: topic.questions.length, byLevel, byType }
  });
}

topics.sort((left, right) => left.order - right.order);
const index = { subjects: [{ id: 'javascript', topics }] };
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} with ${topics.length} topic(s).`);

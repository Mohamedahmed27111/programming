import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data', 'javascript');

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function findTopicFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findTopicFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(fullPath);
  }
  return files.sort();
}

const files = await findTopicFiles(DATA_DIR);
let updatedQuestions = 0;
const globalPositions = [0, 0, 0, 0];

for (const file of files) {
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  let changed = false;
  const questions = (data.questions ?? []).filter(question =>
    (question.type === 'whatDoes' ||
      (question.type === 'predictOutput' && question.mode === 'choose')) &&
    Array.isArray(question.options) && Number.isInteger(question.correctOption) &&
    question.correctOption >= 0 && question.correctOption < question.options.length
  );
  const filePositions = [0, 0, 0, 0];
  for (const question of questions) {
    const correctAnswer = question.options[question.correctOption];
    const options = [...question.options].sort();
    const random = createRandom(hashSeed(question.id));
    for (let index = options.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
    }
    const availablePositions = [0, 1, 2, 3].filter(position =>
      path.basename(file).startsWith('_') ||
      filePositions[position] < Math.floor(questions.length * 0.4)
    );
    const leastUsedGlobal = Math.min(...availablePositions.map(position => globalPositions[position]));
    const leastUsedFile = Math.min(...availablePositions
      .filter(position => globalPositions[position] === leastUsedGlobal)
      .map(position => filePositions[position]));
    const candidates = availablePositions.filter(position =>
      globalPositions[position] === leastUsedGlobal && filePositions[position] === leastUsedFile
    );
    const targetPosition = candidates[Math.floor(random() * candidates.length)];
    const currentPosition = options.indexOf(correctAnswer);
    [options[currentPosition], options[targetPosition]] = [options[targetPosition], options[currentPosition]];
    question.options = options;
    question.correctOption = targetPosition;
    filePositions[targetPosition] += 1;
    globalPositions[targetPosition] += 1;
    changed = true;
    updatedQuestions += 1;
  }
  if (changed) await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

console.log(`Shuffled answer options for ${updatedQuestions} question(s) across ${files.length} file(s).`);
console.log(`Correct-option positions: ${globalPositions.map((count, index) => `${index}=${count}`).join(', ')}`);

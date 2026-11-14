import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import util from 'node:util';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const SCHEMA_PATH = path.join(ROOT, 'tools', 'schema.json');
const LEVELS = ['beginner', 'intermediate', 'advanced', 'interview'];
const TYPES = ['whatDoes', 'predictOutput', 'completeCode', 'writeCode', 'interview'];
const errors = [];
const warnings = [];
const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));

function report(file, message) {
  errors.push(`${path.relative(ROOT, file)}: ${message}`);
}

function warn(file, message) {
  warnings.push(`${path.relative(ROOT, file)}: ${message}`);
}

function validateSchema(value, definition, location, file) {
  if (definition.type) {
    const matches = definition.type === 'array'
      ? Array.isArray(value)
      : definition.type === 'integer'
        ? Number.isInteger(value)
        : definition.type === 'object'
          ? value !== null && typeof value === 'object' && !Array.isArray(value)
          : typeof value === definition.type;
    if (!matches) {
      report(file, `${location} must be ${definition.type}`);
      return;
    }
  }
  if (definition.enum && !definition.enum.includes(value)) {
    report(file, `${location} must be one of ${definition.enum.join(', ')}`);
  }
  if (definition.minItems !== undefined && value.length < definition.minItems) {
    report(file, `${location} must contain at least ${definition.minItems} items`);
  }
  if (definition.required) {
    for (const key of definition.required) {
      if (!(key in value)) report(file, `${location}.${key} is required`);
    }
  }
  if (definition.properties && value && typeof value === 'object') {
    for (const [key, childSchema] of Object.entries(definition.properties)) {
      if (key in value) validateSchema(value[key], childSchema, `${location}.${key}`, file);
    }
  }
  if (definition.items && Array.isArray(value)) {
    value.forEach((item, index) => validateSchema(item, definition.items, `${location}[${index}]`, file));
  }
}

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isJsonValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function awaitThenable(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function') ||
      typeof value.then !== 'function') return value;
  let timeout;
  try {
    return await Promise.race([
      value,
      new Promise((_, reject) => {
        timeout = globalThis.setTimeout(() => reject(new Error('execution exceeded 2s timeout')), 2000);
      })
    ]);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function executeOutput(code, file, questionId) {
  const output = [];
  const timers = new Set();
  let timeout;
  const sandbox = {
    console: { log: (...args) => output.push(util.format(...args)) },
    setTimeout(callback, delay = 0, ...args) {
      if (typeof callback !== 'function') throw new TypeError('setTimeout callback must be a function');
      let timer;
      timer = globalThis.setTimeout(() => {
        timers.delete(timer);
        callback(...args);
      }, delay);
      timers.add(timer);
      return timer;
    },
    clearTimeout(timer) {
      timers.delete(timer);
      globalThis.clearTimeout(timer);
    }
  };
  try {
    vm.runInNewContext(code, sandbox, { timeout: 2000, filename: `${path.basename(file)}:${questionId}` });
    const drain = (async () => {
      while (timers.size > 0) {
        await new Promise(resolve => globalThis.setTimeout(resolve, 1));
      }
      await new Promise(resolve => globalThis.setImmediate(resolve));
      await Promise.resolve();
      await Promise.resolve();
    })();
    await Promise.race([
      drain,
      new Promise((_, reject) => {
        timeout = globalThis.setTimeout(() => reject(new Error('execution exceeded 2s timeout')), 2000);
      })
    ]);
    globalThis.clearTimeout(timeout);
    return output.join('\n');
  } catch (error) {
    for (const timer of timers) globalThis.clearTimeout(timer);
    timers.clear();
    globalThis.clearTimeout(timeout);
    report(file, `${questionId} execution failed: ${error.message}`);
    return null;
  }
}

function renderHtmlText(markup) {
  const blockTags = /<\/(?:address|article|aside|blockquote|caption|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\s*>/gi;
  const entities = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(?:head|script|style|template|title|noscript)\b[^>]*>[\s\S]*?<\/(?:head|script|style|template|title|noscript)\s*>/gi, '')
    .replace(/<input\b([^>]*)>/gi, (_, attributes) => {
      const value = attributes.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      return value ? value[1] ?? value[2] ?? value[3] : '';
    })
    .replace(/<select\b[^>]*>([\s\S]*?)<\/select\s*>/gi, (_, content) => {
      const options = [...content.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option\s*>/gi)];
      const selected = options.find(([, attributes]) => /\bselected\b/i.test(attributes)) ?? options[0];
      return selected ? selected[2].replace(/<[^>]*>/g, '') : '';
    })
    .replace(/<br\b[^>]*\/?>/gi, '\n')
    .replace(blockTags, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, value) => {
      if (value[0] === '#') {
        const codePoint = value[1].toLowerCase() === 'x'
          ? Number.parseInt(value.slice(2), 16)
          : Number.parseInt(value.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      }
      return entities[value.toLowerCase()] ?? entity;
    })
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function validateQuestion(question, file, updateExpected, subject) {
  const label = question.id ?? '(question without id)';
  const allowedTypes = ['css', 'typescript'].includes(subject) ? TYPES.filter(type => type !== 'writeCode') : TYPES;
  if (!allowedTypes.includes(question.type)) report(file, `${label} has unsupported type "${question.type}" for subject "${subject}"`);
  if (!LEVELS.includes(question.level)) report(file, `${label} has unsupported level "${question.level}"`);

  if (question.type === 'whatDoes') {
    if (typeof question.question !== 'string' || typeof question.code !== 'string') report(file, `${label} requires question and code`);
    if (!Array.isArray(question.options) || question.options.length !== 4) {
      report(file, `${label} must have exactly four options`);
    }
    if (!Number.isInteger(question.correctOption) || question.correctOption < 0 || question.correctOption >= (question.options?.length ?? 0)) {
      report(file, `${label} correctOption is missing or out of range`);
    }
    if (Array.isArray(question.options) && new Set(question.options).size !== question.options.length) {
      report(file, `${label} options must be unique`);
    }
  }

  if (question.type === 'predictOutput') {
    if (!['choose', 'type'].includes(question.mode)) report(file, `${label} mode must be choose or type`);
    if (question.mode === 'choose') {
      if (!Array.isArray(question.options) || question.options.length !== 4) report(file, `${label} choose mode must have exactly four options`);
      if (!Number.isInteger(question.correctOption) || question.correctOption < 0 || question.correctOption >= (question.options?.length ?? 0)) {
        report(file, `${label} correctOption is missing or out of range`);
      }
      if (Array.isArray(question.options) && new Set(question.options).size !== question.options.length) {
        report(file, `${label} options must be unique`);
      }
    }
    if (typeof question.code !== 'string') {
      report(file, `${label} is missing code`);
    } else {
      const actual = subject === 'html'
        ? renderHtmlText(question.code)
        : ['css', 'typescript'].includes(subject)
          ? null
          : await executeOutput(question.code, file, label);
      if (['css', 'typescript'].includes(subject) && typeof question.expectedOutput !== 'string') {
        report(file, `${label} is missing expectedOutput`);
      }
      if (actual !== null) {
        if (updateExpected) question.expectedOutput = actual;
        else {
          if (typeof question.expectedOutput !== 'string') report(file, `${label} is missing expectedOutput (use --write-expected to generate it)`);
          else if (question.expectedOutput !== actual) report(file, `${label} expectedOutput mismatch: expected ${JSON.stringify(question.expectedOutput)}, actual ${JSON.stringify(actual)}`);
          if (question.mode === 'choose' && question.options?.[question.correctOption] !== actual) {
            report(file, `${label} correct option must equal actual output ${JSON.stringify(actual)}`);
          }
        }
      }
      if (subject === 'css' && question.mode === 'choose' &&
          typeof question.expectedOutput === 'string' &&
          question.options?.[question.correctOption] !== question.expectedOutput) {
        report(file, `${label} correct option must equal expectedOutput ${JSON.stringify(question.expectedOutput)}`);
      }
    }
  }

  if (question.type === 'completeCode') {
    if (typeof question.code !== 'string' || !Array.isArray(question.blanks) || question.blanks.some(blank => !Array.isArray(blank) || blank.length === 0)) {
      report(file, `${label} requires code and non-empty blanks arrays`);
    } else {
      const blankCount = (question.code.match(/____/g) ?? []).length;
      if (blankCount !== question.blanks.length) report(file, `${label} has ${blankCount} blanks in code but ${question.blanks.length} answer groups`);
      let code = question.code;
      for (const answers of question.blanks) {
        code = code.replace('____', String(answers[0]));
      }
      const actual = subject === 'html'
        ? renderHtmlText(code)
        : ['css', 'typescript'].includes(subject)
          ? null
          : await executeOutput(code, file, label);
      if (['css', 'typescript'].includes(subject) && typeof question.expectedOutput !== 'string') {
        report(file, `${label} is missing expectedOutput`);
      }
      if (actual !== null) {
        if (updateExpected) question.expectedOutput = actual;
        else if (typeof question.expectedOutput !== 'string') report(file, `${label} is missing expectedOutput (use --write-expected to generate it)`);
        else if (question.expectedOutput !== actual) report(file, `${label} expectedOutput mismatch: expected ${JSON.stringify(question.expectedOutput)}, actual ${JSON.stringify(actual)}`);
      }
    }
  }

  if (question.type === 'writeCode') {
    if (typeof question.solution !== 'string' || typeof question.functionName !== 'string' || !Array.isArray(question.tests)) {
      report(file, `${label} requires functionName, solution, and tests`);
      return;
    }
    if (question.tests.length === 0) report(file, `${label} must include at least one test`);
    let fn;
    try {
      const context = vm.createContext({});
      vm.runInContext(question.solution, context, { timeout: 2000, filename: `${path.basename(file)}:${label}` });
      fn = context[question.functionName];
      if (typeof fn !== 'function') throw new Error(`${question.functionName} is not defined by solution`);
    } catch (error) {
      report(file, `${label} solution failed: ${error.message}`);
      return;
    }
    for (let index = 0; index < question.tests.length; index += 1) {
      const test = question.tests[index];
      const hasInvoke = test && Object.hasOwn(test, 'invoke');
      if (!test || !Array.isArray(test.args) || !Object.hasOwn(test, 'expect') ||
          !isJsonValue(test.args) || !isJsonValue(test.expect) ||
          (hasInvoke && (!Array.isArray(test.invoke) || !isJsonValue(test.invoke)))) {
        report(file, `${label} test ${index + 1} must have JSON-serialisable args, expect, and optional invoke`);
        continue;
      }
      try {
        let actual = await awaitThenable(fn(...JSON.parse(JSON.stringify(test.args))));
        if (hasInvoke) {
          if (typeof actual !== 'function') throw new TypeError('invoke tests require the solution to return a function');
          const invokeResults = [];
          for (const args of test.invoke) {
            invokeResults.push(await awaitThenable(actual(...JSON.parse(JSON.stringify(args)))));
          }
          actual = invokeResults;
        }
        let normalizedActual;
        if (actual === undefined) {
          if (test.expect !== null) {
            report(file, `${label} test ${index + 1} mismatch: expected ${JSON.stringify(test.expect)}, actual undefined`);
            continue;
          }
          normalizedActual = null;
        } else {
          const serializedActual = JSON.stringify(actual);
          if (serializedActual === undefined) throw new TypeError('actual result is not JSON-serialisable');
          normalizedActual = JSON.parse(serializedActual);
        }
        if (!isDeepStrictEqual(normalizedActual, JSON.parse(canonical(test.expect)))) {
          report(file, `${label} test ${index + 1} mismatch: expected ${JSON.stringify(test.expect)}, actual ${JSON.stringify(actual)}`);
        }
      } catch (error) {
        report(file, `${label} test ${index + 1} threw: ${error.message}`);
      }
    }
  }

  if (question.type === 'interview') {
    if (!Array.isArray(question.keyPoints) || question.keyPoints.length < 3 || question.keyPoints.length > 5) {
      report(file, `${label} must have 3-5 keyPoints`);
    }
    const sentenceCount = (question.modelAnswer?.match(/[.!?](?:\s|$)/g) ?? []).length;
    if (sentenceCount < 2 || sentenceCount > 4) report(file, `${label} modelAnswer must contain 2-4 sentences`);
  }

  for (const key of ['question', 'prompt']) {
    if (typeof question[key] === 'string' && /\b(?:all of the above|none of the above)\b/i.test(question[key])) {
      report(file, `${label} must not use "all/none of the above"`);
    }
  }
  if (Array.isArray(question.options) && question.options.some(option => /\b(?:all of the above|none of the above)\b/i.test(option))) {
    report(file, `${label} options must not use "all/none of the above"`);
  }
}

async function findJsonFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    report(directory, `cannot read directory: ${error.message}`);
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findJsonFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') files.push(fullPath);
  }
  return files;
}

const args = process.argv.slice(2);
const updateExpected = args.includes('--write-expected');
const requested = args.filter(arg => arg !== '--write-expected');
const allFiles = await findJsonFiles(DATA_DIR);
const targetFiles = requested.length
  ? requested.map(file => path.resolve(process.cwd(), file))
  : allFiles;
const selectedFiles = [...new Set(targetFiles)];
const parsed = new Map();

for (const file of selectedFiles) {
  try {
    const content = await fs.readFile(file, 'utf8');
    const data = JSON.parse(content);
    parsed.set(file, { content, data });
    validateSchema(data, schema, 'topic', file);
    if (!Array.isArray(data.terms) || !Array.isArray(data.questions)) continue;
    const subject = data.meta?.subject;
    const idPrefixes = subject === 'javascript' ? ['js', 'javascript'] : [subject];
    const topicSlug = path.basename(file).startsWith('_')
      ? data.meta.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : path.basename(file, '.json').replace(/^\d+-/, '');
    const topicQuestions = new Set();
    for (let index = 0; index < data.terms.length; index += 1) {
      const term = data.terms[index];
      const expectedId = `${topicSlug}-t${String(index + 1).padStart(3, '0')}`;
      if (!idPrefixes.some(prefix => term.id === `${prefix}-${expectedId}`)) {
        report(file, `${term.id ?? `term ${index + 1}`} must use stable sequential id <subject>-${expectedId}`);
      }
      if (typeof term.definitionEn === 'string' && typeof term.term === 'string' &&
          normalize(term.definitionEn).includes(normalize(term.term))) {
        report(file, `${term.id} definitionEn must not contain its term`);
      }
    }
    for (let index = 0; index < data.questions.length; index += 1) {
      const question = data.questions[index];
      const expectedId = `${topicSlug}-q${String(index + 1).padStart(3, '0')}`;
      if (!idPrefixes.some(prefix => question.id === `${prefix}-${expectedId}`)) {
        report(file, `${question.id ?? `question ${index + 1}`} must use stable sequential id <subject>-${expectedId}`);
      }
      if (question.type && typeof (question.code ?? question.question ?? question.prompt) === 'string') {
        const normalized = `${normalize(question.code ?? '')}|${normalize(question.question ?? question.prompt ?? '')}`;
        if (topicQuestions.has(normalized)) report(file, `${question.id} duplicates a normalized question and code`);
        topicQuestions.add(normalized);
      }
      await validateQuestion(question, file, updateExpected, data.meta?.subject);
    }
  } catch (error) {
    report(file, `cannot parse or read JSON: ${error.message}`);
  }
}

const idsByFile = new Map();
const similarityQuestions = [];
const correctOptionCounts = [0, 0, 0, 0];
let optionQuestionCount = 0;
for (const file of allFiles) {
  let data;
  if (parsed.has(file)) data = parsed.get(file).data;
  else {
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
      continue;
    }
  }
  if (!Array.isArray(data.terms) || !Array.isArray(data.questions)) continue;
  for (const question of data.questions) similarityQuestions.push({ file, question });
  if (!path.basename(file).startsWith('_')) {
    for (const item of [...data.terms, ...data.questions]) {
      if (!item.id) continue;
      if (idsByFile.has(item.id)) report(file, `duplicate id "${item.id}" also found in ${path.relative(ROOT, idsByFile.get(item.id))}`);
      else idsByFile.set(item.id, file);
    }
  }
  const filePositions = [0, 0, 0, 0];
  const longestCorrect = [];
  for (const question of data.questions) {
    const optionQuestion = question.type === 'whatDoes' ||
      (question.type === 'predictOutput' && question.mode === 'choose');
    if (!optionQuestion || !Array.isArray(question.options) ||
        !Number.isInteger(question.correctOption) ||
        question.correctOption < 0 || question.correctOption >= 4) continue;
    filePositions[question.correctOption] += 1;
    correctOptionCounts[question.correctOption] += 1;
    optionQuestionCount += 1;
    const correctLength = question.options[question.correctOption].length;
    if (question.options.every((option, index) =>
      index === question.correctOption || correctLength > option.length
    )) longestCorrect.push(question.id);
  }
  const fileOptionCount = filePositions.reduce((sum, count) => sum + count, 0);
  if (fileOptionCount > 0 && !path.basename(file).startsWith('_')) {
    for (let position = 0; position < filePositions.length; position += 1) {
      if (filePositions[position] / fileOptionCount > 0.4) {
        report(file, `correctOption position ${position} has ${filePositions[position]}/${fileOptionCount} answers, exceeding 40%`);
      }
    }
    if (longestCorrect.length > 0) {
      warn(file, `${longestCorrect.length}/${fileOptionCount} correct options are longest: ${longestCorrect.join(', ')}`);
    }
  }
}

if (optionQuestionCount > 0) {
  for (let position = 0; position < correctOptionCounts.length; position += 1) {
    const share = correctOptionCounts[position] / optionQuestionCount;
    if (share < 0.2 || share > 0.3) {
      report(DATA_DIR, `global correctOption position ${position} has ${correctOptionCounts[position]}/${optionQuestionCount} answers (${(share * 100).toFixed(1)}%), outside 20%-30%`);
    }
  }
  console.log(`Correct-option positions: ${correctOptionCounts.map((count, index) => `${index}=${count}`).join(', ')} (${optionQuestionCount} total)`);
}

function similarityTokens(question) {
  const text = `${question.question ?? question.prompt ?? ''} ${question.code ?? question.solution ?? ''}`;
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}_$]+/gu) ?? []));
}

for (let leftIndex = 0; leftIndex < similarityQuestions.length; leftIndex += 1) {
  const left = similarityQuestions[leftIndex];
  const leftTokens = similarityTokens(left.question);
  if (leftTokens.size === 0) continue;
  for (let rightIndex = leftIndex + 1; rightIndex < similarityQuestions.length; rightIndex += 1) {
    const right = similarityQuestions[rightIndex];
    const rightTokens = similarityTokens(right.question);
    if (rightTokens.size === 0) continue;
    let intersection = 0;
    for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
    const union = leftTokens.size + rightTokens.size - intersection;
    if (intersection / union >= 0.85) {
      report(right.file, `${right.question.id} has token-set Jaccard similarity >= 0.85 with ${left.question.id} in ${path.relative(ROOT, left.file)}`);
    }
  }
}

if (updateExpected) {
  for (const [file, { data }] of parsed) {
    if (!file.startsWith(DATA_DIR) || !Array.isArray(data.questions)) continue;
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
}

for (const [file, { data }] of parsed) {
  if (!Array.isArray(data.questions) || !Array.isArray(data.terms)) continue;
  const byLevel = Object.fromEntries(LEVELS.map(level => [level, data.questions.filter(question => question.level === level).length]));
  const byType = Object.fromEntries(TYPES.map(type => [type, data.questions.filter(question => question.type === type).length]));
  console.log(`${path.relative(ROOT, file)} | terms: ${data.terms.length} | questions: ${data.questions.length}`);
  console.log(`  level: ${Object.entries(byLevel).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`  type:  ${Object.entries(byType).map(([key, value]) => `${key}=${value}`).join(', ')}`);
}

if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`\nValidation passed for ${selectedFiles.length} file(s).`);
}
if (warnings.length) {
  console.warn(`\n${warnings.length} warning(s):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

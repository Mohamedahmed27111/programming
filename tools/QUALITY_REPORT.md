# JavaScript Question Data Quality Report

## Summary

- 21 topic files; 12 terms and 24 questions per topic (504 questions total).
- All 252 topic terms have `definitionAr`.
- 167 option questions were deterministically shuffled in task A.
- Global correct-answer position counts: 170 questions; positions 0–3 are `42 / 45 / 44 / 39` (24.7% / 26.5% / 25.9% / 22.9%).
- The validator passed for all 22 JSON files, including `_example.json`.
- No topic has more than 30% of its option questions with a uniquely longest correct answer.

## Counts by Topic

Levels are shown as beginner / intermediate / advanced / interview. Types are shown as whatDoes / predictOutput / completeCode / writeCode / interview.

| Topic | Levels | Types |
|---|---:|---:|
| 01-basics | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 02-operators-math | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 03-strings | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 04-arrays | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 05-functions | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 06-control-flow | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 07-objects | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 08-loops | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 09-es6-variables | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 10-modern-functions | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 11-destructuring-templates | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 12-classes-modules | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 13-challenges | 8 / 8 / 5 / 3 | 3 / 3 / 3 / 12 / 3 |
| 14-hoisting-tdz | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 15-closures | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 16-this-keyword | 8 / 8 / 5 / 3 | 4 / 9 / 5 / 3 / 3 |
| 17-prototypes-inheritance | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 18-array-methods | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 19-coercion-equality | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| 20-async-event-loop | 8 / 8 / 5 / 3 | 4 / 9 / 5 / 3 / 3 |
| 21-error-handling-json | 8 / 8 / 5 / 3 | 4 / 7 / 5 / 5 / 3 |
| **Total** | **168 / 168 / 105 / 63** | **83 / 147 / 103 / 108 / 63** |

## Rewritten Question IDs

There are **47 unique question IDs** rewritten across tasks B, C, E, and F. The C list overlaps B at `js-async-event-loop-q013`; it is counted once in the unique total.

### B — Topic relevance (21)

- `js-closures-q007`, `js-closures-q009`, `js-closures-q013`, `js-closures-q016`, `js-closures-q020`
- `js-this-keyword-q007`, `js-this-keyword-q009`, `js-this-keyword-q013`, `js-this-keyword-q016`, `js-this-keyword-q020`
- `js-prototypes-inheritance-q007`, `js-prototypes-inheritance-q009`, `js-prototypes-inheritance-q016`
- `js-async-event-loop-q007`, `js-async-event-loop-q009`, `js-async-event-loop-q013`, `js-async-event-loop-q020`
- `js-classes-modules-q007`, `js-classes-modules-q020`
- `js-modern-functions-q007`
- `js-es6-variables-q007`

### C — Near-duplicates (14)

- `js-async-event-loop-q013`
- `js-strings-q021`
- `js-modern-functions-q003`
- `js-loops-q018`
- `js-challenges-q009`, `js-challenges-q014`
- `js-closures-q010`, `js-closures-q018`
- `js-prototypes-inheritance-q011`, `js-prototypes-inheritance-q018`, `js-classes-modules-q021`
- `js-async-event-loop-q021`
- `js-error-handling-json-q011`, `js-error-handling-json-q021`

### E — Advanced completeCode blanks (8)

- `js-basics-q019`
- `js-strings-q019`
- `js-arrays-q019`
- `js-functions-q019`
- `js-loops-q019`
- `js-closures-q019`
- `js-array-methods-q019`
- `js-coercion-equality-q019`

### F — Test/explanation alignment (5)

- `js-coercion-equality-q013`
- `js-hoisting-tdz-q013`
- `js-strings-q016`
- `js-arrays-q013`
- `js-destructuring-templates-q013`

## `node tools/validate.mjs` Output

```text
Correct-option positions: 0=42, 1=45, 2=44, 3=39 (170 total)
data\javascript\01-basics.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\02-operators-math.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\03-strings.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\04-arrays.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\05-functions.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\06-control-flow.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\07-objects.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\08-loops.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\09-es6-variables.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\10-modern-functions.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\11-destructuring-templates.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\12-classes-modules.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\13-challenges.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=3, predictOutput=3, completeCode=3, writeCode=12, interview=3
data\javascript\14-hoisting-tdz.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\15-closures.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\16-this-keyword.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=9, completeCode=5, writeCode=3, interview=3
data\javascript\17-prototypes-inheritance.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\18-array-methods.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\19-coercion-equality.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\20-async-event-loop.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=9, completeCode=5, writeCode=3, interview=3
data\javascript\21-error-handling-json.json | terms: 12 | questions: 24
  level: beginner=8, intermediate=8, advanced=5, interview=3
  type:  whatDoes=4, predictOutput=7, completeCode=5, writeCode=5, interview=3
data\javascript\_example.json | terms: 2 | questions: 6
  level: beginner=2, intermediate=3, advanced=0, interview=1
  type:  whatDoes=1, predictOutput=2, completeCode=1, writeCode=1, interview=1

Validation passed for 22 file(s).

21 warning(s):
- data\javascript\01-basics.json: 2/8 correct options are longest: js-basics-q015, js-basics-q017
- data\javascript\02-operators-math.json: 2/8 correct options are longest: js-operators-math-q006, js-operators-math-q017
- data\javascript\03-strings.json: 2/8 correct options are longest: js-strings-q006, js-strings-q017
- data\javascript\04-arrays.json: 2/8 correct options are longest: js-arrays-q006, js-arrays-q017
- data\javascript\05-functions.json: 2/8 correct options are longest: js-functions-q015, js-functions-q021
- data\javascript\06-control-flow.json: 2/8 correct options are longest: js-control-flow-q001, js-control-flow-q017
- data\javascript\07-objects.json: 2/8 correct options are longest: js-objects-q006, js-objects-q015
- data\javascript\08-loops.json: 1/8 correct options are longest: js-loops-q015
- data\javascript\09-es6-variables.json: 2/8 correct options are longest: js-es6-variables-q015, js-es6-variables-q017
- data\javascript\10-modern-functions.json: 2/8 correct options are longest: js-modern-functions-q015, js-modern-functions-q017
- data\javascript\11-destructuring-templates.json: 2/8 correct options are longest: js-destructuring-templates-q006, js-destructuring-templates-q017
- data\javascript\12-classes-modules.json: 2/8 correct options are longest: js-classes-modules-q001, js-classes-modules-q006
- data\javascript\13-challenges.json: 1/5 correct options are longest: js-challenges-q017
- data\javascript\14-hoisting-tdz.json: 2/8 correct options are longest: js-hoisting-tdz-q006, js-hoisting-tdz-q015
- data\javascript\15-closures.json: 2/8 correct options are longest: js-closures-q015, js-closures-q017
- data\javascript\16-this-keyword.json: 2/10 correct options are longest: js-this-keyword-q006, js-this-keyword-q017
- data\javascript\17-prototypes-inheritance.json: 2/8 correct options are longest: js-prototypes-inheritance-q006, js-prototypes-inheritance-q015
- data\javascript\18-array-methods.json: 2/8 correct options are longest: js-array-methods-q001, js-array-methods-q017
- data\javascript\19-coercion-equality.json: 2/8 correct options are longest: js-coercion-equality-q006, js-coercion-equality-q015
- data\javascript\20-async-event-loop.json: 2/9 correct options are longest: js-async-event-loop-q001, js-async-event-loop-q006
- data\javascript\21-error-handling-json.json: 2/8 correct options are longest: js-error-handling-json-q006, js-error-handling-json-q017
```

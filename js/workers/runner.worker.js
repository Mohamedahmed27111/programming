function isThenable(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function') &&
    typeof value.then === 'function';
}

async function awaitResult(value) {
  return isThenable(value) ? await value : value;
}

function normalize(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Result is not JSON-serialisable');
  return JSON.parse(serialized);
}

function equal(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

self.addEventListener('message', async event => {
  const { code, functionName, tests } = event.data;
  try {
    if (!/^[A-Za-z_$][\w$]*$/.test(functionName)) throw new TypeError('Invalid function name');
    const fn = new Function(`${code}\n;return typeof ${functionName} === 'function' ? ${functionName} : null;`)();
    if (typeof fn !== 'function') throw new TypeError(`${functionName} is not defined by the solution`);
    const results = [];
    for (const test of tests) {
      try {
        let actual = await awaitResult(fn(...test.args));
        if (test.invoke) {
          if (typeof actual !== 'function') throw new TypeError('This test expects the solution to return a function');
          const invoked = [];
          for (const args of test.invoke) invoked.push(await awaitResult(actual(...args)));
          actual = invoked;
        }
        if (actual === undefined) {
          results.push({ passed: test.expect === null, expected: test.expect, actual: null, actualDisplay: 'undefined' });
          continue;
        }
        const normalized = normalize(actual);
        results.push({ passed: equal(normalized, test.expect), expected: test.expect, actual: normalized });
      } catch (error) {
        results.push({ passed: false, expected: test.expect, actual: null, error: error.message });
      }
    }
    self.postMessage({ results });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
});

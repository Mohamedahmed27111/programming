let worker = null;
let activeRun = null;

function getWorker() {
  if (!worker) worker = new Worker(new URL('./workers/runner.worker.js', import.meta.url), { type: 'module' });
  return worker;
}

export function runWriteCode(code, functionName, tests) {
  if (activeRun) return Promise.reject(new Error('A code run is already in progress.'));
  const currentWorker = getWorker();
  return new Promise((resolve, reject) => {
    let timeout;
    const finish = (callback, value) => {
      clearTimeout(timeout);
      currentWorker.removeEventListener('message', onMessage);
      currentWorker.removeEventListener('error', onError);
      activeRun = null;
      callback(value);
    };
    const onMessage = event => finish(resolve, event.data);
    const onError = event => {
      currentWorker.terminate();
      if (worker === currentWorker) worker = null;
      finish(reject, new Error(event.message || 'Code worker failed.'));
    };
    activeRun = true;
    currentWorker.addEventListener('message', onMessage);
    currentWorker.addEventListener('error', onError);
    timeout = setTimeout(() => {
      currentWorker.terminate();
      if (worker === currentWorker) worker = null;
      finish(resolve, {
        results: tests.map(test => ({
          passed: false,
          expected: test.expect,
          actual: null,
          error: 'Execution exceeded the 2s time limit.'
        })),
        timedOut: true
      });
    }, 2000);
    currentWorker.postMessage({ code, functionName, tests });
  });
}

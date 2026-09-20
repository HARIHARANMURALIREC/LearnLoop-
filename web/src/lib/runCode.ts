// Sandboxed JS execution: user code runs in a throwaway Web Worker (no DOM/cookie access) with a hard timeout.
// The AI never executes code; it only reads the output this returns.
import type { CodeProblem } from './ai'

const WORKER_SRC = `
onmessage = (e) => {
  const { code, fn, tests } = e.data
  const logs = []
  const fmt = (a) => a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')
  console.log = (...a) => logs.push(fmt(a))
  const lines = []
  let passed = 0
  try {
    const f = new Function(code + '\\n;return typeof ' + fn + " === 'function' ? " + fn + ' : undefined')()
    if (!f) throw new Error('Function ' + fn + ' is not defined')
    tests.forEach((t, i) => {
      try {
        const got = f(...t.args)
        const ok = JSON.stringify(got) === JSON.stringify(t.expected)
        if (ok) passed++
        lines.push((ok ? 'PASS' : 'FAIL') + ' test ' + (i + 1) + ': ' + fn + '(' + t.args.map((a) => JSON.stringify(a)).join(', ') + ') -> ' + JSON.stringify(got) + (ok ? '' : ' (expected ' + JSON.stringify(t.expected) + ')'))
      } catch (err) { lines.push('ERROR test ' + (i + 1) + ': ' + err.message) }
    })
  } catch (err) { lines.push('ERROR: ' + err.message) }
  postMessage({ output: [...logs.map((l) => 'log: ' + l), ...lines].join('\\n'), passed: passed === tests.length })
}`

export function runCode(code: string, problem: CodeProblem, timeoutMs = 3000): Promise<{ output: string; passed: boolean }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }))
    const w = new Worker(url)
    const done = (r: { output: string; passed: boolean }) => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(r) }
    const timer = setTimeout(() => done({ output: `Timed out after ${timeoutMs}ms (infinite loop or too slow).`, passed: false }), timeoutMs)
    w.onmessage = (e) => done(e.data)
    w.onerror = (e) => done({ output: `ERROR: ${e.message}`, passed: false })
    w.postMessage({ code, fn: problem.function_name, tests: problem.tests })
  })
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function highlightCode(value) {
  const escaped = escapeHtml(value);
  const tokens = /(\/\/.*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:const|let|var|function|return|if|else|new|class|async|await|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/g;
  return escaped.replace(tokens, token => {
    const kind = token.startsWith('//') || token.startsWith('/*') ? 'comment'
      : /^['"]/.test(token) ? 'string'
        : /^\d/.test(token) ? 'number' : 'keyword';
    return `<span class="token-${kind}">${token}</span>`;
  });
}

export function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function formatValue(value) {
  if (value === undefined) return 'undefined';
  try { return JSON.stringify(value, null, 2) ?? String(value); }
  catch { return String(value); }
}

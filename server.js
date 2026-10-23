'use strict';

const express = require('express');
const path = require('node:path');

const app = express();
const port = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const aliases = new Set(['AND', 'OR', 'NOT', 'XOR', 'IMPLIES', 'IFF', 'TRUE', 'FALSE']);
const precedence = { IFF: 1, IMPLIES: 2, OR: 3, XOR: 4, AND: 5, NOT: 6 };
const symbolOperators = {
  '¬': 'NOT', '~': 'NOT', '!': 'NOT',
  '∧': 'AND', '&': 'AND', '&&': 'AND',
  '∨': 'OR', '|': 'OR', '||': 'OR',
  '⊕': 'XOR',
  '→': 'IMPLIES', '->': 'IMPLIES', '=>': 'IMPLIES',
  '↔': 'IFF', '⇔': 'IFF', '<->': 'IFF', '<=>': 'IFF', '=': 'IFF'
};

function tokenize(source) {
  if (typeof source !== 'string') throw new Error('Enter a logical expression.');
  const pattern = /<->|<=>|->|=>|&&|\|\||[¬~!∧&∨|⊕→↔⇔=()]|[A-Za-z_][A-Za-z_0-9]*|[01]/g;
  const raw = source.match(pattern) || [];
  const unexpected = source.replace(pattern, '').replace(/\s/g, '');
  if (unexpected) throw new Error(`Unexpected character “${unexpected[0]}”. Check the supported operators.`);
  if (!raw.length) throw new Error('Enter a logical expression.');
  return raw.map((token) => {
    if (symbolOperators[token]) return symbolOperators[token];
    const upper = token.toUpperCase();
    if (aliases.has(upper)) return upper;
    if (token === '1') return 'TRUE';
    if (token === '0') return 'FALSE';
    return { type: 'variable', name: token };
  });
}

function parse(source) {
  const tokens = tokenize(source);
  let index = 0;
  function atom() {
    const token = tokens[index++];
    if (token === 'NOT') return { op: 'NOT', arg: atom() };
    if (token === '(') {
      const node = expression(1);
      if (tokens[index++] !== ')') throw new Error('Missing closing parenthesis.');
      return node;
    }
    if (token === ')' || token === undefined || (typeof token === 'string' && precedence[token])) {
      throw new Error('Expected a variable or parenthesized expression.');
    }
    return typeof token === 'object' ? { op: 'VAR', name: token.name } : { op: token };
  }
  function expression(minimum) {
    let left = atom();
    while (index < tokens.length) {
      const operator = tokens[index];
      if (typeof operator !== 'string' || !precedence[operator] || precedence[operator] < minimum) break;
      index++;
      const rightMinimum = precedence[operator] + (operator === 'IMPLIES' || operator === 'IFF' ? 0 : 1);
      left = { op: operator, left, right: expression(rightMinimum) };
    }
    return left;
  }
  const ast = expression(1);
  if (index < tokens.length) throw new Error(`Unexpected operator or token near “${String(tokens[index])}”.`);
  return ast;
}

function collectVariables(node, result = new Set()) {
  if (node.op === 'VAR') result.add(node.name);
  if (node.arg) collectVariables(node.arg, result);
  if (node.left) collectVariables(node.left, result);
  if (node.right) collectVariables(node.right, result);
  return result;
}

function evaluate(node, assignment) {
  switch (node.op) {
    case 'VAR': return assignment[node.name];
    case 'TRUE': return true;
    case 'FALSE': return false;
    case 'NOT': return !evaluate(node.arg, assignment);
    case 'AND': return evaluate(node.left, assignment) && evaluate(node.right, assignment);
    case 'OR': return evaluate(node.left, assignment) || evaluate(node.right, assignment);
    case 'XOR': return evaluate(node.left, assignment) !== evaluate(node.right, assignment);
    case 'IMPLIES': return !evaluate(node.left, assignment) || evaluate(node.right, assignment);
    case 'IFF': return evaluate(node.left, assignment) === evaluate(node.right, assignment);
    default: throw new Error('Unsupported logical operator.');
  }
}

function enumerate(astOrA, variables, astB = null) {
  if (variables.length > 12) throw new Error('Use 12 or fewer distinct variables so the truth table stays readable.');
  const count = 2 ** variables.length;
  return Array.from({ length: count }, (_, rowIndex) => {
    const assignment = {};
    variables.forEach((name, column) => {
      assignment[name] = (rowIndex & (1 << (variables.length - column - 1))) !== 0;
    });
    const resultA = evaluate(astOrA, assignment);
    return astB ? { assignment, resultA, resultB: evaluate(astB, assignment) } : { assignment, result: resultA };
  });
}

function classify(rows) {
  const trueCount = rows.filter((row) => row.result).length;
  return {
    classification: trueCount === rows.length ? 'tautology' : trueCount === 0 ? 'contradiction' : 'contingency',
    trueCount,
    falseCount: rows.length - trueCount
  };
}

function handleError(res, error) {
  res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to process this expression.' });
}

app.post('/api/solve', (req, res) => {
  try {
    const ast = parse(req.body?.expression);
    const variables = [...collectVariables(ast)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const rows = enumerate(ast, variables);
    res.json({ variables, rows, ...classify(rows) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/compare', (req, res) => {
  try {
    const astA = parse(req.body?.expressionA);
    const astB = parse(req.body?.expressionB);
    const variables = [...new Set([...collectVariables(astA), ...collectVariables(astB)])]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const rows = enumerate(astA, variables, astB);
    const differingRow = rows.find((row) => row.resultA !== row.resultB) || null;
    res.json({ equivalent: differingRow === null, variables, rowsCompared: rows.length, counterexample: differingRow?.assignment || null });
  } catch (error) {
    handleError(res, error);
  }
});

app.listen(port, () => {
  console.log(`LogicLab is running at http://localhost:${port}`);
});

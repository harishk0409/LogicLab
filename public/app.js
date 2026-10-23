'use strict';

const byId = (id) => document.getElementById(id);
const exprBox = byId('expr');
const errorBox = byId('error');
const resultsPanel = byId('results');
resultsPanel.classList.add('card', 'results-panel');
document.querySelector('.layout').insertAdjacentElement('afterend', resultsPanel);
const guideDialog = byId('guideDialog');
byId('guideOpen').addEventListener('click', () => guideDialog.showModal());
byId('guideClose').addEventListener('click', () => guideDialog.close());
guideDialog.addEventListener('click', (event) => { if (event.target === guideDialog) guideDialog.close(); });

async function api(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The server could not process that request.');
  return data;
}

function renderTable(variables, rows) {
  const table = byId('truthTable');
  const head = document.createElement('tr');
  [...variables, 'Result'].forEach((name) => {
    const th = document.createElement('th');
    th.textContent = name;
    head.append(th);
  });
  const thead = document.createElement('thead');
  thead.append(head);
  const tbody = document.createElement('tbody');
  rows.forEach(({ assignment, result }) => {
    const tr = document.createElement('tr');
    variables.forEach((name) => {
      const td = document.createElement('td');
      td.textContent = assignment[name] ? 'T' : 'F';
      td.className = assignment[name] ? 'true' : 'false';
      tr.append(td);
    });
    const td = document.createElement('td');
    td.textContent = result ? 'T' : 'F';
    td.className = result ? 'true' : 'false';
    tr.append(td);
    tbody.append(tr);
  });
  table.replaceChildren(thead, tbody);
}

function renderSummary(data) {
  const pills = byId('pills');
  const classification = document.createElement('span');
  classification.className = `pill ${data.classification === 'tautology' ? 'taut' : data.classification === 'contradiction' ? 'contra' : 'contingent'}`;
  classification.textContent = data.classification[0].toUpperCase() + data.classification.slice(1);
  const variableCount = document.createElement('span');
  variableCount.className = 'pill';
  variableCount.textContent = `${data.variables.length} variable${data.variables.length === 1 ? '' : 's'}`;
  const trueRows = document.createElement('span');
  trueRows.className = 'pill';
  trueRows.textContent = `${data.trueCount} of ${data.rows.length} rows true`;
  pills.replaceChildren(classification, variableCount, trueRows);
}

async function solve() {
  errorBox.classList.remove('show');
  try {
    const data = await api('/api/solve', { expression: exprBox.value });
    renderSummary(data);
    renderTable(data.variables, data.rows);
    byId('resultTitle').textContent = 'Expression analysis';
    byId('rowCount').textContent = `${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`;
    byId('results').classList.add('show');
  } catch (error) {
    byId('results').classList.remove('show');
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
  }
}

byId('solve').addEventListener('click', solve);
exprBox.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    solve();
  }
});

document.querySelectorAll('.chip').forEach((button) => button.addEventListener('click', () => {
  exprBox.value = button.dataset.expr;
  solve();
}));

document.querySelectorAll('.toolbar .tool').forEach((button) => button.addEventListener('click', () => {
  const start = exprBox.selectionStart;
  const end = exprBox.selectionEnd;
  exprBox.setRangeText(button.dataset.insert, start, end, 'end');
  exprBox.focus();
}));

let compareTarget = byId('exprA');
[byId('exprA'), byId('exprB')].forEach((input) => input.addEventListener('focus', () => { compareTarget = input; }));
document.querySelectorAll('.compare-symbol').forEach((button) => {
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => {
    compareTarget.setRangeText(button.dataset.insert, compareTarget.selectionStart, compareTarget.selectionEnd, 'end');
    compareTarget.focus();
  });
});

byId('compare').addEventListener('click', async () => {
  const output = byId('compareResult');
  output.className = 'compare-result show';
  output.textContent = 'Comparing expressions…';
  try {
    const data = await api('/api/compare', {
      expressionA: byId('exprA').value,
      expressionB: byId('exprB').value
    });
    if (data.equivalent) {
      output.classList.add('same');
      output.textContent = `Equivalent — both expressions match across all ${data.rowsCompared} possible row${data.rowsCompared === 1 ? '' : 's'}.`;
    } else {
      output.classList.add('diff');
      const assignment = data.variables.map((name) => `${name}=${data.counterexample[name] ? 'T' : 'F'}`).join(', ') || 'no variables';
      output.textContent = `Not equivalent — they differ when ${assignment}.`;
    }
  } catch (error) {
    output.classList.add('error');
    output.textContent = error.message;
  }
});



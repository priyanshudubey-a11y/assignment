#!/usr/bin/env node
// QA-06 traceability report.
// Matrix: requirement -> test case -> automated test or checklist entry.
// Fails (exit 1) when a test case in docs/test-cases.md has no automation or checklist entry.
// Lists test cases tagged @pending-decision or @blocked so Session 5 knows what is not yet runnable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(here, '..');
const casesFile = process.env.TEST_CASES_FILE ?? path.resolve(testsDir, '../../docs/test-cases.md');

const caseIds = [...new Set([...fs.readFileSync(casesFile, 'utf8').matchAll(/^\|\s*(TC-\d{3})\s*\|/gm)].map((m) => m[1]))].sort();

const entries = new Map(); // TC -> [{kind, where, tags}]
const add = (tc, e) => entries.set(tc, [...(entries.get(tc) ?? []), e]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'test-results', 'playwright-report', 'evidence'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

for (const f of walk(testsDir)) {
  const rel = path.relative(testsDir, f);
  const text = fs.readFileSync(f, 'utf8');
  if (/\.spec\.ts$/.test(f)) {
    for (const m of text.matchAll(/^\s*test\(\s*(['"`])((?:\\.|(?!\1).)*)\1/gm)) {
      const title = m[2];
      const tc = title.match(/@(TC-\d{3})\b/);
      if (tc) add(tc[1], { kind: 'automated', where: rel, tags: [...title.matchAll(/@([\w-]+)/g)].map((t) => t[1]) });
    }
  } else if (rel === path.join('checklist', 'manual-checklist.md')) {
    for (const m of text.matchAll(/^##\s+(.*)$/gm)) {
      const tc = m[1].match(/@(TC-\d{3})\b/);
      if (tc) add(tc[1], { kind: 'checklist', where: rel, tags: [...m[1].matchAll(/@([\w-]+)/g)].map((t) => t[1]) });
    }
  }
}

const rows = [];
const missing = [];
const notRunnable = [];
const byReq = new Map();
for (const tc of caseIds) {
  const es = entries.get(tc) ?? [];
  if (!es.length) { missing.push(tc); continue; }
  const tags = new Set(es.flatMap((e) => e.tags));
  const reqs = [...tags].filter((t) => /^(FR|NFR)-\d+/.test(t));
  for (const r of reqs) byReq.set(r, [...(byReq.get(r) ?? []), tc]);
  const flags = ['pending-decision', 'blocked'].filter((t) => tags.has(t));
  if (flags.length) notRunnable.push(`${tc} (${flags.join(', ')})`);
  rows.push({ tc, reqs: reqs.join(', ') || '-', ac: [...tags].filter((t) => /^AC-/.test(t)).join(', ') || '-', where: es.map((e) => `${e.kind}: ${e.where}`).join('; '), reg: tags.has('regression') ? 'yes' : '' });
}
const extra = [...entries.keys()].filter((tc) => !caseIds.includes(tc));

const out = [];
out.push('# Traceability report', '', '## Requirement -> test cases', '');
for (const r of [...byReq.keys()].sort()) out.push(`- ${r}: ${[...new Set(byReq.get(r))].join(', ')}`);
out.push('', '## Test case -> automation or checklist', '', '| TC | Requirements | AC | Where | Regression |', '| --- | --- | --- | --- | --- |');
for (const r of rows) out.push(`| ${r.tc} | ${r.reqs} | ${r.ac} | ${r.where} | ${r.reg} |`);
out.push('', '## Not yet runnable (pending-decision or blocked)', '', ...(notRunnable.length ? notRunnable.map((x) => `- ${x}`) : ['- none']));
out.push('', `## Totals`, '', `- Test cases in docs/test-cases.md: ${caseIds.length}`, `- With automation or checklist entry: ${rows.length}`, `- Without: ${missing.length}`);
if (extra.length) out.push(`- Tagged but not in docs/test-cases.md: ${extra.join(', ')}`);
if (missing.length) out.push('', '## MISSING', '', ...missing.map((x) => `- ${x}`));
fs.mkdirSync(path.join(testsDir, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(testsDir, 'test-results', 'traceability.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
process.exit(missing.length || extra.length ? 1 : 0);

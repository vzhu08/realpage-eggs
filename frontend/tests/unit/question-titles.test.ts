import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoSource } from '../../src/api/demo';
import { QuestionCard } from '../../src/features/questions/QuestionCard';

test('actor questions have concise headings and input names without losing or repeating qualification', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  const template = outcome.assist!.question_plan.questions[0]!;
  for (const [field, title] of [
    ['person_under_bpc_16702', 'Is the actor a “person” under BPC §16702?'],
    ['end_consumer_of_product_or_service', 'Is the same actor the end consumer?'],
  ]) {
    const meaning = `Full documented qualification for ${field}. Leave unknown if unsupported or disputed. Do not infer it from property ownership.`;
    const question = { ...template, fact: { ...template.fact, field: field!, meaning }, prompt: `${meaning}? Answer yes or no, or leave unknown.` };
    const before = JSON.stringify(question);
    const html = renderToStaticMarkup(createElement(QuestionCard, { question, rank: 1, names: new Map(), current: outcome.lookup.evaluations, busy: false, allowDemoAnswers: false, onAnswer: () => {}, onInspect: () => {} }));
    assert.ok(html.includes(`class="question__prompt">${title}</h3>`));
    assert.ok(html.includes(`<legend class="sr-only">${title}</legend>`));
    assert.equal(html.split(meaning).length - 1, 1, 'complete qualification must appear exactly once');
    assert.match(html, /Answer guidance:/);
    assert.match(html, /Answer format as planned/);
    assert.match(html, /Answer yes or no, or leave unknown/);
    assert.doesNotMatch(html, /disputed\.\?/);
    assert.equal(JSON.stringify(question), before, 'display labels do not mutate facts or the planner prompt');
  }
});

test('ordinary question headings and the original planner wording remain unchanged', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  const question = outcome.assist!.question_plan.questions[0]!;
  const html = renderToStaticMarkup(createElement(QuestionCard, { question, rank: 1, names: new Map(), current: outcome.lookup.evaluations, busy: false, allowDemoAnswers: false, onAnswer: () => {}, onInspect: () => {} }));
  assert.ok(html.includes(`${question.fact.meaning}?</h3>`));
  assert.match(html, /Question as planned/);
  assert.doesNotMatch(html, /Answer guidance:|Answer format as planned/);
});

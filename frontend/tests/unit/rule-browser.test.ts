import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Rule } from '../../src/api/types';
import { DemoSource } from '../../src/api/demo';
import { Results } from '../../src/features/lookup/Results';
import { RuleList } from '../../src/features/lookup/RuleList';
import { filterRuleEvaluations } from '../../src/lib/ruleBrowser';
import { initialSession } from '../../src/state/session';
import { SourceProvider } from '../../src/state/source';

async function fixture() {
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  const original = outcome.lookup.rules[0]!;
  const evaluation = outcome.lookup.evaluations[0]!;
  const rules: Rule[] = [
    { ...original, team_rule_id: 'fictional-fee', title: 'Fictional application fee', requirement: 'Provide an itemized receipt.', category: 'application_screening_fees', citation: 'Fictional section 7', source_doc_id: 'TEST-FEES' },
    { ...original, team_rule_id: 'fictional-notice', title: 'Fictional notice provision', requirement: 'Provide a written notice.', category: 'just_cause_eviction', citation: 'Fictional section 9', source_doc_id: 'TEST-NOTICE' },
  ];
  const evaluations = rules.map(rule => ({ ...evaluation, team_rule_id: rule.team_rule_id, result: 'unknown' as const, evidence: [{ ...evaluation.evidence[0]!, doc_id: rule.source_doc_id }], missing_facts: ['units'], uncertainty_reasons: ['missing_property_fact: units', 'unresolved_extraction: Source interpretation needs review'] }));
  return { outcome, rules, evaluations };
}

test('all unknown results remain readable and filtering preserves the evaluator records', async () => {
  const { rules, evaluations } = await fixture();
  const before = JSON.stringify({ rules, evaluations });
  assert.deepEqual(filterRuleEvaluations(evaluations, rules), evaluations);
  for (const query of ['APPLICATION', 'itemized receipt', 'section 7', 'TEST-FEES', 'fictional-fee']) {
    const result = filterRuleEvaluations(evaluations, rules, query);
    assert.equal(result.length, 1);
    assert.equal(result[0], evaluations[0]);
    assert.equal(result[0]!.result, 'unknown');
  }
  assert.deepEqual(filterRuleEvaluations(evaluations, rules, '', 'just_cause_eviction'), [evaluations[1]]);
  assert.deepEqual(filterRuleEvaluations(evaluations, rules, 'receipt', 'just_cause_eviction'), []);
  assert.deepEqual(filterRuleEvaluations(evaluations, rules, '  fictional   receipt  '), [evaluations[0]]);
  assert.equal(JSON.stringify({ rules, evaluations }), before);
});

test('search does not add unevaluated rules or lose records whose rule detail is missing', async () => {
  const { rules, evaluations } = await fixture();
  const only = evaluations.slice(0, 1);
  assert.deepEqual(filterRuleEvaluations(only, rules, 'notice'), []);
  assert.deepEqual(filterRuleEvaluations(evaluations, [], 'fictional-fee'), [evaluations[0]]);
  assert.deepEqual(filterRuleEvaluations(evaluations, []), evaluations);
});

test('unknown cards show the provision, citation, evidence action and separate unresolved issues', async () => {
  const { rules, evaluations } = await fixture();
  const html = renderToStaticMarkup(createElement(RuleList, { rules, evaluations, selectedRuleId: null, onInspect: () => {}, changed: new Set<string>() }));
  assert.match(html, /Showing 2 of 2 returned rules/);
  assert.match(html, /Coverage unknown/);
  assert.match(html, /Provide an itemized receipt/);
  assert.match(html, /Fictional section 7/);
  assert.match(html, /Inspect evidence for Fictional application fee/);
  assert.match(html, /Needs:/);
  assert.match(html, /Other unresolved issues:/);
  assert.match(html, /Source interpretation needs review/);
});

test('all-unknown summary offers browsing and scopes review topics to evaluated rules', async () => {
  const { outcome, rules, evaluations } = await fixture();
  outcome.lookup.rules = rules;
  outcome.lookup.evaluations = evaluations.slice(0, 1);
  outcome.assist!.question_plan.questions = [];
  outcome.assist!.question_plan.remaining_uncertainty = [
    { kind: 'interpretation', message: 'Source interpretation needs review', remedy: 'Inspect source', field: null, rule_ids: ['fictional-fee'], predicate_ids: [], source_refs: [] },
    { kind: 'source_gap', message: 'A source outside this result is missing', remedy: 'Obtain source', field: null, rule_ids: ['fictional-notice'], predicate_ids: [], source_refs: [] },
  ];
  const result = createElement(Results, {
    session: initialSession(outcome.lookup.as_of), outcome, selectedRuleId: null, relatedCases: [], factDefinitions: {},
    onOpenCase: () => {}, onInspect: () => {}, onAnswer: () => {}, onRemoveAnswer: () => {}, onRun: () => {}, mode: 'demo', disagreementHref: () => '#/disagreements',
  });
  const html = renderToStaticMarkup(createElement(SourceProvider, { value: new DemoSource(), children: result }));
  assert.match(html, /Browse 1 returned rule/);
  assert.match(html, /1 open review topic for returned rules/);
  assert.match(html, /1 additional review topic concerns rules outside this result/);
  assert.match(html, /not a count of missing property facts/);
  assert.match(html, /Returned rules and source evidence/);
  assert.doesNotMatch(html, /No rules were returned/);
});

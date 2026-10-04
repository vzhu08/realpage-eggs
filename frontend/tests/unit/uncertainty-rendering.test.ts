import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoSource } from '../../src/api/demo';
import { RemainingUncertainty } from '../../src/features/questions/RemainingUncertainty';
import { WhatChanged } from '../../src/features/questions/WhatChanged';

test('a partial property date keeps Core B’s factual remedy without a contradictory review row', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  const evaluation = outcome.lookup.evaluations[0]!;
  evaluation.result = 'unknown';
  evaluation.missing_facts = ['certificate_of_occupancy'];
  evaluation.uncertainty_reasons = ['insufficient_fact_precision: certificate_of_occupancy date_on_or_before 2020-06-15: unknown'];
  outcome.lookup.evaluations = [evaluation];
  const plan = outcome.assist!.question_plan;
  plan.questions = [];
  plan.remaining_uncertainty = [{ kind: 'property_fact', message: 'The recorded occupancy month spans the cutoff.', remedy: 'Supply the documented certificate date.', field: 'certificate_of_occupancy', rule_ids: [evaluation.team_rule_id], predicate_ids: [], source_refs: [] }];
  const html = renderToStaticMarkup(createElement(RemainingUncertainty, { outcome, answers: [], onInspect: () => {} }));
  assert.match(html, /Supply the documented certificate date/);
  assert.match(html, /data-kind="property_fact"/);
  assert.doesNotMatch(html, /data-kind="interpretation"|No answer about the property/);
  const changed = renderToStaticMarkup(createElement(WhatChanged, { previous: structuredClone(outcome), outcome }));
  assert.match(changed, /Still unknown:/);
  assert.doesNotMatch(changed, /not for want of a property fact/);
});

test('an unsupported legal classification is not reintroduced as an answerable property fact', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  const evaluation = outcome.lookup.evaluations[0]!;
  evaluation.result = 'unknown';
  evaluation.missing_facts = ['rent_ordinance_coverage'];
  evaluation.uncertainty_reasons = ['missing_property_fact: rent_ordinance_coverage'];
  outcome.lookup.evaluations = [evaluation];
  outcome.assist!.question_plan.questions = [];
  outcome.assist!.question_plan.remaining_uncertainty = [{ kind: 'interpretation', message: 'No supported factual input is defined for this legal classification.', remedy: 'Review the encoded coverage with Core.', field: 'rent_ordinance_coverage', rule_ids: [evaluation.team_rule_id], predicate_ids: [], source_refs: [] }];
  const html = renderToStaticMarkup(createElement(RemainingUncertainty, { outcome, answers: [], onInspect: () => {} }));
  assert.match(html, /Review the encoded coverage with Core/);
  assert.match(html, /data-kind="interpretation"/);
  assert.doesNotMatch(html, /data-kind="property_fact"|A fact about the property can close these/);
});

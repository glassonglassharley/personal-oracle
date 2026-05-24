import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQuantityWithUnit, getUnitLabel, pluralizeUnitLabel } from './formatUnits.js';

test('pluralizeUnitLabel derives readable labels from vice names', () => {
  assert.equal(pluralizeUnitLabel('Beer'), 'beers');
  assert.equal(pluralizeUnitLabel('Cigarettes'), 'cigarettes');
  assert.equal(pluralizeUnitLabel('Candy'), 'candies');
  assert.equal(pluralizeUnitLabel('Box'), 'boxes');
});

test('getUnitLabel prefers explicit labels and replaces placeholder unit labels', () => {
  assert.equal(getUnitLabel({ name: 'Beer', unit_label: 'pints' }), 'pints');
  assert.equal(getUnitLabel({ name: 'Beer', unit_label: 'unit' }), 'beers');
  assert.equal(getUnitLabel({ name: 'Beer', unit_label: 'units' }), 'beers');
});

test('formatQuantityWithUnit never renders placeholder unit for a named vice', () => {
  assert.equal(formatQuantityWithUnit(2, { name: 'Beer', unit_label: 'unit' }), '2 beers');
  assert.equal(formatQuantityWithUnit(1.5, { name: 'Coffee', unit_label: '' }), '1.5 coffees');
});

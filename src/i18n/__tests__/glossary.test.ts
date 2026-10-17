/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GLOSSARY } from '../../data/glossary';
import en from '../en';

test('every glossary line has an English translation', () => {
  const missing = Object.values(GLOSSARY).map((g) => g.line).filter((s) => !(s in en));
  assert.deepEqual(missing, []);
});

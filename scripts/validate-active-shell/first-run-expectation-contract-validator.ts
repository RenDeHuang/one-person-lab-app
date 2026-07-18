import fs from 'node:fs';
import {
  buildFirstRunCompiledExpectations,
  renderCompiledFirstRunExpectations,
} from '../compile-first-run-expectations.ts';

export function validateFirstRunCompiledExpectations(input: {
  compiledPath: string;
  gui: Record<string, any>;
  matrix: Record<string, any>;
  pageState: Record<string, any>;
  productProfile: Record<string, any>;
  release: Record<string, any>;
}): void {
  const compiled = buildFirstRunCompiledExpectations(input);
  const expected = renderCompiledFirstRunExpectations(compiled);
  const actual = fs.readFileSync(input.compiledPath, 'utf8');
  if (actual !== expected) {
    throw new Error('Compiled first-run expectations do not exactly match the App contract sources.');
  }
}

import * as fs from 'fs';
import * as path from 'path';

/**
 * Find the lowest of multiple files by walking up parent directories. If
 * multiple files exist at the same level, they will all be returned.
 */
export function findUpMultiple(names: string[], directory: string = process.cwd()): string[] {
  const absoluteDirectory = path.resolve(directory);

  const files = [];
  for (const name of names) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) {
      files.push(file);
    }
  }

  if (files.length > 0) {
    return files;
  }

  const { root } = path.parse(absoluteDirectory);
  if (absoluteDirectory === root) {
    return [];
  }

  return findUpMultiple(names, path.dirname(absoluteDirectory));
}

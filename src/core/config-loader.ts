// src/core/config-loader.ts
import fs from 'fs';
import path from 'path';

const configDir = path.join(process.cwd(), 'data');
const cache: Record<string, unknown> = {};
const lastModified: Record<string, number> = {};

function loadFile(fileName: string): unknown {
  const filePath = path.join(configDir, `${fileName}.json`);
  const stat = fs.statSync(filePath);
  const mtime = stat.mtimeMs;
  if (lastModified[filePath] !== mtime) {
    const content = fs.readFileSync(filePath, 'utf-8');
    cache[fileName] = JSON.parse(content);
    lastModified[filePath] = mtime;
  }
  return cache[fileName];
}

export const configLoader = {
  get<T = unknown>(fileName: string): T {
    return loadFile(fileName) as T;
  },
  reload(fileName: string) {
    const filePath = path.join(configDir, `${fileName}.json`);
    delete lastModified[filePath];
    delete cache[fileName];
    return this.get(fileName);
  },
  /** 清除所有缓存，主要用于测试隔离 */
  clearCache() {
    for (const key of Object.keys(cache)) {
      delete cache[key];
    }
    for (const key of Object.keys(lastModified)) {
      delete lastModified[key];
    }
  },
};

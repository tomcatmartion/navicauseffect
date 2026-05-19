// src/config/config-loader.ts
import fs from 'fs';
import path from 'path';

const configDir = path.join(process.cwd(), 'config');
const cache: Record<string, any> = {};
const lastModified: Record<string, number> = {};

function loadFile(fileName: string): any {
  const filePath = path.join(configDir, fileName);
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
  get<T = any>(fileName: string): T {
    return loadFile(`${fileName}.json`) as T;
  },
  reload(fileName: string) {
    const filePath = path.join(configDir, `${fileName}.json`);
    delete lastModified[filePath];
    delete cache[`${fileName}.json`];
    return this.get(fileName);
  }
};
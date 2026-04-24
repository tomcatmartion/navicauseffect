import path from "path";
import type { EmbeddingDimensionFamily } from "./constants";

const ROOT = "data/zvec";

export function getLogicdocCollectionPath(family: EmbeddingDimensionFamily): string {
  const sub = family === "1536" ? "sysknowledge_dim1536" : "sysknowledge_dim1024";
  return path.join(process.cwd(), ROOT, sub);
}

export function getLogicdocIndexLockPath(): string {
  return path.join(process.cwd(), ROOT, ".sysknowledge-reindex.lock");
}

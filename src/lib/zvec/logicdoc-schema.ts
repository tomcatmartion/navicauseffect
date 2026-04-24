import {
  ZVecCollectionSchema,
  ZVecDataType,
  ZVecIndexType,
  ZVecMetricType,
} from "@zvec/zvec";
import type { EmbeddingDimensionFamily } from "./constants";
import { LOGICDOC_ZVEC_INDEX_VERSION } from "./constants";

const invert = { indexType: ZVecIndexType.INVERT } as const;

function dimensionFor(family: EmbeddingDimensionFamily): number {
  return family === "1536" ? 1536 : 1024;
}

export function buildLogicdocCollectionSchema(
  family: EmbeddingDimensionFamily
): ZVecCollectionSchema {
  const dim = dimensionFor(family);
  return new ZVecCollectionSchema({
    name: "sysknowledge",
    vectors: {
      name: "embedding",
      dataType: ZVecDataType.VECTOR_FP32,
      dimension: dim,
      indexParams: {
        indexType: ZVecIndexType.HNSW,
        metricType: ZVecMetricType.COSINE,
      },
    },
    fields: [
      { name: "text", dataType: ZVecDataType.STRING, indexParams: invert },
      { name: "source_file", dataType: ZVecDataType.STRING, indexParams: invert },
      { name: "content_hash", dataType: ZVecDataType.STRING, indexParams: invert },
      { name: "index_version", dataType: ZVecDataType.STRING, indexParams: invert },
      {
        name: "biz_modules",
        dataType: ZVecDataType.ARRAY_STRING,
        indexParams: invert,
      },
      {
        name: "stars",
        dataType: ZVecDataType.ARRAY_STRING,
        indexParams: invert,
      },
      {
        name: "palaces",
        dataType: ZVecDataType.ARRAY_STRING,
        indexParams: invert,
      },
      {
        name: "energy_levels",
        dataType: ZVecDataType.ARRAY_STRING,
        indexParams: invert,
      },
      {
        name: "time_scopes",
        dataType: ZVecDataType.ARRAY_STRING,
        indexParams: invert,
      },
    ],
  });
}

export function getStoredIndexVersion(): string {
  return LOGICDOC_ZVEC_INDEX_VERSION;
}

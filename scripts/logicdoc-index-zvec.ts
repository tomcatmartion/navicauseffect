import "dotenv/config";
import { prisma } from "../src/lib/db";
import { withLogicdocIndexFileLock } from "../src/lib/zvec/index-lock";
import { runLogicdocZvecIndex } from "../src/lib/zvec/logicdoc-indexer";

async function main() {
  const stats = await withLogicdocIndexFileLock(() =>
    runLogicdocZvecIndex(prisma)
  );
  console.log("[logicdoc:index-zvec] done", stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

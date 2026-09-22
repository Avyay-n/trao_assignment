import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import {
  generateInterviewKit,
  BatchInputCase,
  BatchOutput,
  BatchOutputKitEntry,
  BatchInputSchema,
  createLLMProvider,
} from "../packages/core/src/index.js";

interface CliArgs {
  input: string;
  output: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && i + 1 < args.length) {
      input = args[i + 1];
      i++;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      output = args[i + 1];
      i++;
    }
  }

  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  return { input, output };
}

async function runEvaluation() {
  const { input, output } = parseArgs();
  const startTime = Date.now();

  console.log(`[Evaluate CLI] Reading test cases from: ${input}`);
  const inputRaw = await fs.readFile(input, "utf-8");
  let cases: BatchInputCase[];

  try {
    const parsed = JSON.parse(inputRaw);
    const validated = BatchInputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[Evaluate CLI] Invalid input file schema:", validated.error);
      process.exit(1);
    }
    cases = validated.data;
  } catch (err: any) {
    console.error(`[Evaluate CLI] Failed to parse input JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Evaluate CLI] Found ${cases.length} case(s) to process.`);
  const llm = createLLMProvider();
  console.log(`[Evaluate CLI] Active LLM Provider: ${llm.name}`);

  const results: BatchOutputKitEntry[] = [];

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    console.log(`\n-----------------------------------------------------------`);
    console.log(`[Case ${i + 1}/${cases.length}] Processing ID: ${testCase.id}`);
    console.log(`  Company URL: ${testCase.company_url}`);
    console.log(`  Requested Days: ${testCase.days}`);
    console.log(`  JD Length: ${testCase.jd.length} chars`);

    try {
      const kit = await generateInterviewKit(
        {
          jd: testCase.jd,
          company_url: testCase.company_url,
          days: testCase.days,
        },
        {
          llmProvider: llm,
          allowLocalUrls: true, // Evaluation tests may run against local mock servers
          onProgress: (p) => {
            console.log(`  -> [${p.phase}] ${p.message} (${p.progress}%)`);
          },
        }
      );

      results.push({
        id: testCase.id,
        status: "ok",
        kit,
        error: null,
      });
      console.log(`  ✓ Case ${testCase.id} successfully completed.`);
    } catch (err: any) {
      console.error(`  ✗ Case ${testCase.id} failed: ${err.message}`);
      results.push({
        id: testCase.id,
        status: "failed",
        kit: null,
        error: {
          code: err.code || "PIPELINE_ERROR",
          message: err.message || "An unexpected error occurred during kit generation.",
        },
      });
      // Continue processing next cases without aborting run!
    }
  }

  const batchOutput: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  const outputDir = path.dirname(path.resolve(output));
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(output, JSON.stringify(batchOutput, null, 2), "utf-8");

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n===========================================================`);
  console.log(`[Evaluate CLI] Completed ${cases.length} cases in ${elapsedSec}s.`);
  console.log(`[Evaluate CLI] Output successfully written to: ${output}`);
  console.log(`===========================================================\n`);
}

runEvaluation().catch((err) => {
  console.error("[Evaluate CLI] Fatal error:", err);
  process.exit(1);
});

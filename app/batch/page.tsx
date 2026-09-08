"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Page, Stepper, TopBar } from "@/components/Shell";
import UploadStep from "@/components/UploadStep";
import ReviewStep from "@/components/ReviewStep";
import RunStep from "@/components/RunStep";
import ResultsStep from "@/components/ResultsStep";
import type { ParseResult, ParsedRow } from "@/lib/parse";
import { useRunner } from "@/lib/useRunner";

type Step = 1 | 2 | 3 | 4;

function Wizard() {
  const params = useSearchParams();
  const typeId = (params.get("type") === "id" ? "id" : "vcard") as "vcard" | "id";

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const runner = useRunner(typeId);

  async function begin(rows: ParsedRow[]) {
    if (!parsed) return;
    setStep(3);
    await runner.start(rows, parsed.fileName);
  }

  return (
    <Page>
      <TopBar active="Batches" />
      <Stepper step={step} />
      <main className="main">
        <div className="wrap">
          {step === 1 && (
            <UploadStep
              typeId={typeId}
              parsed={parsed}
              file={file}
              onParsed={(nextFile, result) => { setFile(nextFile); setParsed(result); }}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && parsed && (
            <ReviewStep
              typeId={typeId}
              parsed={parsed}
              starting={runner.status !== "idle" && runner.status !== "done"}
              autoSave={runner.autoSave}
              onAutoSaveChange={runner.setAutoSave}
              onBack={() => setStep(1)}
              onStart={begin}
            />
          )}

          {step === 3 && (
            <RunStep
              status={runner.status}
              rows={runner.rows}
              log={runner.log}
              message={runner.message}
              startedAt={runner.startedAt}
              finishedAt={runner.finishedAt}
              autoSave={runner.autoSave}
              onPause={runner.pause}
              onResume={runner.resume}
              onStop={runner.stop}
              onFinished={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <ResultsStep
              rows={runner.rows}
              sourceName={runner.sourceName}
              startedAt={runner.startedAt}
              finishedAt={runner.finishedAt}
              onSaveOne={runner.saveOne}
              onSaveZip={runner.saveZip}
              onNewBatch={() => {
                runner.reset();
                setParsed(null);
                setFile(null);
                setStep(1);
              }}
            />
          )}
        </div>
      </main>
    </Page>
  );
}

export default function BatchPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: 40 }}>Loading…</div>}>
      <Wizard />
    </Suspense>
  );
}

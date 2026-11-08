import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("test-results/qa", { recursive: true });
const cases = {
  avisos: /Broadcast dismissal lost on F5|Dismissal lost on (SPA navigation|F5)/,
  impersonacao: /impersonation-fab/,
  navegacao: /Cached navigation displayed route skeleton/,
  agendamento: /Agendamento confirmado|Public booking was not persisted exactly once/,
};
for (const [name, expected] of Object.entries(cases)) {
  const result = spawnSync(process.execPath, ["scripts/qa/run.mjs"], {
    env: {
      ...process.env,
      QA_SCENARIOS: name,
      QA_INJECT_REGRESSION: name,
      QA_INJECT_DISMISSAL: name === "avisos" ? "1" : "0",
    },
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 1_000_000,
  });
  const evidence = (result.stdout ?? "") + (result.stderr ?? "");
  writeFileSync(`test-results/qa/regression-${name}.log`, evidence);
  assert(result.status !== 0, "QA incorrectly passed the injected regression: " + name);
  assert(
    expected.test(evidence),
    "QA failed for a reason other than the injected regression: " +
      name +
      " " +
      evidence.slice(-2500),
  );
  console.log("PASS regression detected: " + name);
}
console.log("PASS regression detection matrix; production source was unchanged");

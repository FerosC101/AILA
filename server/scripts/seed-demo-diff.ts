// Seeds two synthetic versions of one source so the Semantic Diff Engine has an
// amendment to show in a demo. Real version history accrues automatically on
// re-crawl; this just makes the "Check amendments" panel render live today.
//
// Run: npx tsx scripts/seed-demo-diff.ts

import { initDb, upsertSources, snapshotVersion, getVersionHistory } from "../src/db.js";
import { loadSources, findSource } from "../src/sources.js";
import { diffSource } from "../src/diff.js";

const SOURCE_ID = "singapore--personal-data-protection-act-pdpa";

// v1 — the "previous" consolidated policy summary
const V1 = `
Transfer Limitation Obligation. An organisation may transfer personal data outside Singapore only where the recipient is bound by legally enforceable obligations to provide a comparable standard of protection.
Consent. An organisation must obtain the consent of the individual before collecting, using or disclosing personal data for a purpose.
Retention. Personal data shall be retained for a minimum period of one year for record-keeping purposes.
Data Protection Officer. Organisations are encouraged to designate a Data Protection Officer responsible for compliance.
Access and Correction. An individual may request access to and correction of their personal data held by the organisation.
Notification. Where a data breach occurs, the organisation should assess whether notification is appropriate.
`.trim();

// v2 — the "amended" version with strengthened + new obligations
const V2 = `
Transfer Limitation Obligation. An organisation may transfer personal data outside Singapore only where the recipient is bound by legally enforceable obligations to provide a comparable standard of protection.
Consent. An organisation must obtain the express, informed consent of the individual before collecting, using or disclosing personal data, and consent may be withdrawn at any time.
Retention. Personal data shall be retained for a minimum period of five years for record-keeping purposes.
Data Protection Officer. Organisations must designate a Data Protection Officer responsible for compliance, and the officer's business contact information shall be made available to the public.
Access and Correction. An individual may request access to and correction of their personal data held by the organisation.
Data Breach Notification. Where a data breach that results in significant harm occurs, the organisation must notify the Commission and affected individuals within three calendar days.
Localisation of Biometric Data. Cross-border transfer of biometric identifiers is prohibited without the prior written approval of the Commission.
`.trim();

async function main() {
  await initDb();
  await upsertSources(loadSources()); // ensure the source row exists (FK)
  const src = findSource(SOURCE_ID);
  if (!src) { console.error(`Source not found: ${SOURCE_ID}`); process.exit(1); }

  const a = await snapshotVersion(SOURCE_ID, V1);
  // slight delay so captured_at ordering is deterministic
  await new Promise((r) => setTimeout(r, 1100));
  const b = await snapshotVersion(SOURCE_ID, V2);
  console.log(`Snapshotted v1 (changed=${a.changed}) and v2 (changed=${b.changed}).`);

  const hist = await getVersionHistory(SOURCE_ID);
  console.log(`Versions for ${src.instrument}: ${hist.length}`);

  const diff = await diffSource(SOURCE_ID);
  console.log("Diff summary:", diff.summary);
  for (const c of diff.changes) console.log(`  [${c.severity}] ${c.kind}: ${c.text.slice(0, 80)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

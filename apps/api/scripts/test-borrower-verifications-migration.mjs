import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

// Owns only a random schema in a dedicated LOCAL test database. Never loads .env.
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, 'Set TEST_DATABASE_URL to local zaloghub_migration_test');
const target = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.equal(target.pathname, '/zaloghub_migration_test', 'Refusing a non-test database');
const schema = `verification_test_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString });
const q = (sql, args = []) => client.query(sql, args);
const id = () => randomUUID();
let checks = 0;
async function insert(table, data) {
  const columns = Object.keys(data);
  await q(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(data));
  return data;
}
async function reject(sql, args = [], code = '23514') {
  await q('SAVEPOINT expected_failure');
  try {
    await assert.rejects(q(sql, args), error => error.code === code);
    checks++;
  } finally {
    await q('ROLLBACK TO SAVEPOINT expected_failure');
    await q('RELEASE SAVEPOINT expected_failure');
  }
}
async function rejectInsert(table, data, code) {
  const columns = Object.keys(data);
  await reject(`INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(data), code);
}
const migrationName = '20261113000000_borrower_verifications';
const migrationRoot = new URL('../prisma/migrations/', import.meta.url);
await client.connect();
try {
  await q(`CREATE SCHEMA "${schema}"`);
  await q(`SET search_path TO "${schema}", public`);
  const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter(d => d.isDirectory()).map(d => d.name).sort();
  assert.ok(migrations.includes(migrationName));
  for (const migration of migrations.filter(name => name < migrationName)) {
    await q(await readFile(new URL(`${migration}/migration.sql`, migrationRoot), 'utf8'));
  }
  const actor = id(), otherActor = id();
  for (const userId of [actor, otherActor]) {
    await insert('users', { id: userId, email: `${userId}@example.test`, passwordHash: 'fixture', updatedAt: new Date() });
  }
  const workspace = (await q('SELECT id FROM workspaces WHERE personal_owner_id=$1', [actor])).rows[0].id;
  const otherWorkspace = (await q('SELECT id FROM workspaces WHERE personal_owner_id=$1', [otherActor])).rows[0].id;
  const borrower = id(), party = id(), otherParty = id(), sameWorkspaceParty = id();
  await insert('borrowers', { id: borrower, userId: actor, firstName: 'Test', lastName: 'Borrower', updatedAt: new Date() });
  await insert('parties', { id: party, workspace_id: workspace, kind: 'PERSON', display_name: 'Borrower', legacy_borrower_id: borrower });
  await insert('parties', { id: otherParty, workspace_id: otherWorkspace, kind: 'PERSON', display_name: 'Other workspace' });
  await insert('parties', { id: sameWorkspaceParty, workspace_id: workspace, kind: 'PERSON', display_name: 'Another person' });
  const document = id(), otherDocument = id();
  for (const [doc, ws] of [[document, workspace], [otherDocument, otherWorkspace]]) {
    await insert('documents', { id: doc, workspace_id: ws, storage_key: doc, sha256: 'a'.repeat(64), mime_type: 'application/pdf' });
  }
  const legacyTables = ['users', 'workspaces', 'workspace_members', 'borrowers', 'parties', 'documents'];
  const snapshot = async table => (await q(`SELECT to_jsonb(t) - ARRAY['original_filename','size_bytes','created_at'] AS row FROM "${table}" t ORDER BY id`)).rows;
  const before = new Map();
  for (const table of legacyTables) before.set(table, await snapshot(table));
  await q(await readFile(new URL(`${migrationName}/migration.sql`, migrationRoot), 'utf8'));
  for (const table of legacyTables) {
    assert.deepEqual(await snapshot(table), before.get(table), `${table}: legacy data preserved`);
    checks++;
  }
  const newTables = ['party_identity_versions', 'borrower_verifications', 'borrower_verification_items', 'borrower_check_runs', 'borrower_check_findings', 'borrower_verification_evidence', 'borrower_verification_risks'];
  const tables = (await q('SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename=ANY($2::text[])', [schema, newTables])).rows;
  assert.equal(tables.length, 7); checks++;
  await q('BEGIN');
  const identityData = (partyId = party, ws = workspace) => ({
    id: id(), workspace_id: ws, party_id: partyId, version_no: 1,
    first_name: 'Test', last_name: 'Borrower', birth_date: '1985-04-15',
    passport_series: '4500', passport_number: '123456', passport_issued_on: '2005-04-15',
    confirmed_by_id: actor,
  });
  const identity = await insert('party_identity_versions', identityData());
  const foreignIdentity = await insert('party_identity_versions', identityData(otherParty, otherWorkspace));
  const sameWorkspaceIdentity = await insert('party_identity_versions', identityData(sameWorkspaceParty));
  await rejectInsert('party_identity_versions', { ...identityData(), version_no: 2, passport_series: 'abcd' });
  await rejectInsert('party_identity_versions', { ...identityData(), version_no: 2, previous_names: '{}' });
  await rejectInsert('party_identity_versions', { ...identityData(), version_no: 2, source_document_id: otherDocument }, '23503');
  await reject('UPDATE party_identity_versions SET passport_number=$1 WHERE id=$2', ['999999', identity.id]);
  await reject('DELETE FROM party_identity_versions WHERE id=$1', [identity.id]);
  const verificationData = () => ({
    id: id(), workspace_id: workspace, party_id: party, identity_version_id: identity.id,
    checklist_version: 'v1', risk_rules_version: 'v1', created_by_id: actor, updated_at: new Date(),
  });
  const verification = await insert('borrower_verifications', verificationData());
  const sibling = await insert('borrower_verifications', verificationData());
  await rejectInsert('borrower_verifications', { ...verificationData(), identity_version_id: sameWorkspaceIdentity.id }, '23503');
  await rejectInsert('borrower_verifications', { ...verificationData(), identity_version_id: foreignIdentity.id }, '23503');
  await rejectInsert('borrower_verifications', { ...verificationData(), status: 'COMPLETED' });
  const itemData = (verificationId = verification.id) => ({
    id: id(), workspace_id: workspace, verification_id: verificationId,
    check_code: 'PASSPORT_VALIDITY', definition_version: 'v1', title: 'Passport', result_type: 'BOOLEAN', updated_at: new Date(),
  });
  const item = await insert('borrower_verification_items', itemData());
  const siblingItem = await insert('borrower_verification_items', itemData(sibling.id));
  await rejectInsert('borrower_verification_items', itemData(), '23505');
  await reject('UPDATE borrower_verification_items SET status=$1 WHERE id=$2', ['NOT_APPLICABLE', item.id]);
  const runData = (it = item, attempt = 1) => ({
    id: id(), workspace_id: workspace, verification_id: it.verification_id, item_id: it.id,
    identity_version_id: identity.id, attempt_no: attempt, mode: 'MANUAL', performed_by_id: actor,
    idempotency_key: id(), input_snapshot: '{}', input_hash: 'b'.repeat(64), assessment_rules_version: 'v1',
  });
  const run = await insert('borrower_check_runs', runData());
  const siblingRun = await insert('borrower_check_runs', runData(siblingItem));
  await rejectInsert('borrower_check_runs', { ...runData(item, 2), identity_version_id: sameWorkspaceIdentity.id });
  await rejectInsert('borrower_check_runs', { ...runData(item, 2), item_id: siblingItem.id }, '23503');
  await rejectInsert('borrower_check_runs', { ...runData(item, 2), idempotency_key: run.idempotency_key }, '23505');
  await rejectInsert('borrower_check_runs', runData(item, 1), '23505');
  await rejectInsert('borrower_check_runs', { ...runData(item, 2), input_hash: 'invalid' });
  await rejectInsert('borrower_check_runs', { ...runData(item, 2), result_amount: '100' });
  await reject('UPDATE borrower_verification_items SET accepted_run_id=$1 WHERE id=$2', [run.id, item.id]);
  await reject('UPDATE borrower_check_runs SET input_snapshot=$1 WHERE id=$2', ['{"changed":true}', run.id]);
  const finding = await insert('borrower_check_findings', {
    id: id(), workspace_id: workspace, verification_id: verification.id, run_id: run.id,
    finding_type: 'OTHER', record_key: 'record-1', title: 'Fixture finding',
  });
  const evidenceData = () => ({
    id: id(), workspace_id: workspace, verification_id: verification.id,
    document_id: document, kind: 'PASSPORT', title: 'Passport scan', uploaded_by_id: actor,
  });
  const evidence = await insert('borrower_verification_evidence', evidenceData());
  await reject('UPDATE borrower_verification_evidence SET document_id=$1 WHERE id=$2', [otherDocument, evidence.id]);
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), document_id: otherDocument }, '23503');
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), document_id: null });
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), item_id: siblingItem.id }, '23503');
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), run_id: run.id });
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), item_id: item.id, run_id: siblingRun.id }, '23503');
  await rejectInsert('borrower_verification_evidence', { ...evidenceData(), ocr_status: 'SUCCEEDED' });
  await reject('UPDATE borrower_check_runs SET status=\'SUCCEEDED\', finished_at=CURRENT_TIMESTAMP WHERE id=$1', [run.id]);
  await q("UPDATE borrower_check_runs SET status='SUCCEEDED',result_boolean=true,finished_at=CURRENT_TIMESTAMP,risk_assessment='IDENTIFIED' WHERE id=$1", [run.id]);
  await reject('UPDATE borrower_check_runs SET result_boolean=false WHERE id=$1', [run.id]);
  await reject('UPDATE borrower_check_runs SET status=\'QUEUED\',finished_at=NULL WHERE id=$1', [run.id]);
  await rejectInsert('borrower_check_findings', { ...finding, id: id(), record_key: 'late-finding' });
  await reject('UPDATE borrower_check_findings SET title=$1 WHERE id=$2', ['Changed raw fact', finding.id]);
  await q("UPDATE borrower_check_findings SET identity_match='CONFIRMED',match_reviewed_by_id=$1,match_reviewed_at=CURRENT_TIMESTAMP WHERE id=$2", [actor, finding.id]);
  await reject('UPDATE borrower_verification_items SET accepted_run_id=$1 WHERE id=$2', [run.id, siblingItem.id]);
  await q("UPDATE borrower_verification_items SET accepted_run_id=$1,status='COMPLETED' WHERE id=$2", [run.id, item.id]);
  const riskData = () => ({
    id: id(), workspace_id: workspace, verification_id: verification.id, item_id: item.id,
    run_id: run.id, finding_id: finding.id, risk_code: 'FIXTURE', rule_version: 'v1',
    title: 'Review required', description: 'Fixture explanation', severity: 'MEDIUM', updated_at: new Date(),
  });
  const risk = await insert('borrower_verification_risks', riskData());
  await rejectInsert('borrower_verification_risks', riskData(), '23505');
  const summaryRisk = await insert('borrower_verification_risks', { ...riskData(), risk_code: 'SUMMARY', finding_id: null });
  await rejectInsert('borrower_verification_risks', { ...riskData(), risk_code: 'SUMMARY', finding_id: null }, '23505');
  await q("UPDATE borrower_verification_risks SET status='DISMISSED',resolution_comment='Not applicable',resolved_by_id=$1,resolved_at=CURRENT_TIMESTAMP WHERE id=$2", [actor, summaryRisk.id]);
  await rejectInsert('borrower_verification_risks', { ...riskData(), risk_code: 'CROSS', run_id: siblingRun.id }, '23503');
  await reject('UPDATE borrower_verification_risks SET status=\'RESOLVED\' WHERE id=$1', [risk.id]);
  const siblingEvidence = await insert('borrower_verification_evidence', { ...evidenceData(), verification_id: sibling.id });
  await reject('UPDATE borrower_verification_risks SET status=\'RESOLVED\',resolution_comment=\'done\',resolved_by_id=$1,resolved_at=CURRENT_TIMESTAMP,resolution_evidence_id=$2 WHERE id=$3', [actor, siblingEvidence.id, risk.id], '23503');
  const complete = `UPDATE borrower_verifications SET status='COMPLETED',decision='APPROVED',overall_risk='NOT_IDENTIFIED',decided_by_id=$1,decided_at=CURRENT_TIMESTAMP,completed_at=CURRENT_TIMESTAMP WHERE id=$2`;
  await reject(complete, [actor, sibling.id]);
  await reject(complete, [actor, verification.id]);
  await q("UPDATE borrower_verification_risks SET status='RESOLVED',resolution_comment='Document reviewed',resolution_evidence_id=$1,resolved_by_id=$2,resolved_at=CURRENT_TIMESTAMP WHERE id=$3", [evidence.id, actor, risk.id]);
  const newerIdentity = await insert('party_identity_versions', { ...identityData(), version_no: 2, supersedes_id: identity.id });
  await q('UPDATE borrower_verifications SET identity_version_id=$1 WHERE id=$2', [newerIdentity.id, verification.id]);
  assert.equal((await q('SELECT status FROM borrower_verification_items WHERE id=$1', [item.id])).rows[0].status, 'STALE'); checks++;
  await reject(complete, [actor, verification.id]);
  const recheck = await insert('borrower_check_runs', { ...runData(item, 2), identity_version_id: newerIdentity.id });
  await q("UPDATE borrower_check_runs SET status='SUCCEEDED',result_boolean=true,finished_at=CURRENT_TIMESTAMP,risk_assessment='NOT_IDENTIFIED' WHERE id=$1", [recheck.id]);
  await q("UPDATE borrower_verification_items SET accepted_run_id=$1,status='COMPLETED' WHERE id=$2", [recheck.id, item.id]);
  await q(complete, [actor, verification.id]);
  await reject('UPDATE borrower_verifications SET decision_comment=$1 WHERE id=$2', ['Rewrite decision', verification.id]);
  await reject('DELETE FROM borrower_verifications WHERE id=$1', [verification.id]);
  await reject('UPDATE borrower_check_runs SET reviewed_by_id=$1,reviewed_at=CURRENT_TIMESTAMP WHERE id=$2', [actor, recheck.id]);
  await rejectInsert('borrower_verification_evidence', evidenceData());
  await reject('UPDATE borrower_verification_risks SET resolution_comment=$1 WHERE id=$2', ['Rewrite', risk.id]);
  await reject('UPDATE borrower_check_findings SET identity_match=\'REJECTED\' WHERE id=$1', [finding.id]);
  await reject('DELETE FROM borrowers WHERE id=$1', [borrower], '23503');
  await reject('DELETE FROM documents WHERE id=$1', [document], '23503');
  await reject('UPDATE documents SET size_bytes=-1 WHERE id=$1', [document]);
  await q('ROLLBACK');
  // Worker claims must skip a row leased by another transaction. No application DB is used.
  await q('BEGIN');
  const queueIdentity = await insert('party_identity_versions', identityData());
  const queueVerification = await insert('borrower_verifications', { ...verificationData(), identity_version_id: queueIdentity.id });
  const queueItem = await insert('borrower_verification_items', itemData(queueVerification.id));
  const queueRun = await insert('borrower_check_runs', { ...runData(queueItem), identity_version_id: queueIdentity.id, mode: 'AUTOMATIC', performed_by_id: null });
  await q('COMMIT');
  const worker = new pg.Client({ connectionString });
  await worker.connect();
  try {
    await worker.query(`SET search_path TO "${schema}", public`);
    await q('BEGIN');
    await q('SELECT id FROM borrower_check_runs WHERE id=$1 FOR UPDATE', [queueRun.id]);
    const skipped = await worker.query("SELECT id FROM borrower_check_runs WHERE status='QUEUED' AND available_at<=CURRENT_TIMESTAMP ORDER BY available_at,id FOR UPDATE SKIP LOCKED");
    assert.equal(skipped.rowCount, 0); checks++;
    await q('ROLLBACK');
    await worker.query('BEGIN');
    const claimed = await worker.query("SELECT id FROM borrower_check_runs WHERE status='QUEUED' AND available_at<=CURRENT_TIMESTAMP ORDER BY available_at,id FOR UPDATE SKIP LOCKED");
    assert.equal(claimed.rows[0].id, queueRun.id); checks++;
    await worker.query("UPDATE borrower_check_runs SET status='RUNNING',started_at=CURRENT_TIMESTAMP,lease_owner='worker-1',lease_expires_at=CURRENT_TIMESTAMP + interval '1 minute',heartbeat_at=CURRENT_TIMESTAMP WHERE id=$1", [queueRun.id]);
    await worker.query('COMMIT');
    await q('BEGIN');
    await reject("UPDATE borrower_check_runs SET status='SUCCEEDED',result_boolean=false,finished_at=CURRENT_TIMESTAMP WHERE id=$1", [queueRun.id]);
    await q("UPDATE borrower_check_runs SET status='SUCCEEDED',result_boolean=false,finished_at=CURRENT_TIMESTAMP,lease_owner=NULL,lease_expires_at=NULL WHERE id=$1", [queueRun.id]);
    await q('COMMIT');
  } finally {
    await worker.query('ROLLBACK').catch(() => {});
    await worker.end();
  }
  console.log(`Borrower verification migration: ${checks} checks passed; populated upgrade and legacy data preservation verified`);
} finally {
  await q('ROLLBACK').catch(() => {});
  await q(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}

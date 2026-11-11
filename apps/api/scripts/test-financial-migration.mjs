import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';

// Integration test owns only its random schema in a dedicated local test database.
// Never falls back to DATABASE_URL or loads .env.
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, 'Set TEST_DATABASE_URL to a disposable local zaloghub_migration_test database');
const target = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Only a local test database is allowed');
assert.equal(target.pathname, '/zaloghub_migration_test', 'Refusing to run against a non-test database');
const schema = `financial_test_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString });
let checks = 0;
const hash = 'a'.repeat(64);
const id = () => randomUUID();
const q = (sql, args = []) => client.query(sql, args);
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
async function check(sql, expected) {
  const result = await q(sql);
  assert.equal(result.rows[0].value, expected);
  checks++;
}

await client.connect();
try {
  await q(`CREATE SCHEMA "${schema}"`);
  await q(`SET search_path TO "${schema}", public`);
  const migrations = (await readdir(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
  const foundation = '20261105000000_financial_foundation';
  assert.ok(migrations.includes(foundation), 'Financial foundation migration is required');
  for (const migration of migrations.filter(name => name < foundation)) {
    await q(await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
  }
  const userA = id(), userB = id(), borrowerA = id(), borrowerB = id(), collateralA = id(), dealA = id(), dealB = id();
  const user = userId => ({ id: userId, email: `${userId}@example.test`, passwordHash: 'fixture', updatedAt: new Date() });
  await insert('users', user(userA)); await insert('users', user(userB));
  await insert('borrowers', { id: borrowerA, userId: userA, firstName: 'Test', lastName: 'A', updatedAt: new Date() });
  await insert('borrowers', { id: borrowerB, userId: userB, firstName: 'Test', lastName: 'B', updatedAt: new Date() });
  await insert('collaterals', { id: collateralA, userId: userA, type: 'PROPERTY', address: 'Fixture', updatedAt: new Date() });
  const deal = (dealId, userId, borrowerId) => ({ id: dealId, userId, borrowerId, principalAmount: '1000000.00', preferentialRate: '4', standardRate: '7', moratoriumMonths: 6, termMonths: 36, penaltyRate: '0.5', increasedPenaltyRate: '1.5', paymentDay: 25, updatedAt: new Date() });
  await insert('deals', { ...deal(dealA, userA, borrowerA), collateralId: collateralA });
  await insert('deals', deal(dealB, userB, borrowerB));
  await insert('payments', { id: id(), dealId: dealA, amount: '12345.67', type: 'INTEREST', paidAt: new Date() });
  await insert('disbursements', { id: id(), dealId: dealA, amount: '1000000.00', issuedAt: new Date() });

  // Apply the actual checked-in SQL to a populated legacy schema.
  await q(await readFile(new URL(`../prisma/migrations/${foundation}/migration.sql`, import.meta.url), 'utf8'));
  for (const migration of migrations.filter(name => name > foundation)) {
    await q(await readFile(new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url), 'utf8'));
  }
  await q('BEGIN');
  const wsA = (await q('SELECT id FROM workspaces WHERE personal_owner_id=$1', [userA])).rows[0].id;
  const wsB = (await q('SELECT id FROM workspaces WHERE personal_owner_id=$1', [userB])).rows[0].id;
  await check('SELECT count(*)::int AS value FROM workspaces', 2);
  await check("SELECT count(*)::int AS value FROM workspace_members WHERE role='OWNER'", 2);
  await check('SELECT count(*)::int AS value FROM contracts', 0);
  await check('SELECT count(*)::int AS value FROM financial_events', 0);
  await check('SELECT sum(amount)::text AS value FROM payments', '12345.67');
  await check('SELECT sum(amount)::text AS value FROM disbursements', '1000000.00');
  await check('SELECT count(*)::int AS value FROM deals WHERE "workspaceId" IS NOT NULL', 2);
  await check('SELECT count(*)::int AS value FROM borrowers WHERE "workspaceId" IS NOT NULL', 2);
  await check('SELECT count(*)::int AS value FROM collaterals WHERE "workspaceId" IS NOT NULL', 1);
  const userC = id(); await insert('users', user(userC));
  await check('SELECT count(*)::int AS value FROM workspaces', 3);
  await insert('deals', deal(id(), userA, borrowerA)); // Existing API shape still works.
  await reject('UPDATE deals SET "borrowerId"=$1 WHERE id=$2', [borrowerB, dealA]);
  await reject('UPDATE deals SET "workspaceId"=$1 WHERE id=$2', [wsB, dealA]);

  const contractA = id(), contractB = id(), loanA = id(), loanB = id(), partyB = id();
  await insert('contracts', { id: contractA, workspace_id: wsA, deal_id: dealA, number: '1', kind: 'LOAN' });
  await insert('contracts', { id: contractB, workspace_id: wsB, deal_id: dealB, number: '2', kind: 'LOAN' });
  await insert('parties', { id: partyB, workspace_id: wsB, kind: 'PERSON', display_name: 'B' });
  await reject('INSERT INTO contracts(id,workspace_id,deal_id,number,kind) VALUES($1,$2,$3,\'bad\',\'LOAN\')', [id(), wsB, dealA], '23503');
  await reject('INSERT INTO contract_parties(id,workspace_id,contract_id,party_id,role) VALUES($1,$2,$3,$4,\'BORROWER\')', [id(), wsA, contractA, partyB], '23503');
  await insert('loan_accounts', { id: loanA, workspace_id: wsA, contract_id: contractA, currency: 'RUB' });
  await insert('loan_accounts', { id: loanB, workspace_id: wsB, contract_id: contractB, currency: 'RUB' });
  await reject('UPDATE loan_accounts SET currency=\'USD\' WHERE id=$1', [loanA]);
  await reject('UPDATE contracts SET kind=\'PLEDGE\' WHERE id=$1', [contractA]);

  const calendar = id(), termsA = id(), termsB = id(), ruleA = id(), ruleB = id();
  await insert('calendar_versions', { id: calendar, calendar_code: 'RU', version: 'test-v1', timezone: 'Europe/Moscow', content_hash: hash });
  await insert('calendar_days', { id: id(), calendar_version_id: calendar, day: '2026-11-05', is_working: true });
  await q('UPDATE calendar_versions SET status=\'PUBLISHED\' WHERE id=$1', [calendar]);
  await reject('UPDATE calendar_days SET is_working=false WHERE calendar_version_id=$1', [calendar]);
  await reject('DELETE FROM calendar_versions WHERE id=$1', [calendar]);
  for (const [terms, loan, workspace, rule] of [[termsA, loanA, wsA, ruleA], [termsB, loanB, wsB, ruleB]]) {
    await insert('terms_versions', { id: terms, workspace_id: workspace, loan_account_id: loan, version_no: 1, effective_on: '2026-01-01', schema_version: '1', contract_amount: '1000000', calendar_version_id: calendar, content_hash: hash });
    await insert('term_rules', { id: rule, terms_version_id: terms, loan_account_id: loan, rule_key: 'allocation', kind: 'ALLOCATION', priority: 1, source_clause: 'Fixture clause' });
    await q('UPDATE terms_versions SET status=\'PUBLISHED\' WHERE id=$1', [terms]);
  }
  await reject('UPDATE terms_versions SET contract_amount=2 WHERE id=$1', [termsA]);
  await reject('DELETE FROM term_rules WHERE id=$1', [ruleA]);
  await reject('INSERT INTO term_rules(id,terms_version_id,loan_account_id,rule_key,kind,priority,source_clause) VALUES($1,$2,$3,\'late\',\'INTEREST\',1,\'clause\')', [id(), termsA, loanA]);

  const receiptA = id(), receiptB = id();
  const event = (eventId, loan, workspace, sequence, kind = 'RECEIPT', amount = '100') => ({ id: eventId, loan_account_id: loan, workspace_id: workspace, kind, effective_on: '2026-11-01', sequence_no: sequence, amount, source_system: 'TEST', source_ref: eventId, source_revision: '1', idempotency_key: eventId });
  await insert('financial_events', event(receiptA, loanA, wsA, 1));
  await insert('financial_events', event(receiptB, loanB, wsB, 1));
  await reject('UPDATE financial_events SET amount=99 WHERE id=$1', [receiptA]);
  await reject('DELETE FROM financial_events WHERE id=$1', [receiptA]);
  await reject('INSERT INTO financial_events SELECT $1,loan_account_id,kind,effective_on,recorded_at,2,amount,counterparty_id,source_system,source_ref,source_revision,idempotency_key,NULL,payload,workspace_id FROM financial_events WHERE id=$2', [id(), receiptA], '23505');
  await reject('INSERT INTO financial_events SELECT $1,loan_account_id,\'REVERSAL\',effective_on,recorded_at,2,99,counterparty_id,source_system,source_ref,source_revision,$1,id,payload,workspace_id FROM financial_events WHERE id=$2', [id(), receiptA]);

  const runA = id(), runB = id(), obligationA = id(), obligationB = id();
  const run = (runId, loan) => ({ id: runId, loan_account_id: loan, as_of_on: '2026-11-05', knowledge_cutoff: '2099-01-01', engine_version: 'fixture', input_hash: hash });
  await insert('calculation_runs', run(runA, loanA)); await insert('calculation_runs', run(runB, loanB));
  for (const [runId, loan, terms, receipt] of [[runA, loanA, termsA, receiptA], [runB, loanB, termsB, receiptB]]) {
    for (const [kind, ref] of [['EVENT', receipt], ['TERMS_VERSION', terms], ['CALENDAR_VERSION', calendar]]) {
      await insert('calculation_inputs', { id: id(), run_id: runId, loan_account_id: loan, input_kind: kind, input_ref: ref, content_hash: hash });
    }
  }
  await reject('UPDATE calculation_runs SET engine_version=\'changed\' WHERE id=$1', [runA]);
  await reject('INSERT INTO calculation_inputs(id,run_id,loan_account_id,input_kind,input_ref,content_hash) VALUES($1,$2,$3,\'EVENT\',$4,$5)', [id(), runA, loanA, receiptB, hash]);
  const obligation = (oid, runId, loan, terms) => ({ id: oid, run_id: runId, loan_account_id: loan, terms_version_id: terms, obligation_key: 'interest-1', component: 'INTEREST', due_on: '2026-11-05', amount: '150', unpaid_amount: '150' });
  await insert('obligations', obligation(obligationA, runA, loanA, termsA));
  await insert('obligations', obligation(obligationB, runB, loanB, termsB));
  await reject('INSERT INTO obligations(id,run_id,loan_account_id,terms_version_id,obligation_key,component,due_on,amount,unpaid_amount) VALUES($1,$2,$3,$4,\'bad\',\'INTEREST\',\'2026-11-05\',1,1)', [id(), runA, loanA, termsB], '23503');
  const allocation = id();
  await insert('payment_allocations', { id: allocation, run_id: runA, event_id: receiptA, obligation_id: obligationA, amount: '60', order_no: 1, rule_id: ruleA, loan_account_id: loanA, terms_version_id: termsA });
  await reject('INSERT INTO payment_allocations(id,run_id,event_id,obligation_id,amount,order_no,rule_id,loan_account_id,terms_version_id) VALUES($1,$2,$3,$4,50,2,$5,$6,$7)', [id(), runA, receiptA, obligationA, ruleA, loanA, termsA]);
  await reject('INSERT INTO payment_allocations(id,run_id,event_id,obligation_id,amount,order_no,rule_id,loan_account_id,terms_version_id) VALUES($1,$2,$3,$4,10,2,$5,$6,$7)', [id(), runA, receiptA, obligationB, ruleA, loanA, termsA], '23503');
  await reject('UPDATE calculation_runs SET status=\'SUCCEEDED\' WHERE id=$1', [runA]);
  await insert('loan_snapshots', { id: id(), run_id: runA, loan_account_id: loanA, principal_outstanding: '1000000', interest_unpaid: '90', penalty_unpaid: 0, expenses_unpaid: 0, unapplied_credit: 0, due_total: '90', overdue_total: 0, days_past_due: 0 });
  await reject('UPDATE calculation_runs SET status=\'SUCCEEDED\' WHERE id=$1', [runA]);
  await q('UPDATE obligations SET unpaid_amount=90 WHERE id=$1', [obligationA]);
  await q('UPDATE calculation_runs SET status=\'SUCCEEDED\' WHERE id=$1', [runA]);
  await reject('UPDATE loan_snapshots SET interest_unpaid=0 WHERE run_id=$1', [runA]);
  await reject('UPDATE payment_allocations SET amount=1 WHERE id=$1', [allocation]);
  await reject('DELETE FROM calculation_runs WHERE id=$1', [runA]);
  await reject('UPDATE calculation_runs SET status=\'RUNNING\' WHERE id=$1', [runA]);
  const reversal = id();
  await insert('financial_events', { ...event(reversal, loanA, wsA, 2, 'REVERSAL'), reverses_event_id: receiptA });
  await reject('INSERT INTO financial_events SELECT $1,loan_account_id,kind,effective_on,recorded_at,3,amount,counterparty_id,source_system,source_ref,source_revision,$1,reverses_event_id,payload,workspace_id FROM financial_events WHERE id=$2', [id(), reversal], '23505');
  await q('ROLLBACK');
  console.log(`PASS: ${checks} migration/data-integrity checks; populated legacy upgrade and old API insert shape verified.`);
} finally {
  await q('ROLLBACK');
  await q('SET search_path TO public');
  // schema is generated above, never supplied by the caller.
  assert.match(schema, /^financial_test_[a-f0-9]{32}$/);
  await q(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}

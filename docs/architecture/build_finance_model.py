"""Generate the editable logical model. Standard library only; no DB mutations."""
from pathlib import Path
import html
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
# name | domain | fields: name type [optional]
SCHEMA = '''
workspaces|platform|name varchar
users|platform|email varchar
workspace_members|platform|workspace_id uuid;user_id uuid;role varchar
parties|platform|workspace_id uuid;kind varchar;display_name varchar;tax_id varchar ?
deals|platform|workspace_id uuid;title varchar;status varchar
contracts|platform|workspace_id uuid;deal_id uuid;number varchar;kind varchar;signed_on date ?;status varchar
contract_parties|platform|contract_id uuid;party_id uuid;role varchar
documents|platform|workspace_id uuid;storage_key varchar;sha256 varchar;mime_type varchar
contract_documents|platform|contract_id uuid;document_id uuid;role varchar
collaterals|platform|workspace_id uuid;kind varchar;cadastral_number varchar ?;address varchar ?
contract_collaterals|platform|contract_id uuid;collateral_id uuid;secured_amount decimal(20,2) ?;currency char(3);priority int
bank_connections|banking|workspace_id uuid;bank_code varchar;credential_ref varchar;status varchar
bank_accounts|banking|workspace_id uuid;connection_id uuid;owner_party_id uuid;external_id varchar;currency char(3)
bank_sync_runs|banking|connection_id uuid;account_id uuid;requested_from timestamptz;requested_to timestamptz;complete_through timestamptz ?;cursor varchar ?;status varchar;started_at timestamptz;finished_at timestamptz ?
bank_transactions|banking|account_id uuid;external_id varchar;first_seen_at timestamptz
bank_transaction_revisions|banking|transaction_id uuid;revision_no int;sync_run_id uuid;status varchar;observed_at timestamptz;direction varchar;amount decimal(20,2);currency char(3);booked_at timestamptz;value_on date ?;purpose text ?;counterparty_data jsonb;raw_payload jsonb;payload_hash varchar
transaction_matches|banking|transaction_revision_id uuid;contract_id uuid;amount decimal(20,2);status varchar;method varchar;confirmed_by uuid ?;confirmed_at timestamptz ?;supersedes_id uuid ?
loan_accounts|finance|workspace_id uuid;source_contract_id uuid;currency char(3);status varchar
calendar_versions|finance|calendar_code varchar;version varchar;timezone varchar;content_hash varchar
calendar_days|finance|calendar_version_id uuid;day date;is_working boolean
terms_versions|finance|loan_account_id uuid;version_no int;effective_on date;recorded_at timestamptz;schema_version varchar;contract_amount decimal(20,2);maturity_on date ?;calendar_version_id uuid;day_count_policy jsonb;rounding_policy jsonb;source_document_ref uuid ?;source_clause text ?;status varchar;content_hash varchar
term_rules|finance|terms_version_id uuid;rule_key varchar;kind varchar;priority int;definition jsonb;source_clause text
financial_events|finance|loan_account_id uuid;kind varchar;effective_on date;recorded_at timestamptz;sequence_no bigint;amount decimal(20,2) ?;counterparty_ref uuid ?;source_system varchar;source_ref varchar;source_revision varchar;idempotency_key varchar;reverses_event_id uuid ?;payload jsonb
calculation_runs|finance|loan_account_id uuid;as_of_on date;knowledge_cutoff timestamptz;engine_version varchar;input_hash varchar;status varchar;created_at timestamptz;supersedes_run_id uuid ?
calculation_inputs|finance|run_id uuid;input_kind varchar;input_ref uuid;content_hash varchar
obligations|finance|run_id uuid;obligation_key varchar;component varchar;period_from date ?;period_to date ?;due_on date;amount decimal(20,2);unpaid_amount decimal(20,2);terms_version_id uuid
accrual_lines|finance|run_id uuid;obligation_id uuid ?;rule_id uuid;period_from date;period_to date;base_amount decimal(20,2);rate decimal(18,10);rate_unit varchar;day_count int;unrounded_amount decimal(30,12);rounded_amount decimal(20,2);explanation jsonb
payment_allocations|finance|run_id uuid;event_id uuid;obligation_id uuid;amount decimal(20,2);order_no int;rule_id uuid
loan_snapshots|finance|run_id uuid;principal_outstanding decimal(20,2);interest_unpaid decimal(20,2);penalty_unpaid decimal(20,2);expenses_unpaid decimal(20,2);unapplied_credit decimal(20,2);due_total decimal(20,2);overdue_total decimal(20,2);days_past_due int;next_payment_on date ?;next_payment_amount decimal(20,2) ?;payoff_amount decimal(20,2) ?;diagnostics jsonb
audit_entries|platform|workspace_id uuid;actor_id uuid ?;action varchar;entity_type varchar;entity_id uuid;recorded_at timestamptz;details jsonb
outbox_messages|banking|workspace_id uuid;aggregate_id uuid;event_type varchar;payload jsonb;created_at timestamptz;published_at timestamptz ?;idempotency_key varchar
'''

TABLES = {}
for line in SCHEMA.strip().splitlines():
    name, domain, fields = line.split('|')
    TABLES[name] = (domain, [('id', 'uuid', False)] + [
        (f.strip().split(' ')[0], f.strip().split(' ')[1], f.strip().endswith(' ?'))
        for f in fields.split(';')])

# Child FK -> parent PK. Cross-service identities are intentionally not physical FKs.
REL = '''
workspace_members.workspace_id workspaces
workspace_members.user_id users
parties.workspace_id workspaces
deals.workspace_id workspaces
contracts.workspace_id workspaces
contracts.deal_id deals
contract_parties.contract_id contracts
contract_parties.party_id parties
documents.workspace_id workspaces
contract_documents.contract_id contracts
contract_documents.document_id documents
collaterals.workspace_id workspaces
contract_collaterals.contract_id contracts
contract_collaterals.collateral_id collaterals
bank_connections.workspace_id workspaces
bank_accounts.workspace_id workspaces
bank_accounts.connection_id bank_connections
bank_accounts.owner_party_id parties
bank_sync_runs.connection_id bank_connections
bank_sync_runs.account_id bank_accounts
bank_transactions.account_id bank_accounts
bank_transaction_revisions.transaction_id bank_transactions
bank_transaction_revisions.sync_run_id bank_sync_runs
transaction_matches.transaction_revision_id bank_transaction_revisions
transaction_matches.contract_id contracts
transaction_matches.confirmed_by users
transaction_matches.supersedes_id transaction_matches
calendar_days.calendar_version_id calendar_versions
terms_versions.loan_account_id loan_accounts
terms_versions.calendar_version_id calendar_versions
term_rules.terms_version_id terms_versions
financial_events.loan_account_id loan_accounts
financial_events.reverses_event_id financial_events
calculation_runs.loan_account_id loan_accounts
calculation_runs.supersedes_run_id calculation_runs
calculation_inputs.run_id calculation_runs
obligations.run_id calculation_runs
obligations.terms_version_id terms_versions
accrual_lines.run_id calculation_runs
accrual_lines.obligation_id obligations
accrual_lines.rule_id term_rules
payment_allocations.run_id calculation_runs
payment_allocations.event_id financial_events
payment_allocations.obligation_id obligations
payment_allocations.rule_id term_rules
loan_snapshots.run_id calculation_runs
audit_entries.workspace_id workspaces
audit_entries.actor_id users
outbox_messages.workspace_id workspaces
'''
RELATIONS = [(a.split('.')[0], a.split('.')[1], b) for a, b in
             (line.split() for line in REL.strip().splitlines())]
LOGICAL = [('loan_accounts', 'source_contract_id', 'contracts'),
           ('terms_versions', 'source_document_ref', 'documents'),
           ('financial_events', 'source_ref', 'transaction_matches')]
INDEXES = {
    'users': ['email [unique]'],
    'workspace_members': ['(workspace_id, user_id) [unique]'],
    'contract_parties': ['(contract_id, party_id, role) [unique]'],
    'contract_documents': ['(contract_id, document_id, role) [unique]'],
    'contract_collaterals': ['(contract_id, collateral_id) [unique]'],
    'bank_accounts': ['(connection_id, external_id) [unique]'],
    'bank_transactions': ['(account_id, external_id) [unique]'],
    'bank_transaction_revisions': ['(transaction_id, revision_no) [unique]'],
    'calendar_versions': ['(calendar_code, version) [unique]'],
    'calendar_days': ['(calendar_version_id, day) [unique]'],
    'loan_accounts': ['(workspace_id, source_contract_id) [unique]'],
    'terms_versions': ['(loan_account_id, version_no) [unique]'],
    'term_rules': ['(terms_version_id, rule_key) [unique]'],
    'financial_events': ['(loan_account_id, idempotency_key) [unique]', '(loan_account_id, effective_on, sequence_no)', '(loan_account_id, sequence_no) [unique]'],
    'calculation_inputs': ['(run_id, input_kind, input_ref) [unique]'],
    'obligations': ['(run_id, obligation_key) [unique]'],
    'loan_snapshots': ['run_id [unique]'],
    'outbox_messages': ['(workspace_id, idempotency_key) [unique]'],
}
NOTES = {
    'terms_versions': 'Full immutable ruleset snapshot. Drafts may change; published versions are immutable. Contract amount is a limit/term, not proof of disbursement.',
    'term_rules': 'Typed validated rules, never executable arbitrary code. Kinds: interest, schedule, penalty, allocation, prepayment, rate_transition.',
    'financial_events': 'Immutable accepted facts. Disbursement, receipt, reversal, expense, waiver, notice, settlement. Money is in loan account currency. source_ref is external identity, not FK.',
    'calculation_inputs': 'Polymorphic immutable manifest: event, terms_version, calendar_version. References validated by service; input_ref is not a SQL FK.',
    'loan_snapshots': 'Derived state for one successful run. due_total includes overdue_total; never add these two amounts. Future principal is not automatically due.',
    'transaction_matches': 'Bank allocation to contract, not allocation to principal/interest/penalty. Only confirmed matches generate finance events.',
    'bank_transaction_revisions': 'Append-only observations; status changes and corrections do not overwrite previous evidence. Raw payload contains sensitive bank data.',
    'loan_accounts': 'Finance-owned identity. source_contract_id and workspace_id are external references when finance uses a separate database.',
    'payment_allocations': 'Derived per calculation run. event must be an accepted receipt/credit; all linked records must belong to the same run and loan.',
}

def dbml():
    parts = ['// Logical draft v0.1. See finance-data-model.md for required invariants.',
             '// Solid refs are candidate FKs within a shared store; service boundary refs are comments.',
             'Project ZalogHubFinance {\n  database_type: "PostgreSQL"\n}\n']
    for name, (domain, fields) in TABLES.items():
        parts.append(f'// Owner: {domain}\nTable {name} {{')
        for field, dtype, optional in fields:
            flags = 'pk' if field == 'id' else ('null' if optional else 'not null')
            parts.append(f'  {field} {dtype} [{flags}]')
        if name in INDEXES:
            parts.append('  indexes {\n    ' + '\n    '.join(INDEXES[name]) + '\n  }')
        if name in NOTES:
            parts.append("  Note: '" + NOTES[name].replace("'", "\\'") + "'")
        parts.append('}\n')
    for child, field, parent in RELATIONS:
        op = '-' if (child, field) == ('loan_snapshots', 'run_id') else '>'
        parts.append(f'Ref: {child}.{field} {op} {parent}.id')
    for child, field, parent in LOGICAL:
        parts.append(f'// External identity: {child}.{field} -> {parent}.id (no cross-service FK)')
    for domain in ('platform', 'banking', 'finance'):
        parts.append(f'\nTableGroup {domain} {{\n' + '\n'.join('  '+n for n, (d, _) in TABLES.items() if d == domain) + '\n}')
    return '\n'.join(parts) + '\n'

COLORS = {'platform': '#dae8fc', 'banking': '#d5e8d4', 'finance': '#fff2cc'}

def vertex(root, ident, value, x, y, width, height, style):
    cell = ET.SubElement(root, 'mxCell', id=ident, value=value, style=style, vertex='1', parent='1')
    ET.SubElement(cell, 'mxGeometry', x=str(x), y=str(y), width=str(width), height=str(height), **{'as': 'geometry'})

def drawio():
    doc = ET.Element('mxfile', host='app.diagrams.net', version='24.7.17')
    pages = [
        ('01 Обзор', ['workspaces', 'deals', 'contracts', 'bank_connections', 'bank_accounts', 'bank_transactions', 'transaction_matches', 'loan_accounts', 'terms_versions', 'financial_events', 'calculation_runs', 'loan_snapshots']),
        ('02 Сделки и документы', ['workspaces', 'users', 'workspace_members', 'parties', 'deals', 'contracts', 'contract_parties', 'documents', 'contract_documents', 'collaterals', 'contract_collaterals', 'audit_entries']),
        ('03 Банки и сверка', ['workspaces', 'parties', 'contracts', 'bank_connections', 'bank_accounts', 'bank_sync_runs', 'bank_transactions', 'bank_transaction_revisions', 'transaction_matches', 'outbox_messages', 'financial_events']),
        ('04 Условия и события', ['contracts', 'documents', 'loan_accounts', 'calendar_versions', 'calendar_days', 'terms_versions', 'term_rules', 'financial_events']),
        ('05 Расчёт и результат', ['loan_accounts', 'terms_versions', 'term_rules', 'financial_events', 'calculation_runs', 'calculation_inputs', 'obligations', 'accrual_lines', 'payment_allocations', 'loan_snapshots']),
    ]
    for number, (title, names) in enumerate(pages):
        diagram = ET.SubElement(doc, 'diagram', id=f'page-{number}', name=title)
        model = ET.SubElement(diagram, 'mxGraphModel', dx='1800', dy='1500', grid='1', gridSize='10', page='0', pageWidth='2400', pageHeight='2200', arrows='1')
        root = ET.SubElement(model, 'root')
        ET.SubElement(root, 'mxCell', id='0')
        ET.SubElement(root, 'mxCell', id='1', parent='0')
        vertex(root, 'title', html.escape(title+' — ZalogHub / логическая модель v0.1'), 30, 20, 1700, 50, 'text;html=1;fontSize=26;align=left;')
        legend = 'Синий: платформа · Зелёный: банки · Жёлтый: расчёты<br>Стрелка: дочерняя таблица → родитель (N:1); snapshots → runs: 0..1:1. Пунктир: внешний ID, без FK.<br>PK — первичный ключ; FK — ссылка; ? — допускает NULL. Это проект модели, не миграция. Детальные правила — в finance-data-model.md.'
        vertex(root, 'legend', legend, 30, 80, 1770, 85, 'text;html=1;fontSize=14;align=left;whiteSpace=wrap;')
        for i, name in enumerate(names):
            domain, fields = TABLES[name]
            selected = fields if number else fields[:5]
            fks = {f for c, f, _ in RELATIONS if c == name}
            rows = []
            for field, dtype, optional in selected:
                tag = 'PK ' if field == 'id' else ('FK ' if field in fks else '')
                rows.append(html.escape(f'{tag}{field}{" ?" if optional else ""} : {dtype}'))
            if number == 0:
                rows.append('… детали на следующих вкладках')
            value = '<b>'+name+'</b><hr>'+'<br>'.join(rows)
            height = 55 + len(rows)*21
            # Generous row spacing prevents overlap even for the largest entities.
            vertex(root, name, value, 40+(i%3)*620, 210+(i//3)*600, 450, height,
                   f'rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=12;fontSize=14;fillColor={COLORS[domain]};strokeColor=#666666;')
        for j, (child, field, parent) in enumerate(RELATIONS+LOGICAL):
            if child not in names or parent not in names:
                continue
            logical = (child, field, parent) in LOGICAL
            label = ('внешний ID: ' if logical else '')+field
            style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=open;labelBackgroundColor=#ffffff;fontSize=11;'
            if logical:
                style += 'dashed=1;strokeColor=#a64d79;'
            cell = ET.SubElement(root, 'mxCell', id=f'edge-{j}', value=label, style=style, edge='1', parent='1', source=child, target=parent)
            ET.SubElement(cell, 'mxGeometry', relative='1', **{'as': 'geometry'})
    ET.indent(doc)
    return ET.tostring(doc, encoding='unicode', xml_declaration=True)

def validate():
    for child, field, parent in RELATIONS+LOGICAL:
        assert child in TABLES and parent in TABLES
        assert field in {f[0] for f in TABLES[child][1]}, (child, field)
    for name, (_, fields) in TABLES.items():
        assert len(fields) == len({f[0] for f in fields}), name

if __name__ == '__main__':
    validate()
    (ROOT/'finance-data-model.dbml').write_text(dbml(), encoding='utf-8')
    path = ROOT/'finance-data-model.drawio'
    path.write_text(drawio(), encoding='utf-8')
    parsed = ET.parse(path)
    assert len(parsed.findall('diagram')) == 5
    for graph in parsed.findall('diagram/mxGraphModel/root'):
        ids = [c.attrib['id'] for c in graph.findall('mxCell')]
        assert len(ids) == len(set(ids))
        for edge in graph.findall('mxCell[@edge="1"]'):
            assert edge.attrib['source'] in ids and edge.attrib['target'] in ids
    print(f'Validated {len(TABLES)} tables, {len(RELATIONS)} FK candidates, {len(LOGICAL)} external references, 5 diagram pages.')

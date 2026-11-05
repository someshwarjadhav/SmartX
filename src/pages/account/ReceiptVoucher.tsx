import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Landmark, ReceiptText, Save, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { Field, SelectField, TextField } from '../../components/ui/Fields';
import { FormSection } from '../../components/ui/FormSection';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { SearchSelect } from '../../components/operations/ui/SearchSelect';
import { Segmented } from '../../components/ui/Segmented';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { VoucherSummary, HERO_CLASS } from '../../components/account/VoucherSummary';
import { useCentreOptions } from '../../hooks/useCentres';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { useVoucherLookups } from '../../hooks/useVoucherLookups';
import { exportExcel, type ExportTable } from '../../lib/exporters';
import { fmtDate, nf, toISO } from '../../lib/format';
import { cn } from '../../lib/cn';
import { deleteReceiptVoucher, getLedgers, getReceiptVouchers, saveReceiptVoucher } from '../../services/account/receiptVoucher.api';
import { PAYMENT_MODES, isIsoDate, type VoucherRow } from '../../services/account/voucher.common';

const money = (n: number): string => `₹${nf(n, 2)}`;
const dash = (v: string): string => v || '—';
const messageOf = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message : fallback);
const digitsOnly = (v: string, max: number): string => v.replace(/\D/g, '').slice(0, max);

interface Errors {
  farmer?: string;
  ledger?: string;
  amount?: string;
}

const ReceiptVoucher: React.FC = () => {
  const toast = useToast();
  const centres = useCentreOptions();
  const centreOptions = useMemo(() => centres.map((c) => ({ value: c.id, label: c.label })), [centres]);

  const [date, setDate] = useState(() => toISO(new Date()));
  const [mode, setMode] = useState(PAYMENT_MODES[0]?.value ?? 'Bank');
  const [ledger, setLedger] = useState('');
  const [vlc, setVlc] = useState('');
  const [farmer, setFarmer] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<VoucherRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const vlcId = vlc || centreOptions[0]?.value || '';
  const lookups = useVoucherLookups(vlcId, { loadLedgers: getLedgers }, mode);
  const ledgerId = lookups.ledgers.some((l) => l.value === ledger) ? ledger : (lookups.ledgers[0]?.value ?? '');

  const farmerPick = lookups.farmerOptions.find((f) => f.value === farmer);
  const farmerName = farmerPick ? farmerPick.label.split(' | ').slice(1).join(' | ') : '';
  const amountN = parseFloat(amount);

  const loadList = useCallback(async () => {
    if (!vlcId || !date) return;
    setLoading(true);
    try {
      setRows(await getReceiptVouchers(vlcId, date));
    } catch (e) {
      setRows([]);
      toast.show(messageOf(e, 'Could not load receipt vouchers'));
    } finally {
      setLoading(false);
    }
  }, [vlcId, date]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const pager = usePagination(rows, 100);
  const total = useMemo(() => rows.reduce((sum, r) => sum + r.amount, 0), [rows]);

  const pickFarmer = (id: string) => {
    setFarmer(id);
    setAccountNo(lookups.farmerOptions.find((f) => f.value === id)?.account ?? '');
    setErrors((x) => ({ ...x, farmer: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const found: Errors = {};
    if (!ledgerId) found.ledger = 'Choose an account ledger.';
    if (!farmer) found.farmer = 'Select a farmer.';
    if (!Number.isFinite(amountN) || amountN <= 0) found.amount = 'Enter an amount above zero.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const reply = await saveReceiptVoucher({
        vlcid: vlcId,
        farmerId: farmer,
        date,
        amount,
        paymentMode: mode,
        ledgerId,
        farmerCode: farmerPick?.masterCode,
        ledgerType: lookups.ledgers.find((l) => l.value === ledgerId)?.type,
        accountNo,
        narration,
      });
      toast.show(reply && reply.length < 80 ? reply : 'Receipt voucher saved');
      setAmount('');
      setNarration('');
      setFarmer('');
      setAccountNo('');
      await loadList();
    } catch (err) {
      toast.show(messageOf(err, 'Could not save the receipt voucher'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteReceiptVoucher(toDelete.id, vlcId, date);
      toast.show('Receipt voucher deleted');
      setToDelete(null);
      await loadList();
    } catch (err) {
      toast.show(messageOf(err, 'Could not delete the receipt voucher'));
    } finally {
      setDeleting(false);
    }
  };

  const centreLabel = centreOptions.find((c) => c.value === vlcId)?.label ?? '';
  const ledgerLabel = lookups.ledgers.find((l) => l.value === ledgerId)?.label ?? '';
  const showDate = (s: string): string => (s ? (isIsoDate(s) ? fmtDate(s) : s) : '—');

  const columns: Column<VoucherRow>[] = [
    { key: 'id', header: 'Receipt No', cell: (r) => <span className="tnum font-semibold">{dash(r.id)}</span>, mobile: 'title' },
    { key: 'date', header: 'Date', cell: (r) => <span className="tnum">{showDate(r.date)}</span> },
    { key: 'farmerId', header: 'Farmer Id', cell: (r) => <span className="tnum">{dash(r.farmerId)}</span> },
    { key: 'name', header: 'Name', cell: (r) => dash(r.farmerName || r.name) },
    { key: 'amount', header: 'Amount', align: 'right', cell: (r) => <span className="tnum font-semibold">{money(r.amount)}</span> },
    {
      key: 'action',
      header: 'Action',
      align: 'center',
      mobile: 'action',
      cell: (r) => <div className="flex justify-center"><IconButton icon={Trash2} tone="danger" className="!bg-danger/10 !text-danger hover:!bg-danger/20" label={`Delete receipt ${r.id}`} disabled={!r.id} onClick={() => setToDelete(r)} /></div>,
    },
  ];

  const buildTable = (): ExportTable => ({
    filename: `receipt-voucher-${date}`,
    title: 'Receipt voucher',
    subtitle: `${centreLabel} · ${date}`,
    columns: [{ header: 'Receipt No' }, { header: 'Date' }, { header: 'Farmer Id' }, { header: 'Name' }, { header: 'Amount', type: 'money' }],
    rows: rows.map((r) => [r.id, r.date, r.farmerId, r.farmerName || r.name, r.amount]),
    totals: ['Total', '', '', '', total],
  });

  const exportAction: ExportAction = {
    id: 'excel',
    label: 'Excel Export',
    icon: FileSpreadsheet,
    variant: 'primary',
    run: async () => {
      try {
        await exportExcel(buildTable());
        toast.show(`Exported ${rows.length} receipts as Excel`);
      } catch {
        toast.show('Export failed. Please try again.');
      }
    },
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Receipt Voucher" subtitle="Record money received from a farmer into a bank or cash ledger." />

      <div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
          <header className={cn('relative flex items-center gap-4 overflow-hidden px-5 py-4 text-white', HERO_CLASS.receipt)}>
            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-glow/30 blur-3xl" aria-hidden />
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
              <ReceiptText size={24} aria-hidden />
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold leading-tight">Receipt Voucher</h2>
              <p className="mt-0.5 truncate text-sm text-white/70">
                {centreLabel || '—'} · {mode}
              </p>
            </div>
            <span className="relative shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Credit</span>
          </header>

          <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6 p-4 sm:p-5">
            <FormSection step={1} title="Voucher" description="Date, centre and how it was received" bodyClassName="grid gap-4 sm:grid-cols-6">
              <TextField wrapperClassName="sm:col-span-2" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <SelectField
                wrapperClassName="sm:col-span-4"
                label="VLC Name"
                value={vlcId}
                onChange={(v) => {
                  setVlc(v);
                  setFarmer('');
                  setAccountNo('');
                }}
                options={centreOptions}
              />
              <Field label="Payment Mode" className="sm:col-span-2">
                <Segmented label="Payment Mode" value={mode} options={PAYMENT_MODES} onChange={setMode} className="w-full [&>button]:flex-1" />
              </Field>
              <SelectField wrapperClassName="sm:col-span-4" label="Account Ledger" value={ledgerId} onChange={setLedger} options={lookups.ledgers} error={errors.ledger} />
            </FormSection>

            <FormSection step={2} title="Farmer" description="Who paid and their bank account" className="border-t border-line pt-6" bodyClassName="grid gap-4 sm:grid-cols-6">
              <Field label="Farmer" className="sm:col-span-6" error={errors.farmer}>
                <SearchSelect
                  aria-label="Farmer"
                  value={farmer}
                  onChange={pickFarmer}
                  options={lookups.farmerOptions}
                  placeholder={lookups.farmerStatus === 'loading' ? 'Loading farmers…' : '-- select farmer --'}
                  searchPlaceholder="Search farmer code or name"
                />
              </Field>
              <TextField wrapperClassName="sm:col-span-6" label="AccountNo" inputMode="numeric" value={accountNo} onChange={(e) => setAccountNo(digitsOnly(e.target.value, 18))} autoComplete="off" />
            </FormSection>

            <FormSection step={3} title="Amount" description="How much was received" className="border-t border-line pt-6" bodyClassName="grid gap-4 sm:grid-cols-6">
              <TextField
                wrapperClassName="sm:col-span-2"
                label="Amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((x) => ({ ...x, amount: undefined }));
                }}
                error={errors.amount}
              />
              <TextField wrapperClassName="sm:col-span-4" label="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} autoComplete="off" />
            </FormSection>

            {lookups.failed && (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 text-ink">Some lists could not be loaded.</span>
                <Button size="sm" variant="outline" onClick={lookups.retry}>
                  Retry
                </Button>
              </div>
            )}

            <div className="border-t border-line pt-5">
              <Button type="submit" size="lg" icon={<Save size={16} aria-hidden />} loading={saving} className="h-11 w-full bg-gradient-to-r from-ok to-brand">
                Submit
              </Button>
            </div>
          </form>
        </section>

        <div className="xl:sticky xl:top-20">
          <VoucherSummary
            tone="receipt"
            icon={Landmark}
            heading="Receipt amount"
            amount={Number.isFinite(amountN) ? amountN : 0}
            farmerId={farmer}
            farmerName={farmerName}
            details={[
              ['Date', date],
              ['Centre', centreLabel],
              ['Mode', mode],
              ['Ledger', ledgerLabel],
              ['Account No', accountNo],
            ]}
            count={rows.length}
            total={total}
          />
        </div>
      </div>

      <Panel bodyClassName="!p-0">
        <TableToolbar
          from={pager.from}
          to={pager.to}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageSize={pager.setPageSize}
          filters={<Badge tone="ok">{date}</Badge>}
          actions={<ExportBar actions={[exportAction]} disabled={rows.length === 0} />}
        />
        {!loading && rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No receipt vouchers" text="Receipts saved for this centre and date will appear here." />
        ) : (
          <DataTable columns={columns} rows={pager.visible} rowKey={(r) => r.key} ariaLabel="Receipt vouchers" minWidth={720} loading={loading && rows.length === 0} />
        )}
        {rows.length > 0 && <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.goTo} onPageSize={pager.setPageSize} showSize={false} />}
      </Panel>

      <ConfirmDialog open={!!toDelete} title="Delete this receipt?" busy={deleting} onConfirm={() => void confirmDelete()} onCancel={() => setToDelete(null)}>
        {toDelete && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-mute">Receipt No</dt>
            <dd className="tnum font-semibold">{dash(toDelete.id)}</dd>
            <dt className="text-mute">Farmer</dt>
            <dd className="font-semibold">{dash([toDelete.farmerId, toDelete.farmerName].filter(Boolean).join(' | '))}</dd>
            <dt className="text-mute">Amount</dt>
            <dd className="tnum font-semibold">{money(toDelete.amount)}</dd>
          </dl>
        )}
      </ConfirmDialog>

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default ReceiptVoucher;

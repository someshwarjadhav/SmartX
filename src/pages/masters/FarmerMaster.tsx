import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Pencil, RefreshCw, Save, Upload, UsersRound, X } from 'lucide-react';
import { farmerKey, nextFarmerCode, type FarmerRecord } from '../../data/farmerMaster';
import { getData, postData, postExcel, updateFarmerStatus } from '../../services/master/farmerMaster.api.ts';
import type { FarmerInput } from '../../services/master/farmerMaster.rules.ts';
import { useMilkCenterOptions } from '../../hooks/useMilkReportData';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { DropZone } from '../../components/ui/DropZone';
import { EmptyState } from '../../components/ui/EmptyState';
import { ReportLoader } from '../../components/ui/ReportLoader';
import { ExportBar, type ExportAction } from '../../components/ui/ExportBar';
import { SelectField, TextField } from '../../components/ui/Fields';
import { FormSection } from '../../components/ui/FormSection';
import { IconButton } from '../../components/ui/IconButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { Panel } from '../../components/ui/Panel';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { TableToolbar } from '../../components/ui/TableToolbar';
import { Toast } from '../../components/ui/Toast';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { downloadFarmerSample, parseFarmerSheet } from '../../lib/farmerImport';
import { exportExcel, type ExportTable } from '../../lib/exporters';
import { nf, toISO } from '../../lib/format';



const FarmerSummary: React.FC<{ rows: FarmerRecord[] }> = ({ rows }) => {
  const total = rows.length;
  const active = rows.filter((r) => r.active).length;
  const inactive = total - active;
  const share = total ? (active / total) * 100 : 0;

  return (
    <section
      aria-label="Farmer summary"
      className="surface-hero relative overflow-hidden rounded-2xl p-5 text-white shadow-card"
    >
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-glow/30 blur-3xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/70">Registered farmers</p>
          <p className="tnum mt-1 font-display text-4xl font-extrabold leading-none">
            <AnimatedNumber value={total} format={(n) => nf(Math.round(n))} />
          </p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/12">
          <UsersRound size={22} aria-hidden />
        </span>
      </div>

      <div className="relative mt-5 flex h-2 overflow-hidden rounded-full bg-white/20" role="img" aria-label={`${active} active of ${total}`}>
        <motion.span initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-ok" />
      </div>

      <dl className="relative mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
          <dt className="text-white/70">Active</dt>
          <dd className="tnum ml-auto font-bold">{nf(active)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/40" aria-hidden />
          <dt className="text-white/70">Inactive</dt>
          <dd className="tnum ml-auto font-bold">{nf(inactive)}</dd>
        </div>
      </dl>
    </section>
  );
};



interface FormProps {
  farmers: FarmerRecord[];
  editing: FarmerRecord | null;
  onSubmit: (record: FarmerRecord, isEdit: boolean) => void;
  onCancel: () => void;
  centreOptions: { value: string; label: string }[];
}

interface Values {
  vlcId: string;
  farmerId: string;
  name: string;
  bankHolder: string;
  address: string;
  mobile: string;
  bankName: string;
  ifsc: string;
  accountNo: string;
  aadhaar: string;
  active: boolean;
}

type Errors = Partial<Record<keyof Values, string>>;

const digitsOnly = (v: string, max: number): string => v.replace(/\D/g, '').slice(0, max);

const fromRecord = (r: FarmerRecord): Values => ({ ...r, farmerId: String(r.farmerId) });

const blank = (farmers: FarmerRecord[], vlcId: string): Values => ({
  vlcId,
  farmerId: String(nextFarmerCode(farmers, vlcId)),
  name: '',
  bankHolder: '',
  address: '',
  mobile: '',
  bankName: '',
  ifsc: '',
  accountNo: '',
  aadhaar: '',
  active: true,
});

function validate(v: Values, farmers: FarmerRecord[], isEdit: boolean): Errors {
  const e: Errors = {};
  const code = Number(v.farmerId);
  if (!Number.isInteger(code) || code < 1) e.farmerId = 'Enter a valid code.';
  else if (!isEdit && farmers.some((f) => f.vlcId === v.vlcId && f.farmerId === code)) e.farmerId = 'This code already exists in the centre.';
  if (!v.name.trim()) e.name = 'Farmer name is required.';
  if (v.mobile && !/^[6-9]\d{9}$/.test(v.mobile)) e.mobile = 'Enter a 10 digit mobile number.';
  if (v.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.ifsc)) e.ifsc = 'Use the 11 character IFSC code.';
  if (v.accountNo && !/^\d{9,18}$/.test(v.accountNo)) e.accountNo = 'Account number is 9 to 18 digits.';
  if (v.aadhaar && !/^\d{12}$/.test(v.aadhaar)) e.aadhaar = 'Aadhaar number is 12 digits.';
  return e;
}

const FarmerForm: React.FC<FormProps> = ({ farmers, editing, onSubmit, onCancel, centreOptions }) => {
  const [values, setValues] = useState<Values>(() => (editing ? fromRecord(editing) : blank(farmers, centreOptions[0]?.value ?? '')));
  const [errors, setErrors] = useState<Errors>({});
  const codeTouched = useRef(false);


  useEffect(() => {
    if (editing || codeTouched.current) return;
    setValues((v) => {
      const vlcId = v.vlcId || centreOptions[0]?.value || '';
      const farmerId = String(nextFarmerCode(farmers, vlcId));
      return vlcId === v.vlcId && farmerId === v.farmerId ? v : { ...v, vlcId, farmerId };
    });
  }, [farmers, centreOptions, editing]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    if (key === 'farmerId') codeTouched.current = true;
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const changeCentre = (vlcId: string) => {
    codeTouched.current = false;
    setValues((v) => ({ ...v, vlcId, farmerId: String(nextFarmerCode(farmers, vlcId)) }));
    setErrors({});
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(values, farmers, Boolean(editing));
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(
      {
        ...values,
        farmerId: Number(values.farmerId),
        name: values.name.trim(),
        bankHolder: values.bankHolder.trim() || values.name.trim(),
        address: values.address.trim(),
        bankName: values.bankName.trim(),
      },
      Boolean(editing),
    );
  };

  const centre = centreOptions.find((c) => c.value === values.vlcId);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      <header
        className="surface-hero relative flex items-center gap-4 overflow-hidden px-5 py-4 text-white"
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-glow/30 blur-3xl" aria-hidden />
        <Avatar name={values.name} size="lg" className="relative ring-2 ring-white/30" />
        <div className="relative min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">{editing ? 'Edit Farmer' : 'Add Farmer'}</h2>
          <p className="mt-0.5 truncate text-sm text-white/70">
            {values.name.trim() || 'New farmer'} · {centre?.label ?? '—'} · Code {values.farmerId || '—'}
          </p>
        </div>
        <span className="relative shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{editing ? 'Editing' : 'New'}</span>
      </header>

      <form onSubmit={submit} noValidate className="space-y-6 p-4 sm:p-5">
        <FormSection step={1} title="Farmer" description="Centre, code and name" bodyClassName="grid gap-4 sm:grid-cols-6">
          <SelectField wrapperClassName="sm:col-span-6" label="Center Name" value={values.vlcId} onChange={changeCentre} options={centreOptions} disabled={Boolean(editing)} />
          <TextField wrapperClassName="sm:col-span-2" label="Farmer Code" type="number" inputMode="numeric" min={1} value={values.farmerId} onChange={(e) => set('farmerId', e.target.value)} error={errors.farmerId} disabled={Boolean(editing)} />
          <TextField wrapperClassName="sm:col-span-4" label="Farmer Name" value={values.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoComplete="off" />
        </FormSection>

        <FormSection step={2} title="Contact and identity" description="Address, phone and Aadhaar" className="border-t border-line pt-6" bodyClassName="grid gap-4 sm:grid-cols-6">
          <TextField wrapperClassName="sm:col-span-4" label="Farmer Address" value={values.address} onChange={(e) => set('address', e.target.value)} autoComplete="off" />
          <TextField wrapperClassName="sm:col-span-2" label="Mobile Number" type="tel" inputMode="numeric" value={values.mobile} onChange={(e) => set('mobile', digitsOnly(e.target.value, 10))} error={errors.mobile} />
          <TextField wrapperClassName="sm:col-span-6" label="Aadhaar No" inputMode="numeric" value={values.aadhaar} onChange={(e) => set('aadhaar', digitsOnly(e.target.value, 12))} error={errors.aadhaar} />
        </FormSection>

        <FormSection step={3} title="Bank details" description="Used for bank payment files" className="border-t border-line pt-6" bodyClassName="grid gap-4 sm:grid-cols-6">
          <TextField wrapperClassName="sm:col-span-6" label="Farmer Name As Per Bank" value={values.bankHolder} onChange={(e) => set('bankHolder', e.target.value)} autoComplete="off" />
          <TextField wrapperClassName="sm:col-span-4" label="Bank Name" value={values.bankName} onChange={(e) => set('bankName', e.target.value)} autoComplete="off" />
          <TextField wrapperClassName="sm:col-span-2" label="Bank IFSC" value={values.ifsc} maxLength={11} onChange={(e) => set('ifsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} error={errors.ifsc} />
          <TextField wrapperClassName="sm:col-span-6" label="Bank Account No" inputMode="numeric" value={values.accountNo} onChange={(e) => set('accountNo', digitsOnly(e.target.value, 18))} error={errors.accountNo} />
        </FormSection>

        <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Switch label="Active" hint={values.active ? 'Farmer can pour milk' : 'Farmer is blocked'} checked={values.active} onChange={(v) => set('active', v)} />
          <div className="flex flex-col gap-3 sm:flex-row">
            {editing && (
              <Button variant="outline" size="lg" icon={<X size={16} aria-hidden />} className="h-11" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="lg" icon={<Save size={16} aria-hidden />} className="h-11 bg-gradient-to-r from-brand to-glow sm:min-w-56">
              {editing ? 'Update Farmer Record' : 'Save Farmer Record'}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
};



interface ImportProps {
  onImport: (records: FarmerRecord[], invalid: number) => void | Promise<void>;
  validCentreIds: string[];
}

const FarmerImport: React.FC<ImportProps> = ({ onImport, validCentreIds }) => {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pick = (f: File | null) => {
    setFile(f);
    setError(undefined);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { records, invalid } = await parseFarmerSheet(file, validCentreIds);
      if (records.length === 0) {
        setError('No valid farmer rows found. Download the sample file and follow its columns.');
        return;
      }
      await onImport(records, invalid);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file could not be read. Please upload an Excel or CSV file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Farmer Import" subtitle="Add many farmers at once from an Excel sheet.">
      <div className="space-y-5">
        <FormSection step={1} title="Sample File" description="Click Below To Download The Sample File">
          <button
            type="button"
            onClick={() => void downloadFarmerSample()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 text-sm font-semibold text-brand transition hover:bg-brand/10 active:scale-[0.98]"
          >
            <Download size={16} aria-hidden />
            Download Sample File
          </button>
        </FormSection>

        <FormSection step={2} title="File Input">
          <DropZone label="File Input" file={file} onChange={pick} accept=".xlsx,.xls,.csv" error={error} />
        </FormSection>

        <FormSection step={3} title="Import">
          <Button size="lg" className="h-11 w-full bg-gradient-to-r from-brand to-glow" icon={<Upload size={16} aria-hidden />} loading={busy} disabled={!file} onClick={run}>
            Import Farmer Excel
          </Button>
        </FormSection>
      </div>
    </Panel>
  );
};



interface ListProps {
  rows: FarmerRecord[];
  centre: string;
  onCentre: (id: string) => void;
  selected: Set<string>;
  onSelected: (next: Set<string>) => void;
  onEdit: (record: FarmerRecord) => void;
  onUpdateStatus: () => void;
  exportActions: ExportAction[];
  centreOptions: { value: string; label: string }[];
  loading?: boolean;
}

const dash = (v: string): string => v || '—';

const FarmerList: React.FC<ListProps> = ({ rows, centre, onCentre, selected, onSelected, onEdit, onUpdateStatus, exportActions, centreOptions, loading = false }) => {
  const pager = usePagination(rows);
  const pageKeys = useMemo(() => pager.visible.map(farmerKey), [pager.visible]);
  const checkedOnPage = pageKeys.filter((k) => selected.has(k)).length;
  const changedCount = useMemo(() => rows.filter((r) => selected.has(farmerKey(r)) !== r.active).length, [rows, selected]);

  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    onSelected(next);
  };

  const togglePage = (on: boolean) => {
    const next = new Set(selected);
    pageKeys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onSelected(next);
  };

  const columns: Column<FarmerRecord>[] = [
    { key: 'vlc', header: 'Vlccid', cell: (r) => <span className="tnum">{r.vlcId}</span> },
    { key: 'id', header: 'Farmer Id', cell: (r) => <span className="tnum">{r.farmerId}</span> },
    {
      key: 'name',
      header: 'Farmer Name',
      cell: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} size="sm" />
          <span className="min-w-0 truncate font-semibold">{r.name}</span>
        </span>
      ),
      mobile: 'title',
    },
    { key: 'mobile', header: 'Mobile No', cell: (r) => <span className="tnum">{dash(r.mobile)}</span> },
    { key: 'bank', header: 'Bank Name', cell: (r) => dash(r.bankName) },
    { key: 'account', header: 'Account No', cell: (r) => <span className="tnum">{dash(r.accountNo)}</span> },
    { key: 'ifsc', header: 'IFSC', cell: (r) => <span className="tnum">{dash(r.ifsc)}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={selected.has(farmerKey(r)) ? 'ok' : 'neutral'} dot>
          {selected.has(farmerKey(r)) ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: (
        <div className="flex flex-col items-center gap-1">
          <span>Action</span>
          <Checkbox aria-label="Select all farmers on this page" checked={pageKeys.length > 0 && checkedOnPage === pageKeys.length} indeterminate={checkedOnPage > 0 && checkedOnPage < pageKeys.length} onChange={(e) => togglePage(e.target.checked)} />
        </div>
      ),
      align: 'center',
      mobile: 'action',
      cell: (r) => (
        <span className="inline-flex items-center justify-center gap-2">
          <IconButton icon={Pencil} label={`Edit ${r.name}`} onClick={() => onEdit(r)} />
          <Checkbox aria-label={`Select ${r.name}`} checked={selected.has(farmerKey(r))} onChange={(e) => toggle(farmerKey(r), e.target.checked)} />
        </span>
      ),
    },
  ];

  return (
    <Panel bodyClassName="!p-0">
      <TableToolbar
        from={pager.from}
        to={pager.to}
        total={pager.total}
        pageSize={pager.pageSize}
        onPageSize={pager.setPageSize}
        filters={
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <span className="text-sm font-bold">Center</span>
            <Select label="Center" value={centre} onChange={onCentre} options={[{ value: 'all', label: 'All' }, ...centreOptions]} className="min-w-0 flex-1 sm:w-52 sm:flex-none" />
          </div>
        }
        actions={
          <>
            <ExportBar actions={exportActions} disabled={loading || rows.length === 0} />
            <Button size="sm" variant="success" icon={<RefreshCw size={15} aria-hidden />} disabled={changedCount === 0} onClick={onUpdateStatus}>
              Update Status{changedCount > 0 ? ` (${changedCount})` : ''}
            </Button>
          </>
        }
      />

      {loading ? (
        <ReportLoader label="Loading farmers…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={UsersRound} title="No farmers found" text="Add a farmer using the form above or import an Excel file." />
      ) : (
        <DataTable columns={columns} rows={pager.visible} rowKey={farmerKey} ariaLabel="Farmer master" minWidth={980} isSelected={(r) => selected.has(farmerKey(r))} />
      )}

      {!loading && rows.length > 0 && <Pagination page={pager.page} pageSize={pager.pageSize} total={pager.total} onPage={pager.goTo} onPageSize={pager.setPageSize} />}
    </Panel>
  );
};



const FarmerMaster: React.FC = () => {
  const centers = useMilkCenterOptions();
  const centreOptions = useMemo(() => centers.map((c) => ({ value: c.id, label: c.label })), [centers]);
  const ids = useMemo(() => centreOptions.map((c) => c.value), [centreOptions]);
  const idsKey = ids.join(',');
  const [farmers, setFarmers] = useState<FarmerRecord[]>([]);
  const [editing, setEditing] = useState<FarmerRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [centre, setCentre] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const toast = useToast();


  const refreshRecords = async (silent = false): Promise<FarmerRecord[] | null> => {
    if (!ids.length) { setFarmers([]); setLoading(false); return []; }
    if (!silent) setLoading(true);
    try {
      const data = await getData(ids);
      const list: FarmerRecord[] = data.map((r) => ({ vlcId: r.vlccid, farmerId: Number(r.farmerId) || 0, name: r.name, bankHolder: r.nameInBank, address: r.address, mobile: r.mobile, bankName: r.bank, ifsc: r.ifsc, accountNo: r.account, aadhaar: r.aadhaar, active: r.active }));
      setFarmers(list);
    
      setSelected(new Set(list.filter((f) => f.active).map(farmerKey)));
      return list;
    } catch (e) {
      if (!silent) toast.show(e instanceof Error ? e.message : 'Could not load farmer records');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => { void refreshRecords(); }, [idsKey]);

  const rows = useMemo(() => farmers.filter((f) => centre === 'all' || f.vlcId === centre), [farmers, centre]);

  const resetForm = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };


  const same = (a: string, b: string) => a.trim() === b.trim();
  const isStored = (list: FarmerRecord[], r: FarmerRecord, isEdit: boolean): boolean => {
    const got = list.find((f) => farmerKey(f) === farmerKey(r));
    if (!got) return false;
    if (!isEdit) return true;
    return same(got.name, r.name) && same(got.address, r.address) && same(got.mobile, r.mobile) && same(got.bankName, r.bankName) && same(got.ifsc, r.ifsc) && same(got.accountNo, r.accountNo) && same(got.aadhaar, r.aadhaar) && got.active === r.active;
  };

  const saving = useRef(false);
  const save = async (record: FarmerRecord, isEdit: boolean) => {
    if (saving.current) return;
    saving.current = true;
    const input: FarmerInput = { vlccid: record.vlcId, farmerId: String(record.farmerId), name: record.name, nameInBank: record.bankHolder, address: record.address, mobile: record.mobile, bank: record.bankName, ifsc: record.ifsc, account: record.accountNo, aadhaar: record.aadhaar, active: record.active };
    try {
      let serverNote = '';
      try {
        await postData(input, isEdit);
      } catch (e) {
        serverNote = e instanceof Error ? e.message : 'Could not save farmer';
        const fresh = await refreshRecords(true);
        if (!fresh || !isStored(fresh, record, isEdit)) {
          toast.show(serverNote);
          return;
        }
        console.warn('[FarmerMaster] The server reported an error, but the farmer is stored:', serverNote);
      }
      
      setFarmers((prev) => (prev.some((f) => farmerKey(f) === farmerKey(record)) ? prev.map((f) => (farmerKey(f) === farmerKey(record) ? record : f)) : [...prev, record]));
      setSelected((prev) => {
        const next = new Set(prev);
        if (record.active) next.add(farmerKey(record));
        else next.delete(farmerKey(record));
        return next;
      });
      toast.show(`${isEdit ? 'Updated' : 'Saved'} ${record.name}`);
      resetForm();
      void refreshRecords(true);
    } finally {
      saving.current = false;
    }
  };

  const edit = (record: FarmerRecord) => {
    setEditing(record);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const importRecords = async (records: FarmerRecord[], invalid: number) => {
    const valid = records.filter((r) => ids.includes(r.vlcId));
    const invalidCentres = records.length - valid.length;
    const inputs: FarmerInput[] = valid.map((r) => ({ vlccid: r.vlcId, farmerId: String(r.farmerId), name: r.name, nameInBank: r.bankHolder, address: r.address, mobile: r.mobile, bank: r.bankName, ifsc: r.ifsc, account: r.accountNo, aadhaar: r.aadhaar, active: r.active }));
    try { if (inputs.length) await postExcel(inputs); await refreshRecords(true); toast.show(`Imported ${inputs.length} farmers${invalid + invalidCentres ? `, skipped ${invalid + invalidCentres}` : ''}`); }
    catch (e) { throw new Error(e instanceof Error ? e.message : 'Could not import farmers'); }
  };

  const updateStatus = async () => {
    const changed = farmers.filter((f) => selected.has(farmerKey(f)) !== f.active);
    if (!changed.length) return;
    
    const villages = new Set(changed.map((f) => f.vlcId));
    const changes = farmers.filter((f) => villages.has(f.vlcId)).map((f) => ({ vlccid: f.vlcId, farmerId: String(f.farmerId), active: selected.has(farmerKey(f)) }));
    try { await updateFarmerStatus(changes); setFarmers((prev) => prev.map((f) => ({ ...f, active: selected.has(farmerKey(f)) }))); toast.show(`Status changed for ${changed.length} farmer${changed.length === 1 ? '' : 's'}`); void refreshRecords(true); }
    catch (e) { toast.show(e instanceof Error ? e.message : 'Could not update status'); }
  };

  const changeCentre = (id: string) => {
    setCentre(id);
  };

  const buildTable = (): ExportTable => ({
    filename: `farmer-master-${toISO(new Date())}`,
    title: 'Farmer master',
    subtitle: `${rows.length} farmers`,
    columns: [
      { header: 'Vlccid' }, { header: 'Farmer Id', type: 'int' }, { header: 'Farmer Name' }, { header: 'Mobile No' }, { header: 'Bank Name' },
      { header: 'Account No' }, { header: 'IFSC' }, { header: 'Aadhaar No' }, { header: 'Address' }, { header: 'Status' },
    ],
    rows: rows.map((r) => [r.vlcId, r.farmerId, r.name, r.mobile, r.bankName, r.accountNo, r.ifsc, r.aadhaar, r.address, r.active ? 'Active' : 'Inactive']),
  });

  const exportAction: ExportAction = {
    id: 'excel',
    label: 'Excel Export',
    icon: FileSpreadsheet,
    variant: 'primary',
    run: async () => {
      try {
        await exportExcel(buildTable());
        toast.show(`Exported ${rows.length} farmers as Excel`);
      } catch {
        toast.show('Export failed. Please try again.');
      }
    },
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title="Farmer Master" subtitle={`Register farmers, bank details and bulk import${centre !== 'all' ? ` for ${centreOptions.find((c) => c.value === centre)?.label ?? centre}` : ''}.`} />

      <div className="grid items-start gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FarmerForm key={formKey} farmers={farmers} editing={editing} onSubmit={save} onCancel={resetForm} centreOptions={centreOptions} />
        <div className="space-y-4 sm:space-y-5 xl:sticky xl:top-20">
          <FarmerSummary rows={rows} />
          <FarmerImport onImport={importRecords} validCentreIds={ids} />
        </div>
      </div>

      <FarmerList
        rows={rows}
        centre={centre}
        onCentre={changeCentre}
        selected={selected}
        onSelected={setSelected}
        onEdit={edit}
        onUpdateStatus={updateStatus}
        exportActions={[exportAction]}
        centreOptions={centreOptions}
        loading={loading}
      />

      <Toast message={toast.message} onClose={toast.close} />
    </div>
  );
};

export default FarmerMaster;
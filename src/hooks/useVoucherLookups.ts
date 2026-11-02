import { useEffect, useMemo, useState } from "react";
import { getFarmers } from "../services/transaction/farmerMilk.api";
import {
  cleanAccount,
  farmerCode,
  ledgersForMode,
  type VoucherOption,
} from "../services/account/voucher.common";
import type { MasterFarmer } from "../services/farmer/farmerBook";

type Status = "loading" | "ready" | "error";

export interface FarmerOption extends VoucherOption {
  account: string;
}

interface Loaders {
  loadLedgers: () => Promise<VoucherOption[]>;
  loadDeductions?: (vlcid: string) => Promise<VoucherOption[]>;
}

export function useVoucherLookups(
  vlcid: string,
  loaders: Loaders,
  mode?: string,
) {
  const { loadLedgers, loadDeductions } = loaders;
  const withDeduction = !!loadDeductions;
  const [farmers, setFarmers] = useState<MasterFarmer[]>([]);
  const [farmerStatus, setFarmerStatus] = useState<Status>("loading");
  const [allLedgers, setLedgers] = useState<VoucherOption[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<Status>("loading");
  const [deductions, setDeductions] = useState<VoucherOption[]>([]);
  const [deductionStatus, setDeductionStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLedgerStatus("loading");
    loadLedgers()
      .then((list) => {
        if (!alive) return;
        setLedgers(list);
        setLedgerStatus("ready");
      })
      .catch(() => {
        if (alive) setLedgerStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!vlcid) return;
    let alive = true;
    setFarmers([]);
    setFarmerStatus("loading");
    getFarmers(vlcid)
      .then((list) => {
        if (!alive) return;
        setFarmers(list);
        setFarmerStatus("ready");
      })
      .catch(() => {
        if (alive) setFarmerStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [vlcid, attempt]);

  useEffect(() => {
    if (!vlcid || !withDeduction) return;
    let alive = true;
    setDeductions([]);
    setDeductionStatus("loading");
    loadDeductions!(vlcid)
      .then((list) => {
        if (!alive) return;
        setDeductions(list);
        setDeductionStatus("ready");
      })
      .catch(() => {
        if (alive) setDeductionStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [vlcid, withDeduction, attempt]);

  const ledgers = useMemo(
    () => (mode ? ledgersForMode(allLedgers, mode) : allLedgers),
    [allLedgers, mode],
  );

  const farmerOptions = useMemo<FarmerOption[]>(
    () =>
      farmers.map((f) => ({
        value: f.farmerId,
        label: f.name
          ? `${farmerCode(f.farmerId)} | ${f.name}`
          : farmerCode(f.farmerId),
        account: cleanAccount(f.account),
      })),
    [farmers],
  );

  const failed =
    ledgerStatus === "error" ||
    farmerStatus === "error" ||
    (withDeduction && deductionStatus === "error");

  return {
    farmerOptions,
    farmerStatus,
    ledgers,
    ledgerStatus,
    deductions,
    deductionStatus,
    failed,
    retry: () => setAttempt((n) => n + 1),
  };
}

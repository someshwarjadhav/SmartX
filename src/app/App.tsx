import type * as React from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoginData } from '../hooks/useSessionData';
import { isRouteAllowed, useNav } from '../components/layout/operations/nav';
import { applySession, isSessionDataLoaded, loadSessionData, refreshMenu } from '../services/bootstrap';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { PageLoader } from '../components/ui/PageLoader';

const Login = lazy(() => import('../pages/auth/Login'));
const AppShell = lazy(() => import('../components/layout/AppShell'));
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const Settings = lazy(() => import('../pages/settings/Settings'));
const FarmerCollection = lazy(() => import('../pages/collection/FarmerCollection'));
const FarmerwiseCollection = lazy(() => import('../pages/collection/FarmerwiseCollection'));
const UnionwiseCollection = lazy(() => import('../pages/collection/UnionwiseCollection'));
const VlccCollectionReport = lazy(() => import('../pages/collection/VlccCollectionReport'));
const VlcStatus = lazy(() => import('../pages/collection/VlcStatus'));
const VarianceReport = lazy(() => import('../pages/collection/VarianceReport'));
const FarmerMaster = lazy(() => import('../pages/masters/FarmerMaster'));
const Contact = lazy(() => import('../pages/contact/Contact'));
const NotFound = lazy(() => import('../pages/system/NotFound'));
const LiveCollection = lazy(() => import('../pages/operations/LiveCollection'));
const Farmers = lazy(() => import('../pages/operations/Farmers'));
const Centers = lazy(() => import('../pages/operations/Centers'));
const RateChart = lazy(() => import('../pages/operations/RateChart'));
const Billing = lazy(() => import('../pages/operations/Billing'));
const FarmerBill = lazy(() => import('../pages/operations/billing/FarmerBill'));
const CashPaymentSummary = lazy(() => import('../pages/operations/billing/CashPaymentSummary'));
const BankPaymentSummary = lazy(() => import('../pages/operations/billing/BankPaymentSummary'));
const StandardDeduction = lazy(() => import('../pages/operations/billing/StandardDeduction'));
const VlcStandardDeduction = lazy(() => import('../pages/operations/billing/VlcStandardDeduction'));
const CattleFeedFarmerBill = lazy(() => import('../pages/operations/billing/CattleFeedFarmerBill'));
const VlcMilkBill = lazy(() => import('../pages/operations/billing/VlcMilkBill'));
const BillUnfreeze = lazy(() => import('../pages/operations/administrator/BillUnfreeze'));
const DpuSyncAsync = lazy(() => import('../pages/operations/administrator/DpuSyncAsync'));
const ReceiptVoucher = lazy(() => import('../pages/account/ReceiptVoucher'));
const PaymentVoucher = lazy(() => import('../pages/account/PaymentVoucher'));
const VlcMaster = lazy(() => import('../pages/operations/masters/VlcMaster'));
const RateMaster = lazy(() => import('../pages/operations/masters/RateMaster'));
const RateStatus = lazy(() => import('../pages/operations/masters/RateStatus'));
const VlcMilkEntry = lazy(() => import('../pages/operations/transactions/VlcMilkEntry'));
const FarmerMilkEntry = lazy(() => import('../pages/operations/transactions/FarmerMilkEntry'));
const ManageCollection = lazy(() => import('../pages/operations/transactions/ManageCollection'));
const SaleEntry = lazy(() => import('../pages/operations/transactions/SaleEntry'));
const DeductionEntry = lazy(() => import('../pages/operations/transactions/DeductionEntry'));
const CleaningReport = lazy(() => import('../pages/operations/reports/CleaningReport'));
const EkoCalibration = lazy(() => import('../pages/operations/reports/EkoCalibration'));
const Quality = lazy(() => import('../pages/operations/Quality'));
const Pipeline = lazy(() => import('../pages/operations/Pipeline'));
const MobileAppSettings = lazy(() => import('../pages/operations/settings/MobileAppSettings'));
const DpuSettings = lazy(() => import('../pages/operations/settings/DpuSettings'));
const EkoMilkSettings = lazy(() => import('../pages/operations/settings/EkoMilkSettings'));
const UserAccess = lazy(() => import('../pages/operations/administrator/UserAccess'));
const PortalForm = lazy(() => import('../pages/operations/FormPlaceholder'));


const PAGES: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  '/': Dashboard,
  '/settings': Settings,
  '/contact': Contact,
  '/live': LiveCollection,
  '/collections': FarmerCollection,
  '/reports/farmerwise': FarmerwiseCollection,
  '/reports/vlcc': VlccCollectionReport,
  '/reports/unionwise': UnionwiseCollection,
  '/reports/vlc-status': VlcStatus,
  '/reports/variance': VarianceReport,
  '/reports/cleaning': CleaningReport,
  '/reports/eko-calibration': EkoCalibration,
  '/transactions/vlc-milk-entry': VlcMilkEntry,
  '/transactions/farmer-milk-entry': FarmerMilkEntry,
  '/transactions/manage-collection': ManageCollection,
  '/transactions/sale-entry': SaleEntry,
  '/transactions/deduction-entry': DeductionEntry,
  '/farmers': Farmers,
  '/farmers/report': Farmers,
  '/centers': Centers,
  '/rates': RateChart,
  '/master/vlc-master': VlcMaster,
  '/master/farmer-master': FarmerMaster,
  '/master/excel-rate-upload': RateMaster,
  '/master/rate-status': RateStatus,
  '/billing': Billing,
  '/billing/farmer-bill': FarmerBill,
  '/billing/bank-payment-summary': BankPaymentSummary,
  '/billing/cash-payment-summary': CashPaymentSummary,
  '/billing/standard-deduction': StandardDeduction,
  '/billing/vlc-standard-deduction': VlcStandardDeduction,
  '/billing/cattlefeed-farmer-bill': CattleFeedFarmerBill,
  '/billing/vlc-milk-bill': VlcMilkBill,
  '/portal/account/receipt-voucher': ReceiptVoucher,
  '/portal/account/payment-voucher': PaymentVoucher,
  '/settings/dpu-settings': DpuSettings,
  '/settings/mobile-app': MobileAppSettings,
  '/settings/eko-milk-settings': EkoMilkSettings,
  '/administrator/user-access': UserAccess,
  '/administrator/bill-unfreeze': BillUnfreeze,
  '/administrator/dpu-sync-async': DpuSyncAsync, 
  '/quality': Quality,
  '/pipeline': Pipeline,
  '/portal/*': PortalForm,
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const SessionGate: React.FC = () => {
  const { logout } = useAuth();
  const profile = useLoginData();
  const [ready, setReady] = useState(isSessionDataLoaded());
  const started = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!profile) {
      logout();
      return;
    }
    if (isSessionDataLoaded()) {
      setReady(true);
      if (profile.userId) void refreshMenu(profile.userId);
      return;
    }
    started.current ??= loadSessionData(profile).then(() => applySession(profile));
    let alive = true;
    void started.current.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [profile, logout]);

  if (!profile) return <Navigate to="/login" replace />;
  return ready ? <Outlet /> : <PageLoader full />;
};


const RouteGate: React.FC = () => {
  const { pathname } = useLocation();
  const sections = useNav();
  return isRouteAllowed(sections, pathname) ? <Outlet /> : <NotFound />;
};

const Protected: React.FC = () => {
  const { user } = useAuth();
  return user ? <SessionGate /> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { user } = useAuth();
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Suspense fallback={<PageLoader full />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route element={<Protected />}>
            <Route element={<AppShell />}>
              <Route element={<RouteGate />}>
                {Object.entries(PAGES).map(([path, Page]) =>
                  path === '/' ? <Route key={path} index element={<Page />} /> : <Route key={path} path={path} element={<Page />} />,
                )}
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default App;
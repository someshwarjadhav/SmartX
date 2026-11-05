import type * as React from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "../components/layout/operations/AppLayout";
import { PageLoader } from "../components/operations/PageLoader";
import { useAuth } from "../context/portal/AuthContext";
import { useLoginData } from "../hooks/useSessionData";
import { useNav, isRouteAllowed } from "../components/layout/operations/nav";
import {
  applySession,
  isSessionDataLoaded,
  loadSessionData,
  refreshMenu,
} from "../services/bootstrap";

const Login = lazy(() => import("../pages/operations/Login"));
const Contact = lazy(() => import("../pages/operations/Contact"));
const Dashboard = lazy(() => import("../pages/operations/Dashboard"));
const LiveCollection = lazy(() => import("../pages/operations/LiveCollection"));
const Collections = lazy(() => import("../pages/operations/reports/Collections"));
const Farmers = lazy(() => import("../pages/operations/Farmers"));
const FarmerMaster = lazy(() => import("../pages/operations/masters/FarmerMaster"));
const VlcMaster = lazy(() => import("../pages/operations/masters/VlcMaster"));
const RateMaster = lazy(() => import("../pages/operations/masters/RateMaster"));
const RateStatus = lazy(() => import("../pages/operations/masters/RateStatus"));
const Centers = lazy(() => import("../pages/operations/Centers"));
const RateChart = lazy(() => import("../pages/operations/RateChart"));
const Billing = lazy(() => import("../pages/operations/Billing"));
const FarmerBill = lazy(() => import("../pages/operations/billing/FarmerBill"));
const Quality = lazy(() => import("../pages/operations/Quality"));
const Pipeline = lazy(() => import("../pages/operations/Pipeline"));
const Settings = lazy(() => import("../pages/operations/Settings"));
const UnionwiseCollection = lazy(
  () => import("../pages/operations/reports/UnionwiseCollection"),
);
const VlcStatus = lazy(() => import("../pages/operations/reports/VlcStatus"));
const VarianceReport = lazy(() => import("../pages/operations/reports/VarianceReport"));
const CleaningReport = lazy(() => import("../pages/operations/reports/CleaningReport"));
const EkoCalibration = lazy(() => import("../pages/operations/reports/EkoCalibration"));
const EkoCorrection = lazy(() => import("../pages/operations/reports/EkoCorrection"));
const VlcMilkEntry = lazy(() => import("../pages/operations/transactions/VlcMilkEntry"));
const FarmerMilkEntry = lazy(
  () => import("../pages/operations/transactions/FarmerMilkEntry"),
);
const StandardDeduction = lazy(() => import("../pages/operations/billing/StandardDeduction"));
const VlcStandardDeduction = lazy(() => import("../pages/operations/billing/VlcStandardDeduction"));

const CashPaymentSummary = lazy(() => import("../pages/operations/billing/CashPaymentSummary"));
const BankPaymentSummary = lazy(() => import("../pages/operations/billing/BankPaymentSummary"));
const CattleFeedFarmerBill = lazy(() => import("../pages/operations/billing/CattleFeedFarmerBill"));
const ManageCollection = lazy(() => import('../pages/operations/transactions/ManageCollection'));
const SaleEntry = lazy(() => import('../pages/operations/transactions/SaleEntry'));
const MobileAppSettings = lazy(
  () => import("../pages/operations/settings/MobileAppSettings"),
);
const DpuSettings = lazy(() => import("../pages/operations/settings/DpuSettings"));
const EkoMilkSettings = lazy(() => import("../pages/operations/settings/EkoMilkSettings"));
const UserAccess = lazy(() => import("../pages/operations/administrator/UserAccess"));
const FormPlaceholder = lazy(() => import("../pages/operations/FormPlaceholder"));
const NotFound = lazy(() => import("../pages/operations/NotFound"));

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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

    started.current ??= loadSessionData(profile).then(() =>
      applySession(profile),
    );
    let alive = true;
    started.current.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [profile, logout]);

  if (!profile) return <Navigate to="/login" replace />;
  return ready ? <Outlet /> : <PageLoader />;
};

const RouteGate: React.FC = () => {
  const { pathname } = useLocation();
  const sections = useNav();
  return isRouteAllowed(sections, pathname) ? <Outlet /> : <NotFound />;
};

const FarmerCollectionRoute: React.FC = () => <Collections only="farmer" />;

const Protected: React.FC = () => {
  const { user } = useAuth();
  return user ? <SessionGate /> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/" replace /> : <Login />}
          />
          <Route path="/contact" element={<Contact />} />
          <Route element={<Protected />}>
            <Route element={<AppLayout />}>
            <Route element={<RouteGate />}>
              <Route index element={<Dashboard />} />
              <Route path="live" element={<LiveCollection />} />


              {/* Reports */}
              <Route path="collections" element={<FarmerCollectionRoute />} />
              <Route
                path="reports/farmerwise"
                element={
                  <Collections only="entry" />
                }
              />
              <Route
                path="reports/vlcc"
                element={
                  <Collections only="vlcc" />
                }
              />
              <Route
                path="reports/cleaning"
                element={
                  <CleaningReport />
                }
              />
              <Route
                path="reports/eko-calibration"
                element={
                  <EkoCalibration />
                }
              />
              <Route path="reports/eko-correction" element={<EkoCorrection />} />

              {/* Transactions */}
              <Route
                path="transactions/vlc-milk-entry"
                element={
                  <VlcMilkEntry />
                }
              />
              <Route
                path="transactions/farmer-milk-entry"
                element={
                  <FarmerMilkEntry />
                }
              />
              <Route
                path="transactions/manage-collection"
                element={
                  <ManageCollection />
                }
              />
              <Route
                path="transactions/sale-entry"
                element={
                  <SaleEntry />
                }
              />

              {/* master */}
              <Route path="farmers" element={<Farmers />} />
              <Route path="farmers/report" element={<Farmers />} />
              <Route
                path="master/farmer-master"
                element={
                  <FarmerMaster />
                }
              />
              <Route
                path="master/vlc-master"
                element={
                  <VlcMaster />
                }
              />
              <Route
                path="master/excel-rate-upload"
                element={
                  <RateMaster />
                }
              />
              <Route
                path="master/rate-status"
                element={
                  <RateStatus />
                }
              />
              <Route path="centers" element={<Centers />} />
              <Route path="rates" element={<RateChart />} />
              <Route path="billing" element={<Billing />} />
              <Route path="billing/farmer-bill" element={<FarmerBill />} />
              <Route path="billing/standard-deduction" element={<StandardDeduction />} />
              <Route path="billing/vlc-standard-deduction" element={<VlcStandardDeduction />} />
              
              <Route path="billing/cash-payment-summary" element={<CashPaymentSummary />} />
              <Route
                path="billing/bank-payment-summary"
                element={
                  <BankPaymentSummary />
                }
              />
              <Route
                path="billing/cattlefeed-farmer-bill"
                element={
                  <CattleFeedFarmerBill />
                }
              />
              <Route path="quality" element={<Quality />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route
                path="reports/unionwise"
                element={
                  <UnionwiseCollection />
                }
              />
              <Route
                path="reports/vlc-status"
                element={
                  <VlcStatus />
                }
              />
              <Route
                path="reports/variance"
                element={
                  <VarianceReport />
                }
              />
              <Route
                path="settings/mobile-app"
                element={
                  <MobileAppSettings />
                }
              />
              <Route
                path="settings/dpu-settings"
                element={
                  <DpuSettings />
                }
              />
              <Route
                path="settings/eko-milk-settings"
                element={
                  <EkoMilkSettings />
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="administrator/user-access" element={<UserAccess />} />
              <Route path="portal/*" element={<FormPlaceholder />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
};

export default App;
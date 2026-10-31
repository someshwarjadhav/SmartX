# SmartX — MilkShell API integration

The supplied SmartX project remains the presentation layer: SmartX theme, navigation, sign-in design, dashboard/report layouts and shared UI shell are retained. MilkShell authentication, API services, hooks, mappers and operational screens have been reorganized into SmartX's normal `src/` folders. There is **no `src/milk/` folder**.

## Requirements and setup

Use Node.js 18+ and npm. Configure the portal endpoints before starting the app:

```bash
cp .env.example .env.local
# Edit .env.local with the real MilkShell API and (if needed) STIPL endpoint values.
npm install
npm run dev
```

The sign-in page uses the real MilkShell authentication endpoint; there is no demo account or local mock sign-in. Set `VITE_API_BASE_URL` to the portal API/gateway origin. Some direct transaction/settings services may also require `VITE_STIPL_BASE_URL`. `VITE_ENCRYPTION_KEY` is **required to sign in** (the login request is AES-encrypted) and also decrypts encrypted replies; without it the login page shows "Sign-in is not configured correctly". Provide `VITE_VLCC_IDS`/`VITE_MCC_ID` only if those IDs are not returned by login. The API host must permit requests from the development/production app origin (CORS). Never commit `.env.local` or put account passwords/tokens in the source tree.

To verify or produce a deployment build:

```bash
npm run build
npm run preview
```

## Integrated screens and data

- **SmartX dashboard:** derives collection volume, fat/SNF, farmer counts, payable amount, centre totals, shifts, and latest collection records from MilkShell farmer-collection API data. There is no tanker tracking on the dashboard because the portal API has no tanker endpoint.
- **SmartX-designed collection reports:** Farmer Collection, Farmerwise Collection, VLC Collection, VLC Status, Unionwise Collection, and Variance Report use MilkShell collection APIs and logged-in centre IDs while retaining the SmartX layouts, filters, tables, and exports.
- **Farmer Master:** reads records from the MilkShell farmer-master endpoint and routes add/edit, Excel import, and active-status changes to MilkShell APIs.
- **Additional operational screens:** live collection, farmers/centres, rate chart and masters, transactions, billing, reports, user access, settings, quality, and pipeline are routed inside the SmartX shell. Their existing MilkShell service functions and API-backed workflows are retained; the shell and design tokens come from SmartX.
- **Authentication/session:** login, session bootstrap, encryption handling, API hooks/services, and required contexts are integrated with the SmartX root providers.

## SmartX source organization

- `src/services/` — API transport, auth, report, master, billing, transaction, menu, mapping and session services from MilkShell.
- `src/hooks/` — query, session and data hooks, alongside SmartX report/dashboard adapters.
- `src/context/` — unified SmartX authentication plus shared data/toast contexts; compatible portal context exports under `src/context/portal/`.
- `src/components/` — SmartX components, with additional reusable operational components organized under `src/components/operations/`.
- `src/pages/` — SmartX-designed screens plus operational screens organized under `src/pages/operations/` by billing, reports, masters, settings, transactions and administration.
- `src/config/portal/`, `src/lib/portal/`, and `src/types/` — portal-specific configuration/helpers/types placed within SmartX's config, library and type domains.
- `src/main.tsx` — single active SmartX entry point and unified provider tree. `src/app/OperationsEntry.tsx` preserves the separate operational-app entry source but is not active.
- `.env.example` — non-secret configuration template; copy to `.env.local` and fill in values privately.

## API limitations

The real portal account must return accessible centre/VLCC IDs and the server must expose the MilkShell endpoints used by each page. The production URL, credentials, and optional encryption key were not embedded in the submitted source archive and cannot be inferred from it. If a specific tab depends on an endpoint unavailable to the account, that tab shows an API error/empty state rather than invented records. 

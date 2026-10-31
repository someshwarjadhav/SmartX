/// <reference types="vite/client" />

// Variables not already declared in src/types/operations-vite-env.d.ts.
interface ImportMetaEnv {
  readonly VITE_STIPL_BASE_URL?: string;
  readonly VITE_FARMER_MILK_CODES?: string;
  readonly VITE_RATE_ID?: string;
  readonly VITE_DEV_EMAIL?: string;
  readonly VITE_DEV_PASSWORD?: string;
}

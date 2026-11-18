
export const LANDING_ROUTE_BY_EMAIL: Record<string, string> = {
  'skadprocument@gmail.com': '/portal/profile',
};

export const landingRouteFor = (email?: string | null): string | null =>
  LANDING_ROUTE_BY_EMAIL[(email ?? '').trim().toLowerCase()] ?? null;
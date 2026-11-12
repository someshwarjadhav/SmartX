import { useCallback, useMemo, useState } from 'react';
import { ALL, useMilkCenterOptions, useReportScope } from './useMilkReportData';

/**
 * Plant / MCC dropdown state for the screens that list centres.
 *
 * The plants come from the same API data as the report pages (useMilkCenterOptions: the DPU centre API + the route API),
 * nothing is hardcoded. `belongs(centreId)` tells whether a centre is under the picked plant ("All" = every centre),
 * so each screen keeps its own centre list and only filters it.
 */
export function usePlantScope() {
  const centres = useMilkCenterOptions();
  const [picked, setPicked] = useState<string>(ALL);
  const { plantOptions, plant } = useReportScope(centres, picked, '', true);
  const plantOf = useMemo(() => new Map(centres.map((c) => [c.id, c.mccId])), [centres]);

  /** is this centre under `forPlant` (default: the plant picked now)? */
  const belongs = useCallback(
    (centreId: string, forPlant: string = plant): boolean =>
      !forPlant || forPlant === ALL || (plantOf.get(centreId) ?? centreId.slice(0, 3)) === forPlant,
    [plant, plantOf],
  );

  return { centres, plantOptions, plant, setPlant: setPicked, belongs };
}

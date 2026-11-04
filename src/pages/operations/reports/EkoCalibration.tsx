import { SlidersHorizontal } from "lucide-react";
import EkoDataReport from "../../../components/operations/EkoDataReport";
import { EKO_CALIBRATION_FIELDS, getEkoCleaningData } from "../../../services/report/ekoCalibration.api";

export default function EkoCalibration() {
  return (
    <EkoDataReport
      title="Eko Calibration"
      subtitle="View and export Eko calibration / cleaning records for a selected VLC."
      icon={SlidersHorizontal}
      fields={EKO_CALIBRATION_FIELDS}
      load={getEkoCleaningData}
    />
  );
}

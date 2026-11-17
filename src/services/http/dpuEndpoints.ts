export const DPU_HOST = 'https://dpu.shivinfotech.co.in';

export const DPU = {
  // APIs that used to run on the old STIPL / portal host. They now run on DPU only:
  //   https://dpu.shivinfotech.co.in/api/Login/<name>   (DPU_HOST + /api + the path below)
  getVillageId: '/Login/getVillageId', //                    GET    (was /home/getVillageId)
  userReportConfig: '/Login/UserReportConfig', //            GET    (was /home/userReportConfig)
  farmerCollectionDpu: '/Login/FarmerCollectionDpu', //      GET    (was /home/farmercollectiondpu)
  farmerMaster: '/Login/FarmerMaster', //                    POST   (was /home/farmermaster)
  vlccCollection: '/Login/VlccCollection', //                GET    (was /home/VlccCollection)
  // rate
  getRate: '/Login/getRate',
  getRateStatus: '/Login/GetRateStatus',
  showRateWeb: '/Login/ShowRateWeb',
  dpuSyncAsync: '/Login/dpuSyncAsync',
  // collection
  vlcMilkCollection: '/Login/VlcMilkCollection',
  milkCollectionVlc: '/Login/MilkCollectionvlc',
  milkCollection: '/Login/MilkCollection',
  farmerCollection: '/Login/FarmerCollection',
  updateMilkEntry: '/Login/updateMilkEntry',
  farmerCollectionDelete: '/Login/FarmerCollectionDelete',
  // standard deduction
  farmerMasterCN: '/Login/FarmerMasterCN',
  farmerMasterCNEntry: '/Login/FarmerMasterCNEntry',
  farmerMasterVlccDed: '/Login/FarmerMasterVlccDed',
  villageMasterCNEntry: '/Login/VillageMasterCNEntry',
  // deduction entry
  billDeductionDetailsMA: '/Login/billDeductionDetailsMA',
  getBillHead: '/Login/getBillHead',
  addBillDeduction: '/Login/addBillDeduction',
  // farmer bill
  milkBillProcessMA: '/Login/MilkBillProcessMA',
  getMilkBillFreeze: '/Login/GetMilkBillFreeze',
  milkBillPaySummMA: '/Login/MilkBillPaySummMA',
} as const;
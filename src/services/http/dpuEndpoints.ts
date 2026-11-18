export const DPU_HOST = 'https://dpu.shivinfotech.co.in';

export const DPU = {
  // APIs that used to run on the old STIPL / portal host. They now run on DPU only:
  //   https://dpu.shivinfotech.co.in/api/Login/<name>   (DPU_HOST + /api + the path below)
  getVillageId: '/Login/getVillageId', //                    GET    (was /home/getVillageId)
  userReportConfig: '/Login/UserReportConfig', //            GET    (was /home/userReportConfig)
  farmerCollectionDpu: '/Login/FarmerCollectionDpu', //      GET    (was /home/farmercollectiondpu)
  farmerMaster: '/Login/FarmerMaster', //                    POST   (was /home/farmermaster)
  vlccCollection: '/Login/VlccCollection', //                GET    (was /home/VlccCollection)
  // moved from /home/... and /dairy/dairy/... to DPU as well
  collectionBulkQuality: '/Login/collectionbulkquality', //  GET    (was /home/collectionbulkquality)
  farmerMilkEntry: '/Login/FarmerMilkEntry', //              POST   (was /home/FarmerMilkEntry)
  dashboardLinechart: '/Login/dashboardLinechart', //        GET    (was /home/dashboardLinechart)
  topMilkSupplier: '/Login/topMilkSupplier', //              GET    (was /home/topMilkSupplier)
  getFarmerBill: '/Login/getFarmerBill', //                  GET    (was /dairy/dairy/getFarmerBill)
  addUserAccess: '/Login/addUserAccess', //                  POST   (was /dairy/dairy/addUserAccess)
  cleaningReport: '/Login/cleaningReport', //                GET    (was /dairy/dairy/cleaningReport)
  updateFarmerFlag: '/Login/updatefarmerflag', //            GET    (was /dairy/dairy/updatefarmerflag)
  getAccountLedger: '/Login/getaccountledger', //            GET    (was /dairy/dairy/getaccountledger)
  // payment / receipt voucher: body is { payload: "<XOR + base64>" } (same as FarmerSave / DeleteFarmer)
  paymentVoucher: '/Login/paymentvoucher', //                POST   payload (was /dairy/dairy/paymentvoucher)
  paymentVoucherList: '/Login/paymentvoucherlist', //        POST   payload (was /dairy/dairy/paymentvoucherlist)
  paymentVoucherDelete: '/Login/paymentvoucherdelete', //    DELETE payload (was /dairy/dairy/paymentvoucherdelete)
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
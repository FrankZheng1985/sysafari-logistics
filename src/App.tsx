import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard' // eslint-disable-line @typescript-eslint/no-unused-vars
import SystemDashboard from './pages/SystemDashboard'
import BPView from './pages/BPView'
import BPHistory from './pages/BPHistory'
import OrderLabels from './pages/OrderLabels'
import PureLabels from './pages/PureLabels'
import LabelSearch from './pages/LabelSearch'
import LabelCreateSingle from './pages/LabelCreateSingle'
import LabelCreateBatch from './pages/LabelCreateBatch'
import OrderPackages from './pages/OrderPackages'
import OrderBills from './pages/OrderBills'
import BillDetails from './pages/BillDetails'
import OrderDeclarations from './pages/OrderDeclarations'
import ClearanceDocuments from './pages/ClearanceDocuments'
import InspectionDashboard from './pages/InspectionDashboard'
import InspectionDetails from './pages/InspectionDetails'
import InspectionBillDetails from './pages/InspectionBillDetails'
import CMRManage from './pages/CMRManage'
import CMRBillDetails from './pages/CMRBillDetails'
import LastMile from './pages/LastMile'
import LastMileDashboard from './pages/LastMileDashboard'
import LastMileCarriers from './pages/LastMile/LastMileCarriers'
import LastMileZones from './pages/LastMile/LastMileZones'
import LastMileRates from './pages/LastMile/LastMileRates'
import LastMileQuickQuote from './pages/LastMile/LastMileQuickQuote'
import LastMileShipments from './pages/LastMile/LastMileShipments'
import LastMileRateImport from './pages/LastMile/LastMileRateImport'
import Inquiry from './pages/Inquiry'
import TariffCalculator from './pages/TariffCalculator'
import MenuSettings from './pages/MenuSettings'
import UserManage from './pages/UserManage'
import RolePermissions from './pages/RolePermissions'
import SecuritySettings from './pages/SecuritySettings'
import SecurityCenter from './pages/SecurityCenter'
import LogoManage from './pages/LogoManage'
import BasicDataManage from './pages/BasicDataManage'
import TariffRateManage from './pages/TariffRateManage'
// CRM 模块
import CRMDashboard from './pages/CRMDashboard'
import CRMCustomers from './pages/CRMCustomers'
import CRMCustomerDetail from './pages/CRMCustomerDetail'
import CRMBillDetails from './pages/CRMBillDetails'
import CRMOpportunities from './pages/CRMOpportunities'
import CRMQuotations from './pages/CRMQuotations'
import CRMContracts from './pages/CRMContracts'
import CRMFeedbacks from './pages/CRMFeedbacks'
import CRMCommissionRules from './pages/CRMCommissionRules'
import CRMCommissionRecords from './pages/CRMCommissionRecords'
import CRMPenaltyRecords from './pages/CRMPenaltyRecords'
import CRMCommissionSettlements from './pages/CRMCommissionSettlements'
// 合同模板模块
import ContractTemplateConfig from './pages/ContractTemplateConfig'
import CustomsContracts from './pages/CustomsContracts'
import ContractPreview from './pages/ContractPreview'
// 财务模块
import FinanceDashboard from './pages/FinanceDashboard'
import FinanceInvoices from './pages/FinanceInvoices'
import CarrierSettlement from './pages/Finance/CarrierSettlement'
import FinanceInvoiceHistory from './pages/FinanceInvoiceHistory'
import InvoiceDetail from './pages/InvoiceDetail'
import EditInvoice from './pages/EditInvoice'
import RegisterPayment from './pages/RegisterPayment'
import FinancePayments from './pages/FinancePayments'
import FinanceFees from './pages/FinanceFees'
import FinanceReports from './pages/FinanceReports'
import FinanceOrderReport from './pages/FinanceOrderReport'
import FinancialStatements from './pages/FinancialStatements'
import BankAccounts from './pages/BankAccounts'
import CreateInvoice from './pages/CreateInvoice'
// TMS模块
import TMSDashboard from './pages/TMSDashboard'
import TransportPricing from './pages/TransportPricing'
import CMRExceptionManage from './pages/CMRExceptionManage'
import TMSConditions from './pages/TMSConditions'
// 工具模块
import ToolsDashboard from './pages/ToolsDashboard'
import SharedTaxManage from './pages/SharedTaxManage'
import ProductPricing from './pages/ProductPricing'
// 系统模块
import SystemManageDashboard from './pages/SystemManageDashboard'
import ActivityLogs from './pages/ActivityLogs'
import ApprovalList from './pages/ApprovalList'
import Auth0UserBinding from './pages/Auth0UserBinding'
import ApiIntegrations from './pages/ApiIntegrations'
// 消息/审批/预警模块
import MessageCenter from './pages/MessageCenter'
import ApprovalWorkbench from './pages/ApprovalWorkbench'
import ApprovalCenter from './pages/ApprovalCenter'
import AlertDashboard from './pages/AlertDashboard'
import InfoCenter from './pages/InfoCenter'
import DataImportCenter from './pages/DataImportCenter'
import SupplierDashboard from './pages/SupplierDashboard'
import SupplierManage from './pages/SupplierManage'
import SupplierPrices from './pages/SupplierPrices'
import SupplierPriceImport from './pages/SupplierPriceImport'
// 单证管理模块
import DocumentDashboard from './pages/DocumentDashboard'
import DocumentImport from './pages/DocumentImport'
import DocumentMatching from './pages/DocumentMatching'
import DocumentTaxCalc from './pages/DocumentTaxCalc'
import DocumentSupplement from './pages/DocumentSupplement'
import HSMatchRecords from './pages/HSMatchRecords'
// 文档中心模块
import DocumentCenter from './pages/DocumentCenter'
import { initMenuSettings } from './utils/menuSettings'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { TabsProvider } from './contexts/TabsContext'
import { ToastProvider } from './components/Toast'
import { Loader2 } from 'lucide-react'

// 保护路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SystemDashboard />} />
        <Route path="/dashboard" element={<SystemDashboard />} />
        <Route path="/bp-view" element={<BPView />} />
        <Route path="/bp-view/history" element={<BPHistory />} />
        <Route path="/bookings/labels" element={<OrderLabels />} />
        <Route path="/bookings/labels/pure" element={<PureLabels />} />
        <Route path="/bookings/labels/search" element={<LabelSearch />} />
        <Route path="/bookings/labels/create-single" element={<LabelCreateSingle />} />
        <Route path="/bookings/labels/create-batch" element={<LabelCreateBatch />} />
        <Route path="/bookings/packages" element={<OrderPackages />} />
        <Route path="/bookings/bill" element={<OrderBills />} />
        <Route path="/bookings/bill/draft" element={<OrderBills />} />
        <Route path="/bookings/bill/void" element={<OrderBills />} />
        <Route path="/bookings/bill/:id" element={<BillDetails />} />
        <Route path="/bookings/declarations" element={<OrderDeclarations />} />
        <Route path="/bookings/clearance" element={<ClearanceDocuments />} />
        {/* 查验管理模块 */}
        <Route path="/inspection" element={<InspectionDashboard />} />
        <Route path="/inspection/pending" element={<InspectionDetails />} />
        <Route path="/inspection/released" element={<InspectionDetails />} />
        <Route path="/inspection/:id" element={<InspectionBillDetails />} />
        {/* TMS运输管理 */}
        <Route path="/tms" element={<TMSDashboard />} />
        <Route path="/tms/exceptions" element={<CMRExceptionManage />} />
        <Route path="/tms/pricing" element={<TransportPricing />} />
        <Route path="/tms/conditions" element={<TMSConditions />} />
        <Route path="/cmr-manage" element={<CMRManage />} />
        <Route path="/cmr-manage/delivering" element={<CMRManage />} />
        <Route path="/cmr-manage/exception" element={<CMRManage />} />
        <Route path="/cmr-manage/archived" element={<CMRManage />} />
        <Route path="/cmr-manage/:id" element={<CMRBillDetails />} />
        {/* 最后里程模块 */}
        <Route path="/last-mile" element={<LastMileDashboard />} />
        <Route path="/last-mile/carriers" element={<LastMileCarriers />} />
        <Route path="/last-mile/zones" element={<LastMileZones />} />
        <Route path="/last-mile/rates" element={<LastMileRates />} />
        <Route path="/last-mile/import" element={<LastMileRateImport />} />
        <Route path="/last-mile/shipments" element={<LastMileShipments />} />
        <Route path="/last-mile/quote" element={<LastMileQuickQuote />} />
        {/* 旧的最后里程派送页面 */}
        <Route path="/last-mile/delivery" element={<LastMile />} />
        <Route path="/system" element={<SystemManageDashboard />} />
        <Route path="/system/menu-settings" element={<MenuSettings />} />
        <Route path="/system/user-manage" element={<UserManage />} />
        <Route path="/system/user-manage/permissions" element={<RolePermissions />} />
        <Route path="/system/user-binding" element={<Auth0UserBinding />} />
        <Route path="/system/security-settings" element={<SecuritySettings />} />
        <Route path="/system/security-settings/logs" element={<SecuritySettings />} />
        <Route path="/system/security-center" element={<SecurityCenter />} />
        <Route path="/system/activity-logs" element={<ActivityLogs />} />
        <Route path="/system/logo-manage" element={<LogoManage />} />
        <Route path="/system/basic-data" element={<BasicDataManage />} />
        <Route path="/system/basic-data/container" element={<BasicDataManage />} />
        <Route path="/system/basic-data/port" element={<BasicDataManage />} />
        <Route path="/system/basic-data/destination" element={<BasicDataManage />} />
        <Route path="/system/basic-data/country" element={<BasicDataManage />} />
        <Route path="/system/basic-data/fee-category" element={<BasicDataManage />} />
        <Route path="/system/basic-data/transport-method" element={<BasicDataManage />} />
        <Route path="/system/tariff-rates" element={<TariffRateManage />} />
        <Route path="/system/approvals" element={<ApprovalWorkbench />} />
        <Route path="/system/approval-center" element={<ApprovalCenter />} />
        <Route path="/system/messages" element={<MessageCenter />} />
        <Route path="/system/alerts" element={<AlertDashboard />} />
        <Route path="/system/info-center" element={<InfoCenter />} />
        <Route path="/system/data-import" element={<DataImportCenter />} />
        <Route path="/system/api-integrations" element={<ApiIntegrations />} />
        {/* 供应商管理模块 */}
        <Route path="/suppliers" element={<SupplierDashboard />} />
        <Route path="/suppliers/list" element={<SupplierManage />} />
        <Route path="/suppliers/manage" element={<SupplierManage />} />
        <Route path="/suppliers/prices" element={<SupplierPrices />} />
        <Route path="/suppliers/import" element={<SupplierPriceImport />} />
        <Route path="/tools" element={<ToolsDashboard />} />
        <Route path="/tools/inquiry" element={<Inquiry />} />
        <Route path="/tools/tariff-calculator" element={<TariffCalculator />} />
        <Route path="/tools/shared-tax" element={<SharedTaxManage />} />
        <Route path="/tools/product-pricing" element={<ProductPricing />} />
        {/* CRM 客户关系管理 */}
        <Route path="/crm" element={<CRMDashboard />} />
        <Route path="/crm/customers" element={<CRMCustomers />} />
        <Route path="/crm/customers/:id" element={<CRMCustomerDetail />} />
        <Route path="/crm/bill/:id" element={<CRMBillDetails />} />
        <Route path="/crm/opportunities" element={<CRMOpportunities />} />
        <Route path="/crm/quotations" element={<CRMQuotations />} />
        <Route path="/crm/contracts" element={<CRMContracts />} />
        <Route path="/crm/feedbacks" element={<CRMFeedbacks />} />
        <Route path="/crm/commission/rules" element={<CRMCommissionRules />} />
        <Route path="/crm/commission/records" element={<CRMCommissionRecords />} />
        <Route path="/crm/commission/penalties" element={<CRMPenaltyRecords />} />
        <Route path="/crm/commission/settlements" element={<CRMCommissionSettlements />} />
        {/* 合同管理 */}
        <Route path="/contracts" element={<CustomsContracts />} />
        <Route path="/contracts/config" element={<ContractTemplateConfig />} />
        <Route path="/contracts/preview/:id" element={<ContractPreview />} />
        {/* 单证管理 */}
        <Route path="/documents" element={<DocumentDashboard />} />
        <Route path="/documents/import" element={<DocumentImport />} />
        <Route path="/documents/matching" element={<DocumentMatching />} />
        <Route path="/documents/tax-calc" element={<DocumentTaxCalc />} />
        <Route path="/documents/supplement" element={<DocumentSupplement />} />
        <Route path="/documents/match-records" element={<HSMatchRecords />} />
        {/* 文档中心（COS存储） */}
        <Route path="/document-center" element={<DocumentCenter />} />
        {/* 财务管理 */}
        <Route path="/finance" element={<FinanceDashboard />} />
        <Route path="/finance/invoices" element={<FinanceInvoices />} />
        <Route path="/finance/invoices/history" element={<FinanceInvoiceHistory />} />
        <Route path="/finance/invoices/create" element={<CreateInvoice />} />
        <Route path="/finance/invoices/:id/edit" element={<EditInvoice />} />
        <Route path="/finance/invoices/:id/payment" element={<RegisterPayment />} />
        <Route path="/finance/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/finance/payments" element={<FinancePayments />} />
        <Route path="/finance/fees" element={<FinanceFees />} />
        <Route path="/finance/reports" element={<FinanceReports />} />
        <Route path="/finance/order-report" element={<FinanceOrderReport />} />
        <Route path="/finance/bill-details/:id" element={<BillDetails />} />
        <Route path="/finance/carrier-settlement" element={<CarrierSettlement />} />
        <Route path="/finance/statements" element={<FinancialStatements />} />
        <Route path="/finance/bank-accounts" element={<BankAccounts />} />
      </Routes>
    </Layout>
  )
}

function App() {
  // 初始化菜单设置
  useEffect(() => {
    initMenuSettings()
  }, [])

  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* 登录页面 */}
            <Route path="/login" element={<Login />} />
            {/* 受保护的路由 */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <TabsProvider>
                      <AppRoutes />
                    </TabsProvider>
                  </SocketProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App

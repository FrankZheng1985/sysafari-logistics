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
import Inquiry from './pages/Inquiry'
import TariffCalculator from './pages/TariffCalculator'
import PaymentInvoice from './pages/PaymentInvoice'
import AddressTax from './pages/AddressTax'
import CommodityCode from './pages/CommodityCode'
import ProductCategory from './pages/ProductCategory'
import EditableTableDemo from './pages/EditableTableDemo'
import ComponentsDemo from './pages/ComponentsDemo'
import MenuSettings from './pages/MenuSettings'
import UserManage from './pages/UserManage'
import RolePermissions from './pages/RolePermissions'
import SecuritySettings from './pages/SecuritySettings'
import LogoManage from './pages/LogoManage'
import BasicDataManage from './pages/BasicDataManage'
import TariffRateManage from './pages/TariffRateManage'
// CRM 模块
import CRMDashboard from './pages/CRMDashboard'
import CRMCustomers from './pages/CRMCustomers'
import CRMCustomerDetail from './pages/CRMCustomerDetail'
import CRMOpportunities from './pages/CRMOpportunities'
import CRMQuotations from './pages/CRMQuotations'
import CRMContracts from './pages/CRMContracts'
import CRMFeedbacks from './pages/CRMFeedbacks'
// 财务模块
import FinanceDashboard from './pages/FinanceDashboard'
import FinanceInvoices from './pages/FinanceInvoices'
import FinancePayments from './pages/FinancePayments'
import FinanceFees from './pages/FinanceFees'
import FinanceReports from './pages/FinanceReports'
import CreateInvoice from './pages/CreateInvoice'
// TMS模块
import TMSDashboard from './pages/TMSDashboard'
import ServiceProviders from './pages/ServiceProviders'
import TransportPricing from './pages/TransportPricing'
import CMRExceptionManage from './pages/CMRExceptionManage'
import TMSConditions from './pages/TMSConditions'
// 工具模块
import ToolsDashboard from './pages/ToolsDashboard'
// 系统模块
import SystemManageDashboard from './pages/SystemManageDashboard'
import ActivityLogs from './pages/ActivityLogs'
import ApprovalList from './pages/ApprovalList'
import Auth0UserBinding from './pages/Auth0UserBinding'
import SupplierDashboard from './pages/SupplierDashboard'
import SupplierManage from './pages/SupplierManage'
import { initMenuSettings } from './utils/menuSettings'
import { AuthProvider, useAuth } from './contexts/AuthContext'
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
        <Route path="/tms/service-providers" element={<ServiceProviders />} />
        <Route path="/tms/pricing" element={<TransportPricing />} />
        <Route path="/tms/conditions" element={<TMSConditions />} />
        <Route path="/cmr-manage" element={<CMRManage />} />
        <Route path="/cmr-manage/delivering" element={<CMRManage />} />
        <Route path="/cmr-manage/exception" element={<CMRManage />} />
        <Route path="/cmr-manage/archived" element={<CMRManage />} />
        <Route path="/cmr-manage/:id" element={<CMRBillDetails />} />
        <Route path="/last-mile" element={<LastMile />} />
        <Route path="/system" element={<SystemManageDashboard />} />
        <Route path="/system/menu-settings" element={<MenuSettings />} />
        <Route path="/system/user-manage" element={<UserManage />} />
        <Route path="/system/user-manage/permissions" element={<RolePermissions />} />
        <Route path="/system/user-binding" element={<Auth0UserBinding />} />
        <Route path="/system/security-settings" element={<SecuritySettings />} />
        <Route path="/system/security-settings/logs" element={<SecuritySettings />} />
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
        <Route path="/system/approvals" element={<ApprovalList />} />
        {/* 供应商管理模块 */}
        <Route path="/suppliers" element={<SupplierDashboard />} />
        <Route path="/suppliers/list" element={<SupplierManage />} />
        <Route path="/tools" element={<ToolsDashboard />} />
        <Route path="/tools/inquiry" element={<Inquiry />} />
        <Route path="/tools/tariff-calculator" element={<TariffCalculator />} />
        <Route path="/tools/payment" element={<PaymentInvoice />} />
        <Route path="/tools/address" element={<AddressTax />} />
        <Route path="/tools/commodity-code" element={<CommodityCode />} />
        <Route path="/tools/productCare" element={<ProductCategory />} />
        <Route path="/tools/editable-table" element={<EditableTableDemo />} />
        <Route path="/tools/components-demo" element={<ComponentsDemo />} />
        {/* CRM 客户关系管理 */}
        <Route path="/crm" element={<CRMDashboard />} />
        <Route path="/crm/customers" element={<CRMCustomers />} />
        <Route path="/crm/customers/:id" element={<CRMCustomerDetail />} />
        <Route path="/crm/opportunities" element={<CRMOpportunities />} />
        <Route path="/crm/quotations" element={<CRMQuotations />} />
        <Route path="/crm/contracts" element={<CRMContracts />} />
        <Route path="/crm/feedbacks" element={<CRMFeedbacks />} />
        {/* 财务管理 */}
        <Route path="/finance" element={<FinanceDashboard />} />
        <Route path="/finance/invoices" element={<FinanceInvoices />} />
        <Route path="/finance/invoices/create" element={<CreateInvoice />} />
        <Route path="/finance/invoices/:id" element={<FinanceInvoices />} />
        <Route path="/finance/payments" element={<FinancePayments />} />
        <Route path="/finance/fees" element={<FinanceFees />} />
        <Route path="/finance/reports" element={<FinanceReports />} />
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
                <AppRoutes />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

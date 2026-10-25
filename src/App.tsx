import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const VendorsPage = lazy(() => import('./pages/vendors/VendorsPage'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const InventoryMovementsPage = lazy(() => import('./pages/inventory/InventoryMovementsPage'));
const BatchesPage = lazy(() => import('./pages/inventory/BatchesPage'));
const EmployeesPage = lazy(() => import('./pages/payroll/EmployeesPage'));
const PayrollRunsPage = lazy(() => import('./pages/payroll/PayrollRunsPage'));
const PosPage = lazy(() => import('./pages/pos/PosPage'));
const CorporateTaxPage = lazy(() => import('./pages/tax/CorporateTaxPage'));
const EInvoicingPage = lazy(() => import('./pages/tax/EInvoicingPage'));
const QuotationsPage = lazy(() => import('./pages/sales/QuotationsPage'));
const SalesOrdersPage = lazy(() => import('./pages/sales/SalesOrdersPage'));
const DeliveryNotesPage = lazy(() => import('./pages/sales/DeliveryNotesPage'));
const SalesInvoicesPage = lazy(() => import('./pages/sales/SalesInvoicesPage'));
const SalesReturnsPage = lazy(() => import('./pages/sales/SalesReturnsPage'));
const CreditNotesPage = lazy(() => import('./pages/sales/CreditNotesPage'));
const SalesReceiptsPage = lazy(() => import('./pages/sales/ReceiptsPage'));
const RFQsPage = lazy(() => import('./pages/purchase/RFQsPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/purchase/PurchaseOrdersPage'));
const GRNsPage = lazy(() => import('./pages/purchase/GRNsPage'));
const PurchaseInvoicesPage = lazy(() => import('./pages/purchase/PurchaseInvoicesPage'));
const PurchaseReturnsPage = lazy(() => import('./pages/purchase/PurchaseReturnsPage'));
const DebitNotesPage = lazy(() => import('./pages/purchase/DebitNotesPage'));
const PurchasePaymentsPage = lazy(() => import('./pages/purchase/PaymentsPage'));
const ChartOfAccountsPage = lazy(() => import('./pages/accounts/ChartOfAccountsPage'));
const JournalPage = lazy(() => import('./pages/accounts/JournalPage'));
const TrialBalancePage = lazy(() => import('./pages/accounts/TrialBalancePage'));
const AccountsReceiptsPage = lazy(() => import('./pages/accounts/ReceiptsPage'));
const AccountsPaymentsPage = lazy(() => import('./pages/accounts/PaymentsPage'));
const ExpensesPage = lazy(() => import('./pages/accounts/ExpensesPage'));
const LedgersPage = lazy(() => import('./pages/accounts/LedgersPage'));
const BadDebtReliefPage = lazy(() => import('./pages/accounts/BadDebtReliefPage'));
const FinancialStatements = lazy(() => import('./pages/accounts/FinancialStatements'));
const AccountingPeriodsPage = lazy(() => import('./pages/accounts/AccountingPeriodsPage'));
const BankReconciliationPage = lazy(() => import('./pages/accounts/BankReconciliationPage'));
const VatReturnPage = lazy(() => import('./pages/accounts/VatReturnPage'));
const ExchangeRatesPage = lazy(() => import('./pages/accounts/ExchangeRatesPage'));
const RecurringJournalsPage = lazy(() => import('./pages/accounts/RecurringJournalsPage'));
const AccountLedgerPage = lazy(() => import('./pages/accounts/AccountLedgerPage'));
const AccountReportsPage = lazy(() => import('./pages/accounts/AccountReportsPage'));
const FixedAssetsPage = lazy(() => import('./pages/accounts/FixedAssetsPage'));
const StartupCapitalSetupPage = lazy(() => import('./pages/settings/StartupCapitalSetupPage'));
const AuditTrailPage = lazy(() => import('./pages/settings/AuditTrailPage'));
const CreditControlPage = lazy(() => import('./pages/credit-control/CreditControlPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const CompanySettingsPage = lazy(() => import('./pages/settings/CompanySettingsPage'));
const DocumentTemplatesPage = lazy(() => import('./pages/settings/DocumentTemplatesPage'));
const DocumentNotesPage = lazy(() => import('./pages/settings/DocumentNotesPage'));
const TermsPage = lazy(() => import('./pages/settings/TermsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const UsersRolesPage = lazy(() => import('./pages/settings/UsersRolesPage'));
const SecurityPage = lazy(() => import('./pages/settings/SecurityPage'));

const PageFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={PageFallback}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="settings/users" element={<UsersRolesPage />} />
        <Route path="settings/security" element={<SecurityPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="inventory/movements" element={<InventoryMovementsPage />} />
        <Route path="inventory/batches" element={<BatchesPage />} />
        <Route path="payroll/employees" element={<EmployeesPage />} />
        <Route path="payroll/runs" element={<PayrollRunsPage />} />
        <Route path="pos" element={<PosPage />} />
        <Route path="tax/corporate" element={<CorporateTaxPage />} />
        <Route path="tax/einvoicing" element={<EInvoicingPage />} />
        <Route path="sales/quotations" element={<QuotationsPage />} />
        <Route path="sales/orders" element={<SalesOrdersPage />} />
        <Route path="sales/delivery-notes" element={<DeliveryNotesPage />} />
        <Route path="sales/invoices" element={<SalesInvoicesPage />} />
        <Route path="sales/returns" element={<SalesReturnsPage />} />
        <Route path="sales/credit-notes" element={<CreditNotesPage />} />
        <Route path="sales/receipts" element={<SalesReceiptsPage />} />
        <Route path="purchase/rfqs" element={<RFQsPage />} />
        <Route path="purchase/orders" element={<PurchaseOrdersPage />} />
        <Route path="purchase/grns" element={<GRNsPage />} />
        <Route path="purchase/invoices" element={<PurchaseInvoicesPage />} />
        <Route path="purchase/returns" element={<PurchaseReturnsPage />} />
        <Route path="purchase/debit-notes" element={<DebitNotesPage />} />
        <Route path="purchase/payments" element={<PurchasePaymentsPage />} />
        <Route path="accounts/chart" element={<ChartOfAccountsPage />} />
        <Route path="accounts/journal" element={<JournalPage />} />
        <Route path="accounts/trial-balance" element={<TrialBalancePage />} />
        <Route path="accounts/financial-statements" element={<FinancialStatements />} />
        <Route path="accounts/periods" element={<AccountingPeriodsPage />} />
        <Route path="accounts/bank-reconciliation" element={<BankReconciliationPage />} />
        <Route path="accounts/vat-return" element={<VatReturnPage />} />
        <Route path="accounts/exchange-rates" element={<ExchangeRatesPage />} />
        <Route path="accounts/recurring-journals" element={<RecurringJournalsPage />} />
        <Route path="accounts/ledger/:accountId" element={<AccountLedgerPage />} />
        <Route path="accounts/receipts" element={<AccountsReceiptsPage />} />
        <Route path="accounts/payments" element={<AccountsPaymentsPage />} />
        <Route path="accounts/expenses" element={<ExpensesPage />} />
        <Route path="accounts/fixed-assets" element={<FixedAssetsPage />} />
        <Route path="accounts/reports" element={<AccountReportsPage />} />
        <Route path="accounts/ledgers" element={<LedgersPage />} />
        <Route path="accounts/bad-debt-relief" element={<BadDebtReliefPage />} />
        <Route path="credit-control" element={<CreditControlPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings/company" element={<CompanySettingsPage />} />
        <Route path="settings/templates" element={<DocumentTemplatesPage />} />
        <Route path="settings/notes" element={<DocumentNotesPage />} />
        <Route path="settings/terms" element={<TermsPage />} />
        <Route path="settings/startup-setup" element={<StartupCapitalSetupPage />} />
        <Route path="settings/audit-trail" element={<AuditTrailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

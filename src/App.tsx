import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import ClientLayout from "@/components/layouts/ClientLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import SpecialistLayout from "@/components/layouts/SpecialistLayout";
import Dashboard from "@/pages/Dashboard";
import Approvals from "@/pages/Approvals";
import Billing from "@/pages/Billing";
import ClientSettings from "@/pages/ClientSettings";
import AdminClients from "@/pages/admin/AdminClients";
import AdminClientDetail from "@/pages/admin/AdminClientDetail";
import AdminTasks from "@/pages/admin/AdminTasks";
import AdminBilling from "@/pages/admin/AdminBilling";
import AdminSpecialists from "@/pages/admin/AdminSpecialists";
import AdminSpecialistDetail from "@/pages/admin/AdminSpecialistDetail";
import AdminEscalations from "@/pages/admin/AdminEscalations";
import AdminPerformance from "@/pages/admin/AdminPerformance";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import SpecialistTasks from "@/pages/specialist/SpecialistTasks";
import SpecialistClients from "@/pages/specialist/SpecialistClients";
import SpecialistTimeLogs from "@/pages/specialist/SpecialistTimeLogs";
import TaskDetail from "@/pages/TaskDetail";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Client routes */}
            <Route element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/settings" element={<ClientSettings />} />
              <Route path="/tasks/:taskId" element={<TaskDetail />} />
            </Route>
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

            {/* Specialist routes */}
            <Route element={<ProtectedRoute requiredRole="specialist"><SpecialistLayout /></ProtectedRoute>}>
              <Route path="/specialist/tasks" element={<SpecialistTasks />} />
              <Route path="/specialist/tasks/:taskId" element={<TaskDetail />} />
              <Route path="/specialist/clients" element={<SpecialistClients />} />
              <Route path="/specialist/time-logs" element={<SpecialistTimeLogs />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/clients" element={<AdminClients />} />
              <Route path="/admin/clients/:clientId" element={<AdminClientDetail />} />
              <Route path="/admin/specialists" element={<AdminSpecialists />} />
              <Route path="/admin/specialists/:specialistId" element={<AdminSpecialistDetail />} />
              <Route path="/admin/tasks" element={<AdminTasks />} />
              <Route path="/admin/tasks/:taskId" element={<TaskDetail />} />
              <Route path="/admin/escalations" element={<AdminEscalations />} />
              <Route path="/admin/billing" element={<AdminBilling />} />
              <Route path="/admin/performance" element={<AdminPerformance />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

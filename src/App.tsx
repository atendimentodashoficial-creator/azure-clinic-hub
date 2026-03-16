import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import { RoleRedirector } from "@/components/RoleRedirector";
import Layout from "./pages/Layout";
import ClienteLayout from "./pages/ClienteLayout";
import FuncionarioLayout from "./pages/FuncionarioLayout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Configuracoes from "./pages/Configuracoes";
import AdminWhatsApp from "./pages/AdminWhatsApp";
import MetricasCampanhas from "./pages/MetricasCampanhas";
import GoogleAdsMetrics from "./pages/GoogleAdsMetrics";
import Disparos from "./pages/Disparos";
import Extrator from "./pages/Extrator";
import Instagram from "./pages/Instagram";
import Formularios from "./pages/Formularios";
import FormularioCaptura from "./pages/FormularioCaptura";
import FormularioCliente from "./pages/FormularioCliente";
import FormularioPublico from "./pages/FormularioPublico";
import Reunioes from "./pages/Reunioes";
import GoogleCalendarCallback from "./pages/GoogleCalendarCallback";
import ConfigurarPaineis from "./pages/ConfigurarPaineis";
import Tarefas from "./pages/Tarefas";
import TarefasClientes from "./pages/TarefasClientes";
import TarefasClienteDetalhes from "./pages/TarefasClienteDetalhes";
import Equipe from "./pages/Equipe";
import EquipeMembroDetalhes from "./pages/EquipeMembroDetalhes";
import ProdutosTarefas from "./pages/ProdutosTarefas";
import ClienteDashboard from "./pages/ClienteDashboard";
import ClienteAprovacoes from "./pages/ClienteAprovacoes";
import ClienteTarefas from "./pages/ClienteTarefas";
import ClienteProduto from "./pages/ClienteProduto";
import FuncionarioDashboard from "./pages/FuncionarioDashboard";
import FuncionarioEscala from "./pages/FuncionarioEscala";
import FuncionarioWhatsApp from "./pages/FuncionarioWhatsApp";
import FuncionarioReunioes from "./pages/FuncionarioReunioes";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import FuncionarioFinanceiro from "./pages/FuncionarioFinanceiro";
import AdminHomeDashboard from "./pages/AdminHomeDashboard";

import AprovacaoMockup from "./pages/AprovacaoMockup";
import AprovacaoInterna from "./pages/AprovacaoInterna";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/google-calendar/callback" element={<GoogleCalendarCallback />} />
          <Route path="/formulario/:templateId" element={<FormularioPublico />} />
          <Route path="/formularioig/:formSlug" element={<FormularioCaptura />} />
          <Route path="/cliente-form/:clienteId" element={<FormularioCliente />} />
          <Route path="/aprovacao/:token" element={<AprovacaoMockup />} />
          <Route path="/aprovacao-interna/:token" element={<AprovacaoInterna />} />

          {/* Root: redirect based on role */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRedirector />
              </ProtectedRoute>
            }
          />

          {/* Admin Panel */}
          <Route
            path="/admin"
            element={
              <RoleProtectedRoute allowedRoles={["admin"]}>
                <Layout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={<AdminWhatsApp />} />
            <Route path="whatsapp" element={<AdminWhatsApp />} />
            <Route path="whatsapp" element={<AdminWhatsApp />} />
            <Route path="disparos" element={<Disparos />} />
            <Route path="extrator" element={<Extrator />} />
            <Route path="instagram" element={<Instagram />} />
            <Route path="formularios" element={<Formularios />} />
            <Route path="reunioes" element={<Reunioes />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="metricas-campanhas" element={<MetricasCampanhas />} />
            <Route path="google-ads" element={<GoogleAdsMetrics />} />
            <Route path="paineis" element={<ConfigurarPaineis />} />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="tarefas-clientes" element={<TarefasClientes />} />
            <Route path="tarefas-clientes/:id" element={<TarefasClienteDetalhes />} />
            
            <Route path="equipe" element={<Equipe />} />
            <Route path="equipe/:id" element={<EquipeMembroDetalhes />} />
            <Route path="produtos-tarefas" element={<ProdutosTarefas />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          {/* Cliente Panel */}
          <Route
            path="/cliente"
            element={
              <RoleProtectedRoute allowedRoles={["cliente"]}>
                <ClienteLayout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={<ClienteDashboard />} />
            <Route path="tarefas" element={<ClienteTarefas />} />
            <Route path="agendamentos" element={<ClienteDashboard />} />
            <Route path="aprovacoes" element={<ClienteAprovacoes />} />
            <Route path="produto/:produtoId" element={<ClienteProduto />} />
          </Route>

          {/* Funcionario Panel */}
          <Route
            path="/funcionario"
            element={
              <RoleProtectedRoute allowedRoles={["funcionario"]}>
                <FuncionarioLayout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={<FuncionarioDashboard />} />
            
            <Route path="whatsapp" element={<FuncionarioWhatsApp />} />
            <Route path="reunioes" element={<FuncionarioReunioes />} />
            <Route path="escala" element={<FuncionarioEscala />} />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="financeiro" element={<FuncionarioFinanceiro />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

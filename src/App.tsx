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
import Leads from "./pages/Leads";
import Clientes from "./pages/Clientes";
import ClienteDetalhes from "./pages/ClienteDetalhes";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Agenda from "./pages/Agenda";
import Configuracoes from "./pages/Configuracoes";
import Faturas from "./pages/Faturas";
import Despesas from "./pages/Despesas";
import EmNegociacao from "./pages/EmNegociacao";
import AdminWhatsApp from "./pages/AdminWhatsApp";
import NaoCompareceu from "./pages/NaoCompareceu";
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
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import ConfigurarPaineis from "./pages/ConfigurarPaineis";
import Tarefas from "./pages/Tarefas";
import TarefasClientes from "./pages/TarefasClientes";
import Equipe from "./pages/Equipe";
import ProdutosTarefas from "./pages/ProdutosTarefas";
import ClienteDashboard from "./pages/ClienteDashboard";
import FuncionarioDashboard from "./pages/FuncionarioDashboard";
import FuncionarioEscala from "./pages/FuncionarioEscala";
import FuncionarioWhatsApp from "./pages/FuncionarioWhatsApp";
import FuncionarioReunioes from "./pages/FuncionarioReunioes";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import FuncionarioFinanceiro from "./pages/FuncionarioFinanceiro";
import TiposTarefas from "./pages/TiposTarefas";

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
            <Route index element={<Agenda />} />
            <Route path="nao-compareceu" element={<NaoCompareceu />} />
            <Route path="relatorios" element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhes />} />
            <Route path="em-negociacao" element={<EmNegociacao />} />
            <Route path="faturas" element={<Faturas />} />
            <Route path="despesas" element={<Despesas />} />
            <Route path="whatsapp" element={<AdminWhatsApp />} />
            <Route path="disparos" element={<Disparos />} />
            <Route path="extrator" element={<Extrator />} />
            <Route path="instagram" element={<Instagram />} />
            <Route path="formularios" element={<Formularios />} />
            <Route path="reunioes" element={<Reunioes />} />
            <Route path="financeiro" element={<AdminFinanceiro />} />
            <Route path="metricas-campanhas" element={<MetricasCampanhas />} />
            <Route path="google-ads" element={<GoogleAdsMetrics />} />
            <Route path="usuarios" element={<GerenciarUsuarios />} />
            <Route path="paineis" element={<ConfigurarPaineis />} />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="tarefas-clientes" element={<TarefasClientes />} />
            <Route path="tipos-tarefas" element={<TiposTarefas />} />
            <Route path="equipe" element={<Equipe />} />
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
            <Route path="agendamentos" element={<ClienteDashboard />} />
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

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';

const LandingPage = lazy(() => import('./components/pages/LandingPage'));
const LoginPage = lazy(() => import('./components/pages/LoginPage'));
const RegisterPage = lazy(() => import('./components/pages/RegisterPage'));
const AuthCallback = lazy(() => import('./components/pages/AuthCallback'));
const Dashboard = lazy(() => import('./components/pages/Dashboard').then(module => ({ default: module.Dashboard })));
const TickerIntelligence = lazy(() => import('./components/pages/TickerIntelligence').then(module => ({ default: module.TickerIntelligence })));
const FactorExplorer = lazy(() => import('./components/pages/FactorExplorer').then(module => ({ default: module.FactorExplorer })));
const ModelLab = lazy(() => import('./components/pages/ModelLab').then(module => ({ default: module.ModelLab })));
const ExperimentManager = lazy(() => import('./components/pages/ExperimentManager').then(module => ({ default: module.ExperimentManager })));
const SignalDiagnostics = lazy(() => import('./components/pages/SignalDiagnostics').then(module => ({ default: module.SignalDiagnostics })));
const StrategyBacktest = lazy(() => import('./components/pages/StrategyBacktest').then(module => ({ default: module.StrategyBacktest })));
const PortfolioLab = lazy(() => import('./components/pages/PortfolioLab').then(module => ({ default: module.PortfolioLab })));
const RiskPerformance = lazy(() => import('./components/pages/RiskPerformance').then(module => ({ default: module.RiskPerformance })));
const SentimentAnalyzer = lazy(() => import('./components/pages/SentimentAnalyzer').then(module => ({ default: module.SentimentAnalyzer })));
const Settings = lazy(() => import('./components/pages/Settings').then(module => ({ default: module.Settings })));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ticker-intelligence" element={
              <ProtectedRoute>
                <Layout>
                  <TickerIntelligence />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/factor-explorer" element={
              <ProtectedRoute>
                <Layout>
                  <FactorExplorer />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/model-lab" element={
              <ProtectedRoute>
                <Layout>
                  <ModelLab />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/experiments" element={
              <ProtectedRoute>
                <Layout>
                  <ExperimentManager />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/signal-diagnostics" element={
              <ProtectedRoute>
                <Layout>
                  <SignalDiagnostics />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/strategy-backtest" element={
              <ProtectedRoute>
                <Layout>
                  <StrategyBacktest />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/portfolio-lab" element={
              <ProtectedRoute>
                <Layout>
                  <PortfolioLab />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/risk-performance" element={
              <ProtectedRoute>
                <Layout>
                  <RiskPerformance />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/sentiment" element={
              <ProtectedRoute>
                <Layout>
                  <SentimentAnalyzer />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } />
            </Routes>
          </Suspense>
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      Loading...
    </div>
  );
}
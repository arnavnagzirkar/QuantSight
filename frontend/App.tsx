import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';
import LandingPage from './components/pages/LandingPage';
import LoginPage from './components/pages/LoginPage';
import RegisterPage from './components/pages/RegisterPage';
import AuthCallback from './components/pages/AuthCallback';
import { Dashboard } from './components/pages/Dashboard';
import { TickerIntelligence } from './components/pages/TickerIntelligence';
import { FactorExplorer } from './components/pages/FactorExplorer';
import { ModelLab } from './components/pages/ModelLab';
import { ExperimentManager } from './components/pages/ExperimentManager';
import { SignalDiagnostics } from './components/pages/SignalDiagnostics';
import { StrategyBacktest } from './components/pages/StrategyBacktest';
import { PortfolioLab } from './components/pages/PortfolioLab';
import { RiskPerformance } from './components/pages/RiskPerformance';
import { SentimentAnalyzer } from './components/pages/SentimentAnalyzer';
import { Settings } from './components/pages/Settings';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
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
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
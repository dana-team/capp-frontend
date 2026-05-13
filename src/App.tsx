import React, { useLayoutEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { NamespaceProvider } from '@/context/NamespaceContext';
import { LoginPage } from '@/pages/LoginPage';
import { CappListPage } from '@/pages/CappListPage';
import { CreateCappPage } from '@/pages/CreateCappPage';
import { EditCappPage } from '@/pages/EditCappPage';
import { CappDetailPage } from '@/pages/CappDetailPage';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { ConfigMapListPage } from '@/pages/ConfigMapListPage';
import { ConfigMapDetailPage } from '@/pages/ConfigMapDetailPage';
import { CreateConfigMapPage } from '@/pages/CreateConfigMapPage';
import { EditConfigMapPage } from '@/pages/EditConfigMapPage';
import { SecretListPage } from '@/pages/SecretListPage';
import { SecretDetailPage } from '@/pages/SecretDetailPage';
import { CreateSecretPage } from '@/pages/CreateSecretPage';
import { EditSecretPage } from '@/pages/EditSecretPage';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <NamespaceProvider>
      <AppShell />
    </NamespaceProvider>
  );
};

const App: React.FC = () => {
  const dark = useThemeStore((s) => s.dark);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/capps" replace />} />
          <Route path="/capps" element={<CappListPage />} />
          <Route path="/capps/new" element={<CreateCappPage />} />
          <Route path="/capps/:namespace/:name" element={<CappDetailPage />} />
          <Route path="/capps/:namespace/:name/edit" element={<EditCappPage />} />
          <Route path="/configmaps" element={<ConfigMapListPage />} />
          <Route path="/configmaps/new" element={<CreateConfigMapPage />} />
          <Route path="/configmaps/:namespace/:name" element={<ConfigMapDetailPage />} />
          <Route path="/configmaps/:namespace/:name/edit" element={<EditConfigMapPage />} />
          <Route path="/secrets" element={<SecretListPage />} />
          <Route path="/secrets/new" element={<CreateSecretPage />} />
          <Route path="/secrets/:namespace/:name" element={<SecretDetailPage />} />
          <Route path="/secrets/:namespace/:name/edit" element={<EditSecretPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

import React from 'react';
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
import { ConfigMapListPage } from '@/pages/ConfigMapListPage';
import { ConfigMapDetailPage } from '@/pages/ConfigMapDetailPage';
import { CreateConfigMapPage } from '@/pages/CreateConfigMapPage';
import { EditConfigMapPage } from '@/pages/EditConfigMapPage';

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

        </Route>
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

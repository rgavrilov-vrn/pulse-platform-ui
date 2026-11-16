import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegistryPage } from './pages/RegistryPage';
import { AuditPage } from './pages/AuditPage';
import { VideoServersPage } from './pages/VideoServersPage';
import { VideoServerDetailsPage } from './pages/VideoServerDetailsPage';
import { ObjectReportsPage } from './pages/ObjectReportsPage';
import { CatalogAdminPage } from './pages/CatalogAdminPage';
import { TrassirEventsPage } from './pages/TrassirEventsPage';
import { TrassirAuditPage } from './pages/TrassirAuditPage';
import { TrassirIngestLogPage } from './pages/TrassirIngestLogPage';
import { AuthProvider, useAuthContext } from './auth/AuthContext';

function AppRoutes() {
    const { user } = useAuthContext();
    return <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={user ? <RegistryPage /> : <Navigate to="/login" replace />} />
        <Route path="/audit" element={user ? <AuditPage /> : <Navigate to="/login" replace />} />
        <Route path="/reports/objects" element={user ? <ObjectReportsPage /> : <Navigate to="/login" replace />} />
        <Route path="/catalog" element={user ? <CatalogAdminPage /> : <Navigate to="/login" replace />} />
        <Route path="/video-servers" element={user ? <VideoServersPage /> : <Navigate to="/login" replace />} />
        <Route path="/video-servers/:serverId" element={user ? <VideoServerDetailsPage /> : <Navigate to="/login" replace />} />

        <Route path="/trassir/events" element={user ? <TrassirEventsPage /> : <Navigate to="/login" replace />} />
        <Route path="/trassir/audit" element={user ? <TrassirAuditPage /> : <Navigate to="/login" replace />} />
        <Route path="/trassir/ingest-log" element={user ? <TrassirIngestLogPage /> : <Navigate to="/login" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>;
}
export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }
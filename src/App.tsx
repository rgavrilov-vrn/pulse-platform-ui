import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegistryPage } from './pages/RegistryPage';
import { AuditPage } from './pages/AuditPage';
import { VideoServersPage } from './pages/VideoServersPage';
import { VideoServerDetailsPage } from './pages/VideoServerDetailsPage';
import { AuthProvider, useAuthContext } from './auth/AuthContext';

function AppRoutes() {
    const { user } = useAuthContext();
    return <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={user ? <RegistryPage /> : <Navigate to="/login" replace />} />
        <Route path="/audit" element={user ? <AuditPage /> : <Navigate to="/login" replace />} />
        <Route path="/video-servers" element={user ? <VideoServersPage /> : <Navigate to="/login" replace />} />
        <Route path="/video-servers/:serverId" element={user ? <VideoServerDetailsPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>;
}
export default function App() { return <AuthProvider><AppRoutes /></AuthProvider>; }

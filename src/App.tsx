import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegistryPage } from './pages/RegistryPage';
import { AuditPage } from './pages/AuditPage';
import { AuthProvider, useAuthContext } from './auth/AuthContext';

function AppRoutes() {
    const { user } = useAuthContext();
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={user ? <RegistryPage /> : <Navigate to="/login" replace />} />
            <Route path="/audit" element={user ? <AuditPage /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return <AuthProvider><AppRoutes /></AuthProvider>;
}

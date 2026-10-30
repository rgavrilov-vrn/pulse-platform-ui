import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export function AuditPage() {
    return (
        <>
            <Header />
            <div className="app-body">
                <Sidebar />
                <main className="workspace">
                    <div className="page-heading">
                        <div>
                            <div className="breadcrumb-line">Ситуационный центр <span>/</span> Аудит</div>
                            <h1>Аудит</h1>
                        </div>
                    </div>
                    <section className="panel" aria-labelledby="audit-title" style={{ flex: 1, padding: 24 }}>
                        <h2 id="audit-title">Журнал аудита</h2>
                        <div className="empty-state">
                            <strong>Раздел в разработке</strong>
                            <p>Источник данных аудита пока не подключён.</p>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
}

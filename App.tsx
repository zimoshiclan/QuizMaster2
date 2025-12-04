import React, { useState } from 'react';
import { AppView } from './types';
import { Dashboard } from './components/Dashboard';
import { Scanner } from './components/Scanner';
import { StudentList } from './components/StudentList';
import { StudentDetail } from './components/StudentDetail';
import { PublishGuide } from './components/PublishGuide';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    setCurrentView(AppView.STUDENT_DETAIL);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard />;
      case AppView.SCANNER:
        return <Scanner onCancel={() => setCurrentView(AppView.DASHBOARD)} onSuccess={() => setCurrentView(AppView.DASHBOARD)} />;
      case AppView.STUDENTS:
        return <StudentList onSelectStudent={handleStudentSelect} />;
      case AppView.STUDENT_DETAIL:
        return selectedStudentId ? (
          <StudentDetail studentId={selectedStudentId} onBack={() => setCurrentView(AppView.STUDENTS)} />
        ) : (
          <StudentList onSelectStudent={handleStudentSelect} />
        );
      case AppView.PUBLISH_GUIDE:
        return <PublishGuide onBack={() => setCurrentView(AppView.DASHBOARD)} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 flex flex-col overflow-hidden relative shadow-2xl">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        {renderView()}
      </main>

      {/* Navigation - Only show if not in full-screen Scanner/Detail modes */}
      {currentView !== AppView.SCANNER && currentView !== AppView.STUDENT_DETAIL && currentView !== AppView.PUBLISH_GUIDE && (
        <nav className="absolute bottom-6 left-6 right-6 h-16 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-around z-50">
          <button 
            onClick={() => setCurrentView(AppView.DASHBOARD)}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${currentView === AppView.DASHBOARD ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-icons-round">dashboard</span>
          </button>

          {/* Floating Action Button for Scan */}
          <button 
            onClick={() => setCurrentView(AppView.SCANNER)}
            className="-mt-8 w-16 h-16 bg-brand-600 rounded-full shadow-lg shadow-brand-500/40 flex items-center justify-center text-white hover:scale-105 transition-transform"
          >
            <span className="material-icons-round text-3xl">document_scanner</span>
          </button>

          <button 
            onClick={() => setCurrentView(AppView.STUDENTS)}
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${currentView === AppView.STUDENTS ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <span className="material-icons-round">people</span>
          </button>
        </nav>
      )}

      {/* Help Link on Dashboard */}
      {currentView === AppView.DASHBOARD && (
        <button 
          onClick={() => setCurrentView(AppView.PUBLISH_GUIDE)}
          className="absolute top-8 right-6 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-colors"
        >
          <span className="material-icons-round">help_outline</span>
        </button>
      )}
    </div>
  );
};

export default App;

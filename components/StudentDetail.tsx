import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Student, QuizRecord } from '../types';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface StudentDetailProps {
  studentId: string;
  onBack: () => void;
}

export const StudentDetail: React.FC<StudentDetailProps> = ({ studentId, onBack }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const students = await StorageService.getStudents();
        const foundStudent = students.find(s => s.id === studentId);
        setStudent(foundStudent || null);
        
        if (foundStudent) {
          const hist = await StorageService.getStudentHistory(studentId);
          setHistory(hist);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  const handleDelete = async () => {
    if (deleteCode !== '12345') {
      setDeleteError('Incorrect code. Please enter 12345.');
      return;
    }
    
    setIsDeleting(true);
    try {
      await StorageService.deleteStudent(studentId);
      setIsDeleteModalOpen(false);
      onBack(); // Return to list after successful deletion
    } catch (err) {
      console.error(err);
      setDeleteError('Failed to delete student.');
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Loading...</div>;
  if (!student) return <div className="h-full flex items-center justify-center">Student not found</div>;

  // Prepare chart data
  const chartData = history.map(h => ({
    date: h.date,
    percentage: Math.round((h.score / h.totalMarks) * 100),
    subject: h.subject
  })).reverse(); // Oldest first for chart

  const average = history.length > 0 
    ? Math.round(history.reduce((acc, curr) => acc + (curr.score / curr.totalMarks) * 100, 0) / history.length)
    : 0;

  return (
    <div className="h-full bg-slate-50 pb-24 animate-fade-in relative">
      <header className="px-6 pt-8 pb-4 sticky top-0 bg-slate-50 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-full">
            <span className="material-icons-round">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-slate-900">Student Profile</h1>
        </div>
        <button 
          onClick={() => {
             setIsDeleteModalOpen(true);
             setDeleteCode('');
             setDeleteError('');
          }}
          className="p-2 mr-[-8px] text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Delete Student"
        >
          <span className="material-icons-round">delete_outline</span>
        </button>
      </header>

      <div className="px-6 mb-8">
        <div className="flex flex-col items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="w-24 h-24 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-4xl font-bold mb-4">
            {student.name.charAt(0)}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{student.name}</h2>
          <p className="text-slate-500 text-sm mb-4">Joined {new Date(student.joinedAt).toLocaleDateString()}</p>
          
          <div className="grid grid-cols-2 gap-8 w-full border-t border-slate-100 pt-4">
            <div className="text-center">
              <span className="block text-2xl font-bold text-slate-800">{history.length}</span>
              <span className="text-xs text-slate-500 uppercase">Quizzes</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-bold text-green-600">{average}%</span>
              <span className="text-xs text-slate-500 uppercase">Avg Score</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8">
        <h3 className="font-bold text-slate-800 mb-4">Performance Trend</h3>
        <div className="h-48 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip />
              <Area type="monotone" dataKey="percentage" stroke="#ec4899" fillOpacity={1} fill="url(#colorScore)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="px-6">
        <h3 className="font-bold text-slate-800 mb-4">Quiz History</h3>
        <div className="space-y-3">
          {history.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">{record.subject}</p>
                <p className="text-xs text-slate-500">{record.date}</p>
              </div>
              <div className="text-right">
                <span className="block text-lg font-bold text-brand-600">
                  {record.score} <span className="text-xs text-slate-400 font-normal">/ {record.totalMarks}</span>
                </span>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-center text-slate-400 py-4">No records found</p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-3">
                        <span className="material-icons-round text-3xl">warning_amber</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Delete Student?</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        This will permanently delete <strong>{student.name}</strong> and all their quiz records. This action cannot be undone.
                    </p>
                </div>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        Enter Code to Confirm
                    </label>
                    <input 
                        type="tel" 
                        pattern="[0-9]*"
                        placeholder="12345"
                        className="w-full p-3 border border-slate-200 rounded-xl text-center text-2xl font-bold tracking-widest focus:ring-2 focus:ring-red-500 outline-none text-slate-800"
                        value={deleteCode}
                        onChange={(e) => {
                            setDeleteCode(e.target.value);
                            setDeleteError('');
                        }}
                    />
                    {deleteError && (
                        <p className="text-red-500 text-xs mt-2 text-center font-bold flex items-center justify-center gap-1">
                             <span className="material-icons-round text-sm">error</span>
                             {deleteError}
                        </p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={() => {
                            setIsDeleteModalOpen(false);
                            setDeleteCode('');
                        }}
                        className="flex-1 py-3 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 py-3 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-600/30 transition-all flex justify-center items-center"
                    >
                        {isDeleting ? <span className="material-icons-round animate-spin">refresh</span> : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
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
    <div className="h-full bg-slate-50 pb-24 animate-fade-in">
      <header className="px-6 pt-8 pb-4 sticky top-0 bg-slate-50 z-10 flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-full">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold text-slate-900">Student Profile</h1>
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
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip />
              <Area type="monotone" dataKey="percentage" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" />
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
    </div>
  );
};

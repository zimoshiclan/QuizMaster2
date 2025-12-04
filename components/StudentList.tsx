import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Student } from '../types';

interface StudentListProps {
  onSelectStudent: (id: string) => void;
}

export const StudentList: React.FC<StudentListProps> = ({ onSelectStudent }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await StorageService.getStudents();
        setStudents(data);
      } catch (error) {
        console.error("Error fetching students", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full bg-slate-50 pb-24 animate-fade-in">
      <header className="px-6 pt-8 pb-4 sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">Students</h1>
        <div className="relative">
          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input 
            type="text" 
            placeholder="Search students..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
          />
        </div>
      </header>

      <div className="px-6 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading students...</div>
        ) : filteredStudents.length > 0 ? (
          filteredStudents.map(student => (
            <button 
              key={student.id}
              onClick={() => onSelectStudent(student.id)}
              className="w-full text-left p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 text-brand-600 flex items-center justify-center font-bold text-lg">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{student.name}</h3>
                  <p className="text-xs text-slate-500">ID: {student.id.substring(0,6)}</p>
                </div>
              </div>
              <span className="material-icons-round text-slate-300">chevron_right</span>
            </button>
          ))
        ) : (
          <div className="text-center py-12">
            <span className="material-icons-round text-6xl text-slate-200 mb-4">school</span>
            <p className="text-slate-500">No students found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

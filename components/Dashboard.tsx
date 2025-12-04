import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../services/storage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { QuizRecord, Stats } from '../types';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentQuizzes, setRecentQuizzes] = useState<QuizRecord[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedStats, loadedQuizzes] = await Promise.all([
          StorageService.getStats(),
          StorageService.getQuizzes()
        ]);
        setStats(loadedStats);
        setQuizzes(loadedQuizzes);
        setRecentQuizzes(loadedQuizzes.slice(-5).reverse());
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  // Prepare chart data: Average score per subject
  const chartData = useMemo(() => {
    if (quizzes.length === 0) return [];
    
    const subjectStats: Record<string, { total: number; count: number }> = {};
    
    quizzes.forEach(q => {
      if (!subjectStats[q.subject]) {
        subjectStats[q.subject] = { total: 0, count: 0 };
      }
      subjectStats[q.subject].total += (q.score / q.totalMarks) * 100;
      subjectStats[q.subject].count += 1;
    });

    return Object.keys(subjectStats).map(subject => ({
      name: subject,
      score: Math.round(subjectStats[subject].total / subjectStats[subject].count)
    }));
  }, [quizzes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="flex flex-col items-center">
           <span className="material-icons-round text-4xl animate-spin mb-2">refresh</span>
           <p>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-fade-in">
      <header className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Class Performance Overview</p>
      </header>

      {/* Highest Scorer Card */}
      <div className="px-6">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-xl shadow-brand-900/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 text-brand-100">
              <span className="material-icons-round text-lg">emoji_events</span>
              <span className="text-sm font-semibold uppercase tracking-wider">Top Performer</span>
            </div>
            {stats && stats.highestScorer ? (
              <>
                <h3 className="text-3xl font-bold mb-1">{stats.highestScorer.name}</h3>
                <p className="text-brand-100 text-lg">
                  {stats.highestScorer.score} Marks in {stats.highestScorer.subject}
                </p>
              </>
            ) : (
              <p className="text-xl font-medium opacity-80">No data available yet</p>
            )}
          </div>
          {/* Decor */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 px-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">Total Quizzes</p>
          <p className="text-2xl font-bold text-slate-800">{stats?.totalQuizzes || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm mb-1">Class Average</p>
          <p className="text-2xl font-bold text-slate-800">{Math.round(stats?.averageScore || 0)}%</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="px-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Subject Performance</h3>
        <div className="h-64 bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No chart data
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Scans</h3>
        <div className="space-y-3">
          {recentQuizzes.length > 0 ? recentQuizzes.map(quiz => (
            <div key={quiz.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                  {quiz.studentName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{quiz.studentName}</p>
                  <p className="text-xs text-slate-500">{quiz.subject} • {quiz.date}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="block font-bold text-brand-600">{quiz.score}/{quiz.totalMarks}</span>
              </div>
            </div>
          )) : (
            <p className="text-slate-500 text-center py-4">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
};

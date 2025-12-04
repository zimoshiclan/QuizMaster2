export interface Student {
  id: string;
  name: string;
  joinedAt: string;
}

export interface QuizRecord {
  id: string;
  studentId: string;
  studentName: string; // Denormalized for easier display
  subject: string;
  score: number;
  totalMarks: number;
  date: string;
  timestamp: number;
  imageUrl?: string; // Optional: store base64 thumbnail
}

export interface Stats {
  totalQuizzes: number;
  averageScore: number;
  highestScorer: {
    name: string;
    score: number;
    subject: string;
  } | null;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  SCANNER = 'SCANNER',
  STUDENTS = 'STUDENTS',
  STUDENT_DETAIL = 'STUDENT_DETAIL',
  PUBLISH_GUIDE = 'PUBLISH_GUIDE'
}

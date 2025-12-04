import { Student, QuizRecord, Stats } from '../types';

const DB_NAME = 'QuizMasterDB';
const DB_VERSION = 1;
const STORE_STUDENTS = 'students';
const STORE_QUIZZES = 'quizzes';

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// IndexedDB Helpers
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_STUDENTS)) {
        db.createObjectStore(STORE_STUDENTS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_QUIZZES)) {
        const store = db.createObjectStore(STORE_QUIZZES, { keyPath: 'id' });
        store.createIndex('studentId', 'studentId', { unique: false });
      }
    };
  });
};

const getAll = <T>(storeName: string): Promise<T[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
};

const put = <T>(storeName: string, data: T): Promise<T> => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
};

export const StorageService = {
  getStudents: async (): Promise<Student[]> => {
    return getAll<Student>(STORE_STUDENTS);
  },

  getQuizzes: async (): Promise<QuizRecord[]> => {
    return getAll<QuizRecord>(STORE_QUIZZES);
  },

  addQuiz: async (data: Omit<QuizRecord, 'id' | 'timestamp' | 'studentId'>): Promise<QuizRecord> => {
    const students = await StorageService.getStudents();
    
    // Normalize input name (trim whitespace)
    const inputName = data.studentName.trim();
    
    // Check if student exists (case-insensitive match)
    let student = students.find(s => s.name.trim().toLowerCase() === inputName.toLowerCase());
    let studentId = student?.id;

    if (!student) {
      // Create new student if not found
      studentId = generateId();
      student = {
        id: studentId,
        name: inputName,
        joinedAt: new Date().toISOString()
      };
      await put(STORE_STUDENTS, student);
    }

    const newQuiz: QuizRecord = {
      ...data,
      // Use the canonical name from the student record
      studentName: student!.name, 
      id: generateId(),
      studentId: studentId!,
      timestamp: Date.now(),
    };

    await put(STORE_QUIZZES, newQuiz);
    return newQuiz;
  },

  getStats: async (): Promise<Stats> => {
    const quizzes = await StorageService.getQuizzes();
    
    if (quizzes.length === 0) {
      return { totalQuizzes: 0, averageScore: 0, highestScorer: null };
    }

    const totalQuizzes = quizzes.length;
    
    // Calculate percentage average
    const totalPercentage = quizzes.reduce((acc, q) => acc + (q.score / q.totalMarks), 0);
    const averageScore = (totalPercentage / totalQuizzes) * 100;

    // Find highest scorer (based on percentage)
    const highest = quizzes.reduce((prev, current) => {
      const prevPct = prev.score / prev.totalMarks;
      const currPct = current.score / current.totalMarks;
      return (currPct > prevPct) ? current : prev;
    });

    return {
      totalQuizzes,
      averageScore,
      highestScorer: {
        name: highest.studentName,
        score: highest.score,
        subject: highest.subject
      }
    };
  },

  getStudentHistory: async (studentId: string): Promise<QuizRecord[]> => {
    const quizzes = await StorageService.getQuizzes();
    return quizzes
      .filter(q => q.studentId === studentId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
};

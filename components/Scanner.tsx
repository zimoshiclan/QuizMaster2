import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuizImage, gradeStudentPaper } from '../services/geminiService';
import { StorageService } from '../services/storage';
import { Student } from '../types';

interface ScannerProps {
  onCancel: () => void;
  onSuccess: () => void;
}

type ScanMode = 'EXTRACT' | 'GRADE';

export const Scanner: React.FC<ScannerProps> = ({ onCancel, onSuccess }) => {
  const [mode, setMode] = useState<ScanMode>('EXTRACT');
  const [image, setImage] = useState<string | null>(null); // Main image (Student paper)
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // For Auto-Grade
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load students for autocomplete
  useEffect(() => {
    StorageService.getStudents().then(setExistingStudents);
  }, []);
  
  // Edit State
  const [extractedData, setExtractedData] = useState<{
    studentName: string;
    score: number;
    totalMarks: number;
    subject: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        
        if (mode === 'EXTRACT') {
          setImage(base64);
          const base64Data = base64.split(',')[1];
          processExtraction(base64Data);
        } else {
          // Auto-Grade Mode logic
          if (!referenceImage) {
            setReferenceImage(base64);
          } else {
            setImage(base64);
            const refData = referenceImage.split(',')[1];
            const studentData = base64.split(',')[1];
            processGrading(refData, studentData);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processExtraction = async (base64Data: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const data = await analyzeQuizImage(base64Data);
      setExtractedData(data);
    } catch (err) {
      setError("Failed to analyze image. Please ensure the score is visible.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processGrading = async (refData: string, studentData: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const data = await gradeStudentPaper(refData, studentData);
      setExtractedData(data);
    } catch (err) {
      setError("Failed to grade paper. Ensure both images are clear.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (extractedData) {
      setIsSaving(true);
      try {
        await StorageService.addQuiz({
          studentName: extractedData.studentName,
          score: extractedData.score,
          totalMarks: extractedData.totalMarks,
          subject: extractedData.subject,
          date: new Date().toISOString().split('T')[0],
          imageUrl: image || undefined
        });
        onSuccess();
      } catch (err) {
        setError("Failed to save record.");
        setIsSaving(false);
      }
    }
  };

  const handleRetake = () => {
    setImage(null);
    setReferenceImage(null);
    setExtractedData(null);
    setError(null);
  };

  // Helper text based on state
  const getPromptText = () => {
    if (mode === 'EXTRACT') return "Take a photo of a graded paper with visible marks.";
    if (!referenceImage) return "Step 1: Take a photo of the Question Paper or Answer Key.";
    return "Step 2: Take a photo of the Student's Answer Sheet.";
  };

  if (image && extractedData) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Review {mode === 'GRADE' ? 'Grading' : 'Results'}</h2>
        
        <div className="mb-6 rounded-xl overflow-hidden shadow-lg border border-slate-200 relative group">
           <img src={image} alt="Student Paper" className="w-full h-48 object-cover" />
           {referenceImage && (
             <div className="absolute top-2 right-2 w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-md">
               <img src={referenceImage} alt="Key" className="w-full h-full object-cover" />
             </div>
           )}
        </div>

        <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Student Name</label>
            <input 
              type="text" 
              list="student-names"
              value={extractedData.studentName}
              onChange={(e) => setExtractedData({...extractedData, studentName: e.target.value})}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Enter student name"
            />
            <datalist id="student-names">
              {existingStudents.map(student => (
                <option key={student.id} value={student.name} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-500 mb-1">Score</label>
              <input 
                type="number" 
                value={extractedData.score}
                onChange={(e) => setExtractedData({...extractedData, score: Number(e.target.value)})}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-500 mb-1">Total</label>
              <input 
                type="number" 
                value={extractedData.totalMarks}
                onChange={(e) => setExtractedData({...extractedData, totalMarks: Number(e.target.value)})}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Subject</label>
            <input 
              type="text" 
              value={extractedData.subject}
              onChange={(e) => setExtractedData({...extractedData, subject: e.target.value})}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-auto flex gap-3 pt-6">
          <button 
            onClick={handleRetake}
            className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
          >
            Retake
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isSaving ? (
              <span className="material-icons-round animate-spin">refresh</span>
            ) : (
              'Save Record'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white relative">
      {/* Mode Switcher */}
      {!isProcessing && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center px-6">
          <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl flex w-full max-w-xs">
            <button 
              onClick={() => { setMode('EXTRACT'); handleRetake(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'EXTRACT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Scan Score
            </button>
            <button 
              onClick={() => { setMode('GRADE'); handleRetake(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'GRADE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Auto-Grade
            </button>
          </div>
        </div>
      )}

      {/* Camera UI Simulation */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {isProcessing ? (
          <div className="flex flex-col items-center animate-pulse">
            <span className="material-icons-round text-6xl text-brand-400 mb-4 animate-spin">smart_toy</span>
            <p className="text-xl font-medium">AI is Thinking...</p>
            <p className="text-slate-400 text-sm mt-2">
              {mode === 'GRADE' ? 'Comparing answers to key...' : 'Extracting marks from paper...'}
            </p>
          </div>
        ) : (
          <>
            <span className="material-icons-round text-6xl text-slate-500 mb-6">
              {mode === 'GRADE' && !referenceImage ? 'assignment' : 'document_scanner'}
            </span>
            <h2 className="text-2xl font-bold mb-2">
              {mode === 'GRADE' && !referenceImage ? 'Scan Answer Key' : (mode === 'GRADE' ? 'Scan Student Paper' : 'Scan Quiz Paper')}
            </h2>
            <p className="text-slate-400 max-w-xs mx-auto mb-8 min-h-[3rem]">
              {getPromptText()}
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-brand-500/20 group"
            >
              <div className="w-16 h-16 bg-brand-500 rounded-full group-hover:bg-brand-600 transition-colors flex items-center justify-center">
                <span className="material-icons-round text-white text-3xl">camera_alt</span>
              </div>
            </button>
          </>
        )}
        
        {error && (
          <div className="mt-6 p-4 bg-red-500/20 text-red-200 rounded-xl border border-red-500/50 flex items-center gap-2">
            <span className="material-icons-round">error</span>
            {error}
          </div>
        )}
      </div>
      
      {!isProcessing && (
        <button 
          onClick={onCancel}
          className="absolute top-6 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40"
        >
          <span className="material-icons-round">close</span>
        </button>
      )}
    </div>
  );
};

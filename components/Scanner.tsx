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
  const [image, setImage] = useState<string | null>(null);
  
  // Grading specific state
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [skipReference, setSkipReference] = useState(false);
  
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

  const processImage = (file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600; 
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = height * (MAX_WIDTH / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
          }
          
          // Image enhancement for better OCR
          ctx.filter = 'contrast(1.25) brightness(1.1) saturate(1.1)';
          ctx.drawImage(img, 0, 0, width, height);
          ctx.filter = 'none';
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          const base64 = dataUrl.split(',')[1];
          
          resolve({ base64, mimeType: 'image/jpeg', dataUrl });
        };
        img.onerror = () => reject(new Error("Failed to load image"));
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      setError(null);
      
      try {
        const processed = await processImage(file);
        
        if (mode === 'EXTRACT') {
          setImage(processed.dataUrl);
          await processExtraction(processed.base64, processed.mimeType);
        } else {
          // GRADE MODE
          if (!referenceImage && !skipReference) {
            // This is the reference image
            setReferenceImage(processed.dataUrl);
            // Don't process yet, wait for student paper
            setIsProcessing(false); 
          } else {
            // This is the student paper
            setImage(processed.dataUrl);
            
            const studentInput = { base64: processed.base64, mimeType: processed.mimeType };
            let refInput = null;
            
            if (referenceImage) {
                 const refBase64 = referenceImage.split(',')[1];
                 refInput = { base64: refBase64, mimeType: 'image/jpeg' };
            }
            
            await processGrading(refInput, studentInput);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Failed to process image.");
        setIsProcessing(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processExtraction = async (base64Data: string, mimeType: string) => {
    try {
      const data = await analyzeQuizImage({ base64: base64Data, mimeType });
      setExtractedData(data);
    } catch (err: any) {
      handleApiError(err);
      setExtractedData({ studentName: "Unknown", score: 0, totalMarks: 100, subject: "Quiz" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processGrading = async (refInput: { base64: string, mimeType: string } | null, studentInput: { base64: string, mimeType: string }) => {
    try {
      const data = await gradeStudentPaper(refInput, studentInput);
      setExtractedData(data);
    } catch (err: any) {
      handleApiError(err);
      setExtractedData({ studentName: "Unknown", score: 0, totalMarks: 10, subject: "General" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleApiError = (err: any) => {
    console.error("API Error:", err);
    if (err.message?.includes("API key")) {
      setError("API Key Error. Please check your setup.");
    } else if (err.message?.includes("403")) {
      setError("Access Denied. Check API permissions.");
    } else {
      setError("Analysis failed. Please try again.");
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
        // On success, we don't close immediately in grade mode to allow next student
        if (mode === 'GRADE') {
             // Reset student data but keep reference
             setExtractedData(null);
             setImage(null);
             setIsSaving(false);
             // Show success toast or small indicator?
             // For now just reset
        } else {
            onSuccess();
        }
      } catch (err) {
        setError("Failed to save record.");
        setIsSaving(false);
      }
    }
  };

  const handleRetakeAll = () => {
    setImage(null);
    setReferenceImage(null);
    setSkipReference(false);
    setExtractedData(null);
    setError(null);
  };

  const handleNextStudent = () => {
    // Keep referenceImage and skipReference settings
    setImage(null);
    setExtractedData(null);
    setError(null);
    setIsSaving(false);
  };

  if (image && extractedData) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-4 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Review {mode === 'GRADE' ? 'Grading' : 'Results'}</h2>
        
        <div className="mb-6 rounded-xl overflow-hidden shadow-lg border border-slate-200 relative group bg-black">
           <img src={image} alt="Student Paper" className="w-full h-48 object-contain opacity-90" />
           {referenceImage && (
             <div className="absolute top-2 right-2 w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-md bg-black">
               <img src={referenceImage} alt="Key" className="w-full h-full object-cover" />
             </div>
           )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
            <span className="material-icons-round text-base">warning</span>
            {error}
          </div>
        )}

        <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Student Name</label>
            <input 
              type="text" 
              list="student-names"
              value={extractedData.studentName}
              onChange={(e) => setExtractedData({...extractedData, studentName: e.target.value})}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <datalist id="student-names">
              {existingStudents.map(student => <option key={student.id} value={student.name} />)}
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

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <div className="flex gap-3">
             <button 
                onClick={handleRetakeAll}
                className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
             >
                Reset All
             </button>
             <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
             >
                {isSaving ? <span className="material-icons-round animate-spin">refresh</span> : (mode === 'GRADE' ? 'Save & Next Student' : 'Save Record')}
             </button>
          </div>
          {mode === 'GRADE' && (
             <p className="text-center text-xs text-slate-400">
               Clicking 'Save & Next' keeps the answer key for the next student.
             </p>
          )}
        </div>
      </div>
    );
  }

  // Helper to determine step message
  const getStepMessage = () => {
      if (mode === 'EXTRACT') return "Take a photo of a graded paper with visible marks.";
      if (referenceImage || skipReference) return "Take a photo of the Student's Answer Sheet.";
      return "Step 1: Take a photo of the Answer Key.";
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white relative">
      {!isProcessing && (
        <div className="absolute top-16 left-0 right-0 z-10 flex justify-center px-6">
          <div className="bg-white/10 backdrop-blur-md p-1 rounded-2xl flex w-full max-w-xs">
            <button 
              onClick={() => { setMode('EXTRACT'); handleRetakeAll(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'EXTRACT' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Scan Score
            </button>
            <button 
              onClick={() => { setMode('GRADE'); handleRetakeAll(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'GRADE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:text-white'}`}
            >
              Auto-Grade
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {isProcessing ? (
          <div className="flex flex-col items-center animate-pulse">
            <span className="material-icons-round text-6xl text-brand-400 mb-4 animate-spin">smart_toy</span>
            <p className="text-xl font-medium">AI is Grading...</p>
            <p className="text-slate-400 text-sm mt-2">Running advanced analysis...</p>
          </div>
        ) : (
          <>
            <span className="material-icons-round text-6xl text-slate-500 mb-6">
              {mode === 'GRADE' && !referenceImage && !skipReference ? 'assignment_turned_in' : 'document_scanner'}
            </span>
            <h2 className="text-2xl font-bold mb-2">
              {mode === 'GRADE' && !referenceImage && !skipReference ? 'Scan Answer Key' : (mode === 'GRADE' ? 'Scan Student Paper' : 'Scan Quiz Paper')}
            </h2>
            <p className="text-slate-400 max-w-xs mx-auto mb-8 min-h-[3rem]">
              {getStepMessage()}
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
              className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-brand-500/20 group relative z-20"
            >
              <div className="w-16 h-16 bg-brand-500 rounded-full group-hover:bg-brand-600 transition-colors flex items-center justify-center">
                <span className="material-icons-round text-white text-3xl">camera_alt</span>
              </div>
            </button>
            
            {/* Alternative Action for Grade Mode (Step 1) */}
            {mode === 'GRADE' && !referenceImage && !skipReference && (
                <button 
                  onClick={() => setSkipReference(true)}
                  className="mt-8 py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition-colors"
                >
                  Skip Key (AI Auto-Grade)
                </button>
            )}

            {/* Reset Actions */}
            {mode === 'GRADE' && (referenceImage || skipReference) && !error && (
               <button onClick={handleRetakeAll} className="mt-8 text-sm text-slate-400 underline hover:text-white transition-colors">
                 Reset Grading Session
               </button>
            )}
          </>
        )}
        
        {error && (
          <div className="mt-6 flex flex-col items-center gap-4">
             <div className="p-4 bg-red-500/20 text-red-200 rounded-xl border border-red-500/50 flex items-center gap-2 max-w-sm mx-auto text-left">
              <span className="material-icons-round">error</span>
              <span className="text-sm">{error}</span>
            </div>
            <button 
              onClick={handleRetakeAll}
              className="px-6 py-2 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors"
            >
              Try Again
            </button>
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
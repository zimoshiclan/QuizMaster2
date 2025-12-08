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
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [existingStudents, setExistingStudents] = useState<Student[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  
  // Load students & Check API Key
  useEffect(() => {
    StorageService.getStudents().then(setExistingStudents);
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = async () => {
    // 1. Check process.env (Standard)
    if (process.env.API_KEY && process.env.API_KEY.length > 0) {
      setApiKeyReady(true);
      return;
    }

    // 2. Check AI Studio Environment
    // @ts-ignore
    if (typeof window !== 'undefined' && window.aistudio && window.aistudio.hasSelectedApiKey) {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (hasKey) {
        setApiKeyReady(true);
      } else {
        setApiKeyReady(false);
        // Automatically prompt once
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // Check again after a short delay in case user selected it
        setTimeout(async () => {
             // @ts-ignore
            const recheck = await window.aistudio.hasSelectedApiKey();
            if (recheck) setApiKeyReady(true);
        }, 1000);
      }
    } else {
      // If no AI Studio object and no env var, we assume it's missing but let the user try (fallback)
      // or we can set it to false to force them to configure if we had a manual input.
      // Since we don't have manual input, we default to true to allow the "API_KEY_MISSING" error to catch it later if it really fails,
      // but showing a warning is better.
      setApiKeyReady(false);
    }
  };

  const handleConnectApi = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        checkApiKeyStatus();
    } else {
        setError("API Key not found. Please set 'API_KEY' in your environment variables.");
    }
  };
  
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
          if (!referenceImage) {
            setReferenceImage(processed.dataUrl);
            setIsProcessing(false);
          } else {
            setImage(processed.dataUrl);
            const refBase64 = referenceImage.split(',')[1];
            await processGrading(refBase64, processed.base64);
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
      // Fallback
      setExtractedData({ studentName: "Unknown", score: 0, totalMarks: 100, subject: "Quiz" });
    } finally {
      setIsProcessing(false);
    }
  };

  const processGrading = async (refData: string, studentData: string) => {
    try {
      const data = await gradeStudentPaper(
        { base64: refData, mimeType: 'image/jpeg' }, 
        { base64: studentData, mimeType: 'image/jpeg' }
      );
      setExtractedData(data);
    } catch (err: any) {
      handleApiError(err);
      setExtractedData({ studentName: "Check Name", score: 0, totalMarks: 10, subject: "General" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleApiError = (err: any) => {
    console.error("API Error:", err);
    if (err.message === "API_KEY_MISSING" || err.toString().includes("API key")) {
      setError("API Key Missing. Please click 'Connect Service' or check settings.");
      setApiKeyReady(false); // Force UI update
    } else if (err.message?.includes("403")) {
      setError("Access Denied (403). API Key may be invalid.");
    } else {
      setError(`Analysis failed: ${err.message || 'Unknown error'}`);
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

  const handleRetakeAll = () => {
    setImage(null);
    setReferenceImage(null);
    setExtractedData(null);
    setError(null);
  };

  const handleRetakeStudent = () => {
    setImage(null);
    setExtractedData(null);
    setError(null);
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

        <div className="mt-auto flex gap-3 pt-6">
          <button 
            onClick={handleRetakeAll}
            className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-300 transition-colors"
          >
            New Scan
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 px-4 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isSaving ? <span className="material-icons-round animate-spin">refresh</span> : 'Save Record'}
          </button>
        </div>
      </div>
    );
  }

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
              {mode === 'GRADE' && !referenceImage ? 'assignment' : 'document_scanner'}
            </span>
            <h2 className="text-2xl font-bold mb-2">
              {mode === 'GRADE' && !referenceImage ? 'Scan Answer Key' : (mode === 'GRADE' ? 'Scan Student Paper' : 'Scan Quiz Paper')}
            </h2>
            <p className="text-slate-400 max-w-xs mx-auto mb-8 min-h-[3rem]">
              {mode === 'EXTRACT' ? "Take a photo of a graded paper with visible marks." : 
               (!referenceImage ? "Step 1: Take a photo of the Answer Key." : "Step 2: Take a photo of the Student's Answer Sheet.")}
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            {!apiKeyReady ? (
               <button 
                 onClick={handleConnectApi}
                 className="px-6 py-4 bg-brand-600 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 flex items-center gap-2"
               >
                 <span className="material-icons-round">vpn_key</span>
                 Connect AI Service
               </button>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center hover:scale-105 transition-transform shadow-xl shadow-brand-500/20 group"
              >
                <div className="w-16 h-16 bg-brand-500 rounded-full group-hover:bg-brand-600 transition-colors flex items-center justify-center">
                  <span className="material-icons-round text-white text-3xl">camera_alt</span>
                </div>
              </button>
            )}

            {mode === 'GRADE' && referenceImage && !error && apiKeyReady && (
               <button onClick={handleRetakeAll} className="mt-8 text-sm text-slate-400 underline">
                 Reset Answer Key
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
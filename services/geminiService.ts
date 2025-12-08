import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  // Directly use the environment variable. 
  // We trust the environment or the build system to provide process.env.API_KEY.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Simplified Schema
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    studentName: { type: Type.STRING },
    score: { type: Type.NUMBER },
    totalMarks: { type: Type.NUMBER },
    subject: { type: Type.STRING },
  },
  required: ["studentName", "score", "totalMarks", "subject"],
};

interface ImageInput {
  base64: string;
  mimeType: string;
}

// ROBUST JSON EXTRACTOR
const extractJson = (text: string) => {
  try {
    // Remove markdown code blocks if present
    let clean = text.trim();
    clean = clean.replace(/```json/g, '').replace(/```/g, '');
    
    // Find the first opening brace and last closing brace
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse failed:", text);
    throw new Error("AI response was not valid JSON. Please try again.");
  }
};

export const analyzeQuizImage = async (image: ImageInput): Promise<{
  studentName: string;
  score: number;
  totalMarks: number;
  subject: string;
}> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Upgraded model for better OCR/Reasoning
      contents: {
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          { text: "Extract the student name, score, total marks, and subject. CRITICAL: If the 'total marks' are not explicitly written, you MUST calculate the total by summing the max points of all visible questions. If the score is missing, count the ticks/marks. Return raw JSON." },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    if (!response.text) throw new Error("No response text");
    return extractJson(response.text);
  } catch (error) {
    console.error("Analysis Error:", error);
    throw error;
  }
};

export const gradeStudentPaper = async (reference: ImageInput | null, student: ImageInput): Promise<{
  studentName: string;
  score: number;
  totalMarks: number;
  subject: string;
}> => {
  const ai = getAiClient();

  try {
    const parts = [];
    let promptText = "";

    if (reference) {
        // Mode 1: Reference Key Available
        parts.push({ inlineData: { mimeType: reference.mimeType, data: reference.base64 } });
        parts.push({ text: "This is the ANSWER KEY." });
        parts.push({ inlineData: { mimeType: student.mimeType, data: student.base64 } });
        promptText = `This is the STUDENT ANSWER SHEET.
            
            TASK: Grade the student paper against the answer key.
            
            CRITICAL STEPS:
            1. Identify the Student Name and Subject.
            2. Compare every answer on the student sheet with the key.
            3. Count the points for correct answers to get the 'score'.
            4. IMPORTANT: Calculate 'totalMarks' by summing the points of ALL questions on the quiz (even if the student got them wrong).
            
            OUTPUT:
            Return a purely JSON object with keys: studentName, score, totalMarks, subject.
            `;
    } else {
        // Mode 2: No Key (AI Knowledge)
        parts.push({ inlineData: { mimeType: student.mimeType, data: student.base64 } });
        promptText = `This is a STUDENT QUIZ PAPER.
            
            TASK: Auto-grade this quiz based on your general knowledge.
            
            CRITICAL STEPS:
            1. Read the questions and the student's handwritten answers.
            2. Verify if answers are correct.
            3. Calculate 'score' by summing points for correct answers.
            4. IMPORTANT: Calculate 'totalMarks' by summing the max points of ALL visible questions.
            5. Extract Student Name and Subject.
            
            OUTPUT:
            Return a purely JSON object with keys: studentName, score, totalMarks, subject.
            `;
    }
    
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    if (!response.text) throw new Error("No response text");
    return extractJson(response.text);

  } catch (error) {
    console.error("Grading Error:", error);
    throw error;
  }
};
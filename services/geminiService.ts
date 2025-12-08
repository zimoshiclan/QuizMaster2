import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
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
          { text: "Extract the student name, score, total marks, and subject from this quiz paper. If the handwriting is messy, make a best guess. Return raw JSON only. Do not use markdown." },
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

export const gradeStudentPaper = async (reference: ImageInput, student: ImageInput): Promise<{
  studentName: string;
  score: number;
  totalMarks: number;
  subject: string;
}> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Upgraded model
      contents: {
        parts: [
          { inlineData: { mimeType: reference.mimeType, data: reference.base64 } },
          { text: "This is the ANSWER KEY." },
          { inlineData: { mimeType: student.mimeType, data: student.base64 } },
          { 
            text: `This is the STUDENT ANSWER SHEET.
            
            TASK: Grade the student paper against the answer key.
            
            STEPS:
            1. Identify the Student Name and Subject from the answer sheet.
            2. Compare every answer on the student sheet with the key.
            3. Count the correct answers (ticks) or points.
            4. Calculate the final score.
            
            OUTPUT:
            Return a purely JSON object with keys: studentName, score, totalMarks, subject.
            Do not include markdown formatting.
            ` 
          },
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
    console.error("Grading Error:", error);
    throw error;
  }
};
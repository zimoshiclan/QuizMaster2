import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }
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
// This regex specifically looks for a JSON object structure even if there is text around it.
const extractJson = (text: string) => {
  try {
    // 1. Try standard parse first (after simple cleanup)
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '').replace(/```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```/, '').replace(/```$/, '');
    
    return JSON.parse(clean);
  } catch (e) {
    // 2. Fallback: Regex extraction of the main object
    console.log("JSON Parse failed, attempting Regex extraction...");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error("Could not extract valid JSON from response");
      }
    }
    throw new Error("No JSON found in response");
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
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          { text: "Extract the student name, score, total marks, and subject from this quiz paper. Return JSON." },
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
    // Using gemini-2.5-flash for speed and reliability with direct OCR instructions
    // We explicitly ask it to TRANSFORM image to text first implicitly by asking for analysis
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          { inlineData: { mimeType: reference.mimeType, data: reference.base64 } },
          { text: "This is the ANSWER KEY." },
          { inlineData: { mimeType: student.mimeType, data: student.base64 } },
          { 
            text: `This is the STUDENT ANSWER SHEET.
            
            TASK: Perform Optical Character Recognition (OCR) and Grading.
            1. Read the Student Name and Subject.
            2. For every question, recognize the student's handwritten answer (look for ticks '✓', circles, or written text).
            3. Compare with the Answer Key.
            4. Calculate the Final Score.
            
            IMPORTANT:
            - If handwriting is messy or lighting is dim, make your best guess based on the position of the marks.
            - If a tick is visible near an option, count it as the selected answer.
            - Return the result in strict JSON format.` 
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
    throw new Error("Grading failed. Please ensure the paper is visible.");
  }
};
import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  // Allow the SDK to handle API key validation internally.
  // This prevents issues where the key might be injected by a bundler but not visible to a runtime check.
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
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '').replace(/```$/, '');
    else if (clean.startsWith('```')) clean = clean.replace(/^```/, '').replace(/```$/, '');
    return JSON.parse(clean);
  } catch (e) {
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
            1. **Convert Photo to Text**: Read the Student Name, Subject, and all handwritten answers.
            2. **Identify Marks**: Look specifically for ticks (✓), crosses (✗), or circled options.
            3. **Compare**: Match the student's answers against the Answer Key.
            4. **Calculate**: Compute the Score and Total Marks.
            
            IMPORTANT:
            - If the image is blurry or dark, use context to infer the answer position.
            - Trust the visual position of marks over faint text.
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
    throw error; // Let the caller handle the specific error message
  }
};
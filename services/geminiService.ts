import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  // Use the environment variable directly. 
  // We removed the strict throw to allow the environment's injection or the SDK's internal handling to work without interference.
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
          { text: "Extract the student name, score, total marks, and subject from this quiz paper. If the handwriting is messy, make a best guess. Return JSON." },
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
          { text: "This is the ANSWER KEY / QUESTION PAPER." },
          { inlineData: { mimeType: student.mimeType, data: student.base64 } },
          { 
            text: `This is the STUDENT ANSWER SHEET.
            
            TASK: Perform robust Optical Character Recognition (OCR) and Grading.
            
            STEPS:
            1. **Analyze Student Paper**: Identify the Student Name and Subject.
            2. **Read Answers**: For each question from the Answer Key, look for the corresponding answer on the Student Sheet.
               - Look for ticks (✓), crosses (✗), circled options, or written text.
               - If lighting is poor or contrast is low, focus on the heaviest ink marks.
            3. **Grade**: Compare the student's answer with the key.
            4. **Compute**: Sum up the obtained marks and total marks.
            
            OUTPUT:
            Return a JSON object with: studentName, score, totalMarks, subject.
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
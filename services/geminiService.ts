import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    studentName: {
      type: Type.STRING,
      description: "The name of the student. If not found, return 'Unknown Student'.",
    },
    score: {
      type: Type.NUMBER,
      description: "The calculated score based on correct answers.",
    },
    totalMarks: {
      type: Type.NUMBER,
      description: "The total possible marks for the quiz.",
    },
    subject: {
      type: Type.STRING,
      description: "The subject of the quiz.",
    },
  },
  required: ["studentName", "score", "totalMarks", "subject"],
};

interface ImageInput {
  base64: string;
  mimeType: string;
}

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
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.base64,
            },
          },
          {
            text: "Analyze this quiz paper image. Extract the student's name, the score obtained, the total possible score, and the subject. Be precise with handwriting.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
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
          {
            inlineData: {
              mimeType: reference.mimeType,
              data: reference.base64,
            },
          },
          {
            text: "This is the ANSWER KEY or QUESTION PAPER."
          },
          {
            inlineData: {
              mimeType: student.mimeType,
              data: student.base64,
            },
          },
          {
            text: "This is the STUDENT'S ANSWER SHEET. Task: 1. Identify the student name. 2. Compare the student's answers to the answer key/questions provided in the first image. 3. Grade the paper and calculate the total score based on correctness. 4. Determine total possible marks and subject.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Grading Error:", error);
    throw error;
  }
};
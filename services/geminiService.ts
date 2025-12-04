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
    // Using gemini-3-pro-preview for advanced reasoning required to compare two documents
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: reference.mimeType,
              data: reference.base64,
            },
          },
          {
            text: "Context: This is the ANSWER KEY / REFERENCE PAPER."
          },
          {
            inlineData: {
              mimeType: student.mimeType,
              data: student.base64,
            },
          },
          {
            text: "Context: This is the STUDENT'S ANSWER SHEET to be graded.\n\n" + 
                  "Task: \n" +
                  "1. Identify the student name from the second image.\n" +
                  "2. Compare the student's answers carefully against the answer key.\n" +
                  "3. Calculate the total score obtained based on correct answers.\n" +
                  "4. Determine the total possible marks.\n" +
                  "5. Identify the subject.\n\n" +
                  "Return ONLY the raw JSON object matching the schema."
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // Higher thinking budget for complex grading tasks if needed, but start with standard
        temperature: 0.1, // Lower temperature for more deterministic grading
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse failed. Raw text:", text);
      throw new Error("AI returned invalid data format.");
    }
  } catch (error) {
    console.error("Gemini Grading Error:", error);
    throw error;
  }
};
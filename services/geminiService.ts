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

// Helper to clean JSON string if model adds markdown blocks
const cleanJsonString = (str: string) => {
  if (!str) return "";
  let clean = str.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json/, '').replace(/```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```/, '').replace(/```$/, '');
  }
  return clean;
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

    return JSON.parse(cleanJsonString(text));
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
    // It is significantly better at vision tasks involving small details like ticks.
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
            text: `Context: This is the STUDENT'S ANSWER SHEET to be graded.
            
            CRITICAL INSTRUCTIONS FOR GRADING:
            1. **Visual Recognition**: Look specifically for handwritten ticks (✓), checkmarks, circles, or crosses that indicate the student's choice. 
            2. **Low Light Handling**: If the image is dim, shadowy, or low contrast, use context clues (like the position of pen marks relative to checkboxes/options) to determine the answer.
            3. **Ambiguity**: If a mark is faint, assume it is an answer if it aligns with an option.
            4. **Comparison**: Compare the student's marked answers against the provided Answer Key/Reference Paper.
            5. **Extraction**: Identify the Student Name and Subject clearly.
            
            Task:
            - Grade the paper.
            - Calculate the Score based on matches with the Key.
            - Determine the Total Marks.
            - Extract Student Name and Subject.
            
            Return ONLY the raw JSON object.`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1, // Lower temperature for deterministic grading
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response text from AI");

    try {
      return JSON.parse(cleanJsonString(text));
    } catch (parseError) {
      console.error("JSON Parse failed. Raw text:", text);
      throw new Error("AI returned invalid data format.");
    }
  } catch (error) {
    console.error("Gemini Grading Error:", error);
    throw error;
  }
};
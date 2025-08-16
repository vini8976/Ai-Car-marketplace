"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

// Serialize car data
function serializeCarData(car) {
  return {
    ...car.toObject(),
    price: car.price || 0,
    createdAt: car.createdAt?.toISOString(),
    updatedAt: car.updatedAt?.toISOString(),
  };
}

/**
 * Get featured cars for the homepage
 */
export async function getFeaturedCars(limit = 3) {
  try {
    await connectDB();

    const cars = await Car.find({
      featured: true,
      status: "AVAILABLE",
    })
      .sort({ createdAt: -1 }) // equivalent to orderBy desc
      .limit(limit);

    return cars.map(serializeCarData);
  } catch (error) {
    throw new Error("Error fetching featured cars: " + error.message);
  }
}

// File to base64
async function fileToBase64(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

/**
 * Process car image with Gemini AI
 */
export async function processImageSearch(file) {
  try {
    const req = await request();
    const decision = await aj.protect(req, { requested: 1 });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        throw new Error(
          `Too many requests. Remaining: ${remaining}, Reset in: ${reset}`
        );
      }
      throw new Error("Request blocked");
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const base64Image = await fileToBase64(file);

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };

    const prompt = `
      Analyze this car image and extract:
      1. Make (manufacturer)
      2. Body type (SUV, Sedan, Hatchback, etc.)
      3. Color
      {
        "make": "",
        "bodyType": "",
        "color": "",
        "confidence": 0.0
      }
    `;

    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const carDetails = JSON.parse(cleanedText);
      return { success: true, data: carDetails };
    } catch (parseError) {
      return {
        success: false,
        error: "Failed to parse AI response",
      };
    }
  } catch (error) {
    throw new Error("AI Search error: " + error.message);
  }
}

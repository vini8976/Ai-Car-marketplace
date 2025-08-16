"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@clerk/nextjs/server";
import { serializeCarData } from "@/lib/helpers";
import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import User from "@/models/User";

// ================= FILE → BASE64 =================
async function fileToBase64(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// ================= AI CAR PROCESSING ==============
export async function processCarImageWithAI(file) {
  try {
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
      Analyze this car image and extract details: make, model, year, color, bodyType,
      mileage, fuelType, transmission, price, description.
      Return ONLY JSON:
      {
        "make": "",
        "model": "",
        "year": 0000,
        "color": "",
        "price": "",
        "mileage": "",
        "bodyType": "",
        "fuelType": "",
        "transmission": "",
        "description": "",
        "confidence": 0.0
      }
    `;

    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    const carDetails = JSON.parse(cleanedText);
    return { success: true, data: carDetails };
  } catch (error) {
    console.error("AI error:", error);
    return { success: false, error: error.message };
  }
}

// ================= ADD CAR =================
export async function addCar({ carData, images }) {
  try {
    await connectDB();

    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const carId = uuidv4();
    const imageUrls = [];

    // TODO: Replace with Cloudinary / S3 image upload
    for (let i = 0; i < images.length; i++) {
      if (!images[i].startsWith("data:image/")) continue;
      imageUrls.push(images[i]); // storing base64 temporarily
    }

    const car = await Car.create({
      _id: carId,
      user: user._id, // reference to user
      make: carData.make,
      model: carData.model,
      year: carData.year,
      price: carData.price,
      mileage: carData.mileage,
      color: carData.color,
      fuelType: carData.fuelType,
      transmission: carData.transmission,
      bodyType: carData.bodyType,
      seats: carData.seats,
      description: carData.description,
      status: carData.status || "available",
      featured: carData.featured || false,
      images: imageUrls,
    });

    revalidatePath("/admin/cars");
    return { success: true, data: serializeCarData(car) };
  } catch (error) {
    console.error("Error adding car:", error);
    return { success: false, error: error.message };
  }
}

// ================= GET CARS =================
export async function getCars(search = "") {
  try {
    await connectDB();

    const query = search
      ? {
          $or: [
            { make: new RegExp(search, "i") },
            { model: new RegExp(search, "i") },
            { color: new RegExp(search, "i") },
          ],
        }
      : {};

    const cars = await Car.find(query).sort({ createdAt: -1 });
    return { success: true, data: cars.map((c) => serializeCarData(c)) };
  } catch (error) {
    console.error("Error fetching cars:", error);
    return { success: false, error: error.message };
  }
}

// ================= DELETE CAR =================
export async function deleteCar(id) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const car = await Car.findById(id);
    if (!car) return { success: false, error: "Car not found" };

    await Car.findByIdAndDelete(id);

    // TODO: Delete images from Cloudinary/S3
    revalidatePath("/admin/cars");

    return { success: true };
  } catch (error) {
    console.error("Error deleting car:", error);
    return { success: false, error: error.message };
  }
}

// ================= UPDATE CAR =================
export async function updateCarStatus(id, { status, featured }) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (featured !== undefined) updateData.featured = featured;

    await Car.findByIdAndUpdate(id, updateData, { new: true });

    revalidatePath("/admin/cars");
    return { success: true };
  } catch (error) {
    console.error("Error updating car status:", error);
    return { success: false, error: error.message };
  }
}

"use server";

import { serializeCarData } from "@/lib/helpers";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Car from "@/models/Car";
import UserSavedCar from "@/models/UserSavedCar";
import TestDriveBooking from "@/models/TestDriveBooking";
import DealershipInfo from "@/models/DealershipInfo";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Get simplified filters for the car marketplace
 */
export async function getCarFilters() {
  try {
    await connectDB();

    // Get unique makes, bodyTypes, fuelTypes, transmissions
    const makes = await Car.distinct("make", { status: "AVAILABLE" });
    const bodyTypes = await Car.distinct("bodyType", { status: "AVAILABLE" });
    const fuelTypes = await Car.distinct("fuelType", { status: "AVAILABLE" });
    const transmissions = await Car.distinct("transmission", { status: "AVAILABLE" });

    // Get min and max prices
    const priceAgg = await Car.aggregate([
      { $match: { status: "AVAILABLE" } },
      {
        $group: {
          _id: null,
          min: { $min: "$price" },
          max: { $max: "$price" },
        },
      },
    ]);

    return {
      success: true,
      data: {
        makes,
        bodyTypes,
        fuelTypes,
        transmissions,
        priceRange: {
          min: priceAgg.length ? priceAgg[0].min : 0,
          max: priceAgg.length ? priceAgg[0].max : 100000,
        },
      },
    };
  } catch (error) {
    throw new Error("Error fetching car filters: " + error.message);
  }
}

/**
 * Get cars with simplified filters
 */
export async function getCars({
  search = "",
  make = "",
  bodyType = "",
  fuelType = "",
  transmission = "",
  minPrice = 0,
  maxPrice = Number.MAX_SAFE_INTEGER,
  sortBy = "newest",
  page = 1,
  limit = 6,
}) {
  try {
    await connectDB();
    const { userId } = await auth();
    let dbUser = null;

    if (userId) {
      dbUser = await User.findOne({ clerkUserId: userId });
    }

    // Build query
    let query = { status: "AVAILABLE" };

    if (search) {
      query.$or = [
        { make: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (make) query.make = new RegExp(`^${make}$`, "i");
    if (bodyType) query.bodyType = new RegExp(`^${bodyType}$`, "i");
    if (fuelType) query.fuelType = new RegExp(`^${fuelType}$`, "i");
    if (transmission) query.transmission = new RegExp(`^${transmission}$`, "i");

    query.price = { $gte: parseFloat(minPrice) || 0 };
    if (maxPrice && maxPrice < Number.MAX_SAFE_INTEGER) {
      query.price.$lte = parseFloat(maxPrice);
    }

    // Sorting
    let sort = {};
    switch (sortBy) {
      case "priceAsc":
        sort = { price: 1 };
        break;
      case "priceDesc":
        sort = { price: -1 };
        break;
      case "newest":
      default:
        sort = { createdAt: -1 };
        break;
    }

    // Pagination
    const skip = (page - 1) * limit;
    const totalCars = await Car.countDocuments(query);
    const cars = await Car.find(query).sort(sort).skip(skip).limit(limit);

    // Wishlist check
    let wishlisted = new Set();
    if (dbUser) {
      const savedCars = await UserSavedCar.find({ userId: dbUser._id }).select("carId");
      wishlisted = new Set(savedCars.map((s) => s.carId.toString()));
    }

    const serializedCars = cars.map((car) =>
      serializeCarData(car.toObject(), wishlisted.has(car._id.toString()))
    );

    return {
      success: true,
      data: serializedCars,
      pagination: {
        total: totalCars,
        page,
        limit,
        pages: Math.ceil(totalCars / limit),
      },
    };
  } catch (error) {
    throw new Error("Error fetching cars: " + error.message);
  }
}

/**
 * Toggle car in user's wishlist
 */
export async function toggleSavedCar(carId) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const car = await Car.findById(carId);
    if (!car) return { success: false, error: "Car not found" };

    const existing = await UserSavedCar.findOne({ userId: user._id, carId });

    if (existing) {
      await UserSavedCar.deleteOne({ _id: existing._id });
      revalidatePath(`/saved-cars`);
      return { success: true, saved: false, message: "Car removed from favorites" };
    }

    await UserSavedCar.create({ userId: user._id, carId });
    revalidatePath(`/saved-cars`);
    return { success: true, saved: true, message: "Car added to favorites" };
  } catch (error) {
    throw new Error("Error toggling saved car: " + error.message);
  }
}

/**
 * Get car details by ID
 */
export async function getCarById(carId) {
  try {
    await connectDB();
    const { userId } = await auth();
    let dbUser = null;

    if (userId) {
      dbUser = await User.findOne({ clerkUserId: userId });
    }

    const car = await Car.findById(carId);
    if (!car) return { success: false, error: "Car not found" };

    let isWishlisted = false;
    if (dbUser) {
      const saved = await UserSavedCar.findOne({ userId: dbUser._id, carId });
      isWishlisted = !!saved;
    }

    const existingTestDrive = dbUser
      ? await TestDriveBooking.findOne({
          carId,
          userId: dbUser._id,
          status: { $in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        }).sort({ createdAt: -1 })
      : null;

    let userTestDrive = existingTestDrive
      ? {
          id: existingTestDrive._id,
          status: existingTestDrive.status,
          bookingDate: existingTestDrive.bookingDate.toISOString(),
        }
      : null;

    const dealership = await DealershipInfo.findOne().populate("workingHours");

    return {
      success: true,
      data: {
        ...serializeCarData(car.toObject(), isWishlisted),
        testDriveInfo: {
          userTestDrive,
          dealership: dealership
            ? {
                ...dealership.toObject(),
                createdAt: dealership.createdAt.toISOString(),
                updatedAt: dealership.updatedAt.toISOString(),
                workingHours: dealership.workingHours.map((h) => ({
                  ...h.toObject(),
                  createdAt: h.createdAt.toISOString(),
                  updatedAt: h.updatedAt.toISOString(),
                })),
              }
            : null,
        },
      },
    };
  } catch (error) {
    throw new Error("Error fetching car details: " + error.message);
  }
}

/**
 * Get user's saved cars
 */
export async function getSavedCars() {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) return { success: false, error: "User not found" };

    const savedCars = await UserSavedCar.find({ userId: user._id })
      .populate("car")
      .sort({ savedAt: -1 });

    const cars = savedCars.map((s) => serializeCarData(s.car.toObject()));
    return { success: true, data: cars };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

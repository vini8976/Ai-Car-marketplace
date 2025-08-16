"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import DealershipInfo from "@/models/DealershipInfo";
import WorkingHour from "@/models/WorkingHour";
import User from "@/models/User";
import connectDB from "@/lib/mongodb";

// Get dealership info with working hours
export async function getDealershipInfo() {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get the dealership record
    let dealership = await DealershipInfo.findOne().populate({
      path: "workingHours",
      options: { sort: { dayOfWeek: 1 } },
    });

    // If no dealership exists, create a default one
    if (!dealership) {
      dealership = await DealershipInfo.create({
        workingHours: [
          { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "18:00", isOpen: true },
          { dayOfWeek: "TUESDAY", openTime: "09:00", closeTime: "18:00", isOpen: true },
          { dayOfWeek: "WEDNESDAY", openTime: "09:00", closeTime: "18:00", isOpen: true },
          { dayOfWeek: "THURSDAY", openTime: "09:00", closeTime: "18:00", isOpen: true },
          { dayOfWeek: "FRIDAY", openTime: "09:00", closeTime: "18:00", isOpen: true },
          { dayOfWeek: "SATURDAY", openTime: "10:00", closeTime: "16:00", isOpen: true },
          { dayOfWeek: "SUNDAY", openTime: "10:00", closeTime: "16:00", isOpen: false },
        ],
      });
      await dealership.save();
    }

    return {
      success: true,
      data: {
        ...dealership.toObject(),
        createdAt: dealership.createdAt?.toISOString(),
        updatedAt: dealership.updatedAt?.toISOString(),
      },
    };
  } catch (error) {
    throw new Error("Error fetching dealership info: " + error.message);
  }
}

// Save working hours
export async function saveWorkingHours(workingHours) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Check if user is admin
    const user = await User.findOne({ clerkUserId: userId });
    if (!user || user.role !== "ADMIN") {
      throw new Error("Unauthorized: Admin access required");
    }

    // Get current dealership info
    const dealership = await DealershipInfo.findOne();
    if (!dealership) throw new Error("Dealership info not found");

    // Delete existing hours
    await WorkingHour.deleteMany({ dealershipId: dealership._id });

    // Insert new hours
    const newHours = workingHours.map((hour) => ({
      ...hour,
      dealershipId: dealership._id,
    }));
    await WorkingHour.insertMany(newHours);

    revalidatePath("/admin/settings");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    throw new Error("Error saving working hours: " + error.message);
  }
}

// Get all users
export async function getUsers() {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Check if user is admin
    const adminUser = await User.findOne({ clerkUserId: userId });
    if (!adminUser || adminUser.role !== "ADMIN") {
      throw new Error("Unauthorized: Admin access required");
    }

    // Fetch users
    const users = await User.find().sort({ createdAt: -1 });

    return {
      success: true,
      data: users.map((user) => ({
        ...user.toObject(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      })),
    };
  } catch (error) {
    throw new Error("Error fetching users: " + error.message);
  }
}

// Update user role
export async function updateUserRole(userId, role) {
  try {
    await connectDB();
    const { userId: adminId } = await auth();
    if (!adminId) throw new Error("Unauthorized");

    // Check if user is admin
    const adminUser = await User.findOne({ clerkUserId: adminId });
    if (!adminUser || adminUser.role !== "ADMIN") {
      throw new Error("Unauthorized: Admin access required");
    }

    // Update user role
    await User.findByIdAndUpdate(userId, { role });

    revalidatePath("/admin/settings");

    return { success: true };
  } catch (error) {
    throw new Error("Error updating user role: " + error.message);
  }
}

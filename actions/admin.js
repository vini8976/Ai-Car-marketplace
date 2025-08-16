"use server";

import { serializeCarData } from "@/lib/helpers";
import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import User from "@/models/User";
import TestDriveBooking from "@/models/TestDriveBooking";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

// ✅ Check admin
export async function getAdmin() {
  await connectDB();
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await User.findOne({ clerkUserId: userId });

  if (!user || user.role !== "ADMIN") {
    return { authorized: false, reason: "not-admin" };
  }

  return { authorized: true, user };
}

// ✅ Get all test drives (with filters)
export async function getAdminTestDrives({ search = "", status = "" }) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await User.findOne({ clerkUserId: userId });
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized access");

    // Build query
    let query = {};
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { "car.make": new RegExp(search, "i") },
        { "car.model": new RegExp(search, "i") },
        { "user.name": new RegExp(search, "i") },
        { "user.email": new RegExp(search, "i") },
      ];
    }

    // Populate car & user
    const bookings = await TestDriveBooking.find(query)
      .populate("car")
      .populate("user", "id name email imageUrl phone")
      .sort({ bookingDate: -1, startTime: 1 });

    const formattedBookings = bookings.map((booking) => ({
      id: booking._id.toString(),
      carId: booking.carId,
      car: serializeCarData(booking.car),
      userId: booking.userId,
      user: booking.user,
      bookingDate: booking.bookingDate.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    }));

    return { success: true, data: formattedBookings };
  } catch (error) {
    console.error("Error fetching test drives:", error);
    return { success: false, error: error.message };
  }
}

// ✅ Update test drive status
export async function updateTestDriveStatus(bookingId, newStatus) {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await User.findOne({ clerkUserId: userId });
    if (!user || user.role !== "ADMIN") throw new Error("Unauthorized access");

    const booking = await TestDriveBooking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
    ];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: "Invalid status" };
    }

    booking.status = newStatus;
    await booking.save();

    revalidatePath("/admin/test-drives");
    revalidatePath("/reservations");

    return { success: true, message: "Test drive status updated successfully" };
  } catch (error) {
    throw new Error("Error updating test drive status: " + error.message);
  }
}

// ✅ Dashboard data
export async function getDashboardData() {
  try {
    await connectDB();
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await User.findOne({ clerkUserId: userId });
    if (!user || user.role !== "ADMIN") {
      return { success: false, error: "Unauthorized" };
    }

    const [cars, testDrives] = await Promise.all([
      Car.find({}, { id: 1, status: 1, featured: 1 }),
      TestDriveBooking.find({}, { id: 1, status: 1, carId: 1 }),
    ]);

    // Car stats
    const totalCars = cars.length;
    const availableCars = cars.filter((c) => c.status === "AVAILABLE").length;
    const soldCars = cars.filter((c) => c.status === "SOLD").length;
    const unavailableCars = cars.filter((c) => c.status === "UNAVAILABLE").length;
    const featuredCars = cars.filter((c) => c.featured === true).length;

    // Test drive stats
    const totalTestDrives = testDrives.length;
    const pendingTestDrives = testDrives.filter((td) => td.status === "PENDING").length;
    const confirmedTestDrives = testDrives.filter((td) => td.status === "CONFIRMED").length;
    const completedTestDrives = testDrives.filter((td) => td.status === "COMPLETED").length;
    const cancelledTestDrives = testDrives.filter((td) => td.status === "CANCELLED").length;
    const noShowTestDrives = testDrives.filter((td) => td.status === "NO_SHOW").length;

    // Conversion Rate
    const completedTestDriveCarIds = testDrives
      .filter((td) => td.status === "COMPLETED")
      .map((td) => td.carId.toString());

    const soldCarsAfterTestDrive = cars.filter(
      (car) => car.status === "SOLD" && completedTestDriveCarIds.includes(car._id.toString())
    ).length;

    const conversionRate =
      completedTestDrives > 0 ? (soldCarsAfterTestDrive / completedTestDrives) * 100 : 0;

    return {
      success: true,
      data: {
        cars: {
          total: totalCars,
          available: availableCars,
          sold: soldCars,
          unavailable: unavailableCars,
          featured: featuredCars,
        },
        testDrives: {
          total: totalTestDrives,
          pending: pendingTestDrives,
          confirmed: confirmedTestDrives,
          completed: completedTestDrives,
          cancelled: cancelledTestDrives,
          noShow: noShowTestDrives,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    return { success: false, error: error.message };
  }
}

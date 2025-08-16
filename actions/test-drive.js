"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import "@/lib/mongodb"; // ensures mongoose is connected
import User from "@/models/User";
import Car from "@/models/Car";
import TestDriveBooking from "@/models/TestDriveBooking";
import { serializeCarData } from "@/lib/helpers";

/**
 * Books a test drive for a car
 */
export async function bookTestDrive({
  carId,
  bookingDate,
  startTime,
  endTime,
  notes,
}) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) throw new Error("You must be logged in to book a test drive");

    // Find user in our database
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found in database");

    // Check if car exists and is available
    const car = await Car.findOne({ _id: carId, status: "AVAILABLE" });
    if (!car) throw new Error("Car not available for test drive");

    // Check if slot is already booked
    const existingBooking = await TestDriveBooking.findOne({
      carId,
      bookingDate: new Date(bookingDate),
      startTime,
      status: { $in: ["PENDING", "CONFIRMED"] },
    });

    if (existingBooking) {
      throw new Error(
        "This time slot is already booked. Please select another time."
      );
    }

    // Create the booking
    const booking = await TestDriveBooking.create({
      carId,
      userId: user._id,
      bookingDate: new Date(bookingDate),
      startTime,
      endTime,
      notes: notes || null,
      status: "PENDING",
    });

    // Revalidate relevant paths
    revalidatePath(`/test-drive/${carId}`);
    revalidatePath(`/cars/${carId}`);

    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    console.error("Error booking test drive:", error);
    return {
      success: false,
      error: error.message || "Failed to book test drive",
    };
  }
}

/**
 * Get user's test drive bookings - reservations page
 */
export async function getUserTestDrives() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Get the user from our database
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) return { success: false, error: "User not found" };

    // Get user's test drive bookings with car details
    const bookings = await TestDriveBooking.find({ userId: user._id })
      .populate("car")
      .sort({ bookingDate: -1 });

    // Format the bookings
    const formattedBookings = bookings.map((booking) => ({
      id: booking._id.toString(),
      carId: booking.carId.toString(),
      car: serializeCarData(booking.car),
      bookingDate: booking.bookingDate?.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      notes: booking.notes,
      createdAt: booking.createdAt?.toISOString(),
      updatedAt: booking.updatedAt?.toISOString(),
    }));

    return { success: true, data: formattedBookings };
  } catch (error) {
    console.error("Error fetching test drives:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a test drive booking
 */
export async function cancelTestDrive(bookingId) {
  try {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Unauthorized" };

    // Get the user from our database
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) return { success: false, error: "User not found" };

    // Get the booking
    const booking = await TestDriveBooking.findById(bookingId);
    if (!booking) return { success: false, error: "Booking not found" };

    // Check if user owns this booking or is admin
    if (booking.userId.toString() !== user._id.toString() && user.role !== "ADMIN") {
      return { success: false, error: "Unauthorized to cancel this booking" };
    }

    // Check if booking can be cancelled
    if (booking.status === "CANCELLED") {
      return { success: false, error: "Booking is already cancelled" };
    }
    if (booking.status === "COMPLETED") {
      return { success: false, error: "Cannot cancel a completed booking" };
    }

    // Update the booking status
    booking.status = "CANCELLED";
    await booking.save();

    // Revalidate paths
    revalidatePath("/reservations");
    revalidatePath("/admin/test-drives");

    return { success: true, message: "Test drive cancelled successfully" };
  } catch (error) {
    console.error("Error cancelling test drive:", error);
    return { success: false, error: error.message };
  }
}

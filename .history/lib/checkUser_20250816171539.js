import { currentUser } from "@clerk/nextjs/server";
import connectDB from "./db"; // your mongoose connection file
import User from "@/models/User"; // your mongoose user schema

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    // ensure MongoDB connection
    await connectDB();

    // find user by clerkUserId
    let loggedInUser = await User.findOne({ clerkUserId: user.id });

    if (loggedInUser) {
      return loggedInUser;
    }

    // create new user if not exists
    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await User.create({
      clerkUserId: user.id,
      name,
      imageUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
    });

    return newUser;
  } catch (error) {
    console.error(error.message);
    return null;
  }
};

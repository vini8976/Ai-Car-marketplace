import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import CarMake from "@/models/CarMake";
import BodyType from "@/models/BodyType";
import FAQ from "@/models/FAQ";

import { featuredCars, carMakes, bodyTypes, faqItems } from "@/lib/seedData.js";

const seed = async () => {
  try {
    await connectDB();

    await Car.deleteMany();
    await CarMake.deleteMany();
    await BodyType.deleteMany();
    await FAQ.deleteMany();

    await Car.insertMany(featuredCars);
    await CarMake.insertMany(carMakes);
    await BodyType.insertMany(bodyTypes);
    await FAQ.insertMany(faqItems);

    console.log("✅ Database seeded successfully!");
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding database:", err);
    process.exit(1);
  }
};

seed();

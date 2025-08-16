import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import CarMake from "@/models/CarMake";
import BodyType from "@/models/BodyType";
import FAQ from "@/models/FAQ";

import { featuredCars, carMakes, bodyTypes, faqItems } from "@/lib/seedData"; // keep original arrays in a separate file

const seed = async () => {
  await connectDB();

  await Car.deleteMany();
  await CarMake.deleteMany();
  await BodyType.deleteMany();
  await FAQ.deleteMany();

  await Car.insertMany(featuredCars);
  await CarMake.insertMany(carMakes);
  await BodyType.insertMany(bodyTypes);
  await FAQ.insertMany(faqItems);

  console.log("✅ Database seeded!");
  process.exit();
};

seed();

import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";
import CarMake from "@/models/CarMake";
import BodyType from "@/models/BodyType";
import FAQ from "@/models/FAQ";

export const getCars = async () => {
  await connectDB();
  return await Car.find();
};

export const getCarMakes = async () => {
  await connectDB();
  return await CarMake.find();
};

export const getBodyTypes = async () => {
  await connectDB();
  return await BodyType.find();
};

export const getFAQs = async () => {
  await connectDB();
  return await FAQ.find();
};

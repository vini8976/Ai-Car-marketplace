import mongoose from "mongoose";

const CarSchema = new mongoose.Schema({
  make: String,
  model: String,
  year: Number,
  price: Number,
  images: [String],
  transmission: String,
  fuelType: String,
  bodyType: String,
  mileage: Number,
  color: String,
  wishlisted: { type: Boolean, default: false },
});

export default mongoose.models.Car || mongoose.model("Car", CarSchema);

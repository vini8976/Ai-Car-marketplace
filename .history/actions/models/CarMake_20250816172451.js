import mongoose from "mongoose";

const CarMakeSchema = new mongoose.Schema({
  name: String,
  image: String,
});

export default mongoose.models.CarMake || mongoose.model("CarMake", CarMakeSchema);

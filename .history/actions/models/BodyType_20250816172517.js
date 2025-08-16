import mongoose from "mongoose";

const BodyTypeSchema = new mongoose.Schema({
  name: String,
  image: String,
});

export default mongoose.models.BodyType || mongoose.model("BodyType", BodyTypeSchema);

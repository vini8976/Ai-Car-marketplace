import mongoose from "mongoose";

const FAQSchema = new mongoose.Schema({
  question: String,
  answer: String,
});

export default mongoose.models.FAQ || mongoose.model("FAQ", FAQSchema);

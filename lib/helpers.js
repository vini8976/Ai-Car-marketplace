// ✅ Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

// ✅ Helper function to serialize Mongoose car data
export const serializeCarData = (car, wishlisted = false) => {
  if (!car) return null;

  return {
    ...car.toObject(), // Convert Mongoose Document to plain JS object
    price: car.price ? parseFloat(car.price.toString()) : 0,
    createdAt: car.createdAt ? car.createdAt.toISOString() : null,
    updatedAt: car.updatedAt ? car.updatedAt.toISOString() : null,
    wishlisted,
  };
};

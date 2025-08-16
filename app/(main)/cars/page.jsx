import { CarFilters } from "./_components/car-filters";
import { CarListings } from "./_components/cars-listing";
import connectDB from "@/lib/mongodb";
import Car from "@/models/Car";

export const metadata = {
  title: "Cars | Vehiql",
  description: "Browse and search for your dream car",
};

async function getCarFilters() {
  await connectDB();

  // Use MongoDB aggregation to get unique filter values
  const makes = await Car.distinct("make");
  const bodyTypes = await Car.distinct("bodyType");
  const fuelTypes = await Car.distinct("fuelType");
  const transmissions = await Car.distinct("transmission");

  // Find min and max price
  const prices = await Car.aggregate([
    {
      $group: {
        _id: null,
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" },
      },
    },
  ]);

  const priceRange = prices[0]
    ? { min: prices[0].minPrice, max: prices[0].maxPrice }
    : { min: 0, max: 0 };

  return {
    makes,
    bodyTypes,
    fuelTypes,
    transmissions,
    priceRange,
  };
}

export default async function CarsPage() {
  const filtersData = await getCarFilters();

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-6xl mb-4 gradient-title">Browse Cars</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Section */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <CarFilters filters={filtersData} />
        </div>

        {/* Car Listings */}
        <div className="flex-1">
          <CarListings />
        </div>
      </div>
    </div>
  );
}

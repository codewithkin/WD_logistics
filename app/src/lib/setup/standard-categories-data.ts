/**
 * The expense categories a haulier needs on its first day.
 *
 * Every expense form requires a category, and the reset deletes them along
 * with the expenses that used them — so without this, the first thing the
 * client meets after starting afresh is an Expenses page they cannot use, and
 * a chart of accounts they have to invent before they can record a tank of
 * diesel. Categories are closer to configuration than to data; the fleet's
 * spending is the data.
 *
 * Each one is ordinary and editable: rename them, delete the ones that do not
 * apply, add the ones that do. Nothing in the app depends on these names.
 *
 * ## Why `kind` matters more than the name
 *
 * `kind` is what the truck cost breakdown reads to answer "is this truck's
 * problem fuel or time in the workshop". It cannot do that by matching names,
 * because one fleet's "Diesel" is another's "Fuel & lubricants" — so the
 * standard set arrives with the kinds already set, and fuel economy works
 * from the first fill rather than after somebody notices a dropdown.
 *
 * The three flags say where a category can be picked: against a trip, a
 * truck, a driver, or any combination.
 */

interface StandardCategory {
  name: string;
  description: string;
  kind: string;
  isTrip: boolean;
  isTruck: boolean;
  isDriver: boolean;
}

export const STANDARD_EXPENSE_CATEGORIES: StandardCategory[] = [
  {
    name: "Fuel",
    description: "Diesel and petrol. Record the litres as well as the amount.",
    kind: "fuel",
    isTrip: true,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Tolls",
    description: "Road tolls and gate fees on the route.",
    kind: "tolls",
    isTrip: true,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Border and permits",
    description: "Cross-border charges, permits and clearing fees.",
    kind: "permits",
    isTrip: true,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Maintenance and repairs",
    description: "Workshop work, servicing and parts fitted.",
    kind: "maintenance",
    isTrip: false,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Tyres",
    description: "New tyres, retreads and punctures.",
    kind: "tyres",
    isTrip: false,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Insurance and licensing",
    description: "Vehicle insurance, licence discs and certificates of fitness.",
    kind: "insurance",
    isTrip: false,
    isTruck: true,
    isDriver: false,
  },
  {
    name: "Driver allowance",
    description: "Trip allowances, meals and accommodation on the road.",
    kind: "salaries",
    isTrip: true,
    isTruck: false,
    isDriver: true,
  },
  {
    name: "Loading and offloading",
    description: "Labour at either end of a trip.",
    kind: "other",
    isTrip: true,
    isTruck: false,
    isDriver: false,
  },
  {
    name: "Office and admin",
    description: "Anything that keeps the office running rather than a truck.",
    kind: "other",
    isTrip: false,
    isTruck: false,
    isDriver: false,
  },
];


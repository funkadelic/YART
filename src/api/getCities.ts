import { cities } from "../data/worldcities/cities";

export interface City {
  id: number;
  name: string;
  nameAscii: string;
  country: string;
  countryIso3: string;
  capital: string;
  population: number;
}

export interface GetCitiesParams {
  searchTerm?: string;
}

/**
 * Simulated network latency, in milliseconds.
 */
const LATENCY_MS = 200;

/**
 * Searching for this term mimics a failed request.
 */
const ERROR_TERM = "error";

function matches(city: City, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return (
    city.name.toLowerCase().includes(needle) ||
    city.nameAscii.toLowerCase().includes(needle) ||
    city.country.toLowerCase().includes(needle)
  );
}

/**
 * Fake API that returns cities matching a search term against city name or
 * country name. Searching for "error" rejects, so error states can be tested.
 */
export function getCities({ searchTerm = "" }: GetCitiesParams = {}): Promise<
  City[]
> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (searchTerm.trim().toLowerCase() === ERROR_TERM) {
        reject(new Error("Something went wrong while fetching cities"));
        return;
      }

      resolve(cities.filter((city) => matches(city, searchTerm)));
    }, LATENCY_MS);
  });
}

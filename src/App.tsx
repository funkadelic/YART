import { useEffect, useCallback, useState } from "react";

import type { City } from "./api/getCities";
import { getCities } from "./api/getCities";
import { useDebounce } from "./hooks/useDebounce";

import { RootLayout } from "./features/RootLayout";
import { SortableTable } from "./components/SortableTable";

const App = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  // P1: Debounce search term with 150ms delay
  const debouncedSearchTerm = useDebounce(searchTerm, 150);

  const runSearch = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const searchResult = await getCities({ searchTerm: term });
      setCities(searchResult);
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error("An unexpected error occurred"));
      }
    } finally {
      setLoading(false); // always set loading to false for either try or catch
    }
  }, []);

  // P1: Search only triggers after 150ms delay (debounced)
  useEffect(() => {
    runSearch(debouncedSearchTerm);
  }, [runSearch, debouncedSearchTerm]);

  // Memoize the search change handler to prevent re-renders
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  return (
    <RootLayout>
      <h1>City List</h1>
      <SortableTable
        data={cities}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        loading={loading}
        error={error}
      />
    </RootLayout>
  );
};

export default App;

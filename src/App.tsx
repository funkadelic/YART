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
  // The loading flag is also true for a refetch that follows an empty result
  // set, so on its own it cannot say whether the wait is a download or a
  // search. This records the one fact it cannot carry: whether the collection
  // has arrived at least once.
  const [datasetReady, setDatasetReady] = useState(false);
  // The retry control below increments retryAttempt, and the effect lists it as
  // a dependency, which is what lets a failed load be run again without a page
  // reload.
  const [retryAttempt, setRetryAttempt] = useState(0);

  // P1: Debounce search term with 150ms delay
  const debouncedSearchTerm = useDebounce(searchTerm, 150);

  // P1: Search only triggers after 150ms delay (debounced)
  useEffect(() => {
    // The asynchronous work sits directly in the effect rather than behind a
    // memoized callback, because that is what lets this one variable guard
    // every state write below, the settle handler included. A result that
    // arrives after the cleanup has run belongs to a search the user has
    // already moved past, so it is dropped rather than rendered.
    let ignore = false;

    // Clear the last failure as the new attempt starts, so a retry does not
    // leave the old error on screen beside the new load.
    setError(null);
    setLoading(true);

    getCities({ searchTerm: debouncedSearchTerm })
      .then((searchResult) => {
        if (ignore) return;
        setCities(searchResult);
        setDatasetReady(true);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error("An unexpected error occurred"));
        }
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false); // always set loading to false for either try or catch
      });

    return () => {
      ignore = true;
    };
  }, [debouncedSearchTerm, retryAttempt]);

  // Memoize the search change handler to prevent re-renders
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // The next keystroke would re-run the search too, but nothing on screen says
  // so, which leaves a reader of the error with no way forward. Retrying on a
  // timer with backoff was rejected instead: it hides a misconfigured
  // deployment behind a spinner and re-downloads several megabytes of city data
  // with nobody watching.
  const handleRetry = useCallback(() => {
    setRetryAttempt((previousAttempt) => previousAttempt + 1);
  }, []);

  return (
    <RootLayout>
      <h1>City List</h1>
      <SortableTable
        data={cities}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        loading={loading}
        datasetReady={datasetReady}
        error={error}
        onRetry={handleRetry}
      />
    </RootLayout>
  );
};

export default App;

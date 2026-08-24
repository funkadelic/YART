import { useEffect, useCallback, useReducer, useState } from "react";

import { getCities } from "./api/getCities";
import { INITIAL_APP_STATE, applyAppAction } from "./appState";

import { RootLayout } from "./features/RootLayout";
import { CityTable } from "./features/CityTable";

const App = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [{ cities, error, loading, datasetReady, retryAttempt }, dispatch] =
    useReducer(applyAppAction, INITIAL_APP_STATE);

  useEffect(() => {
    // The asynchronous work sits directly in the effect rather than behind a
    // memoized callback, because that is what lets this one variable guard
    // every state write below, the settle handler included. A result that
    // arrives after the cleanup has run belongs to a search the user has
    // already moved past, so it is dropped rather than rendered.
    let ignore = false;

    // Clear the last failure as the new attempt starts, so a retry does not
    // leave the old error on screen beside the new load.
    dispatch({ type: "attempt" });

    getCities({ searchTerm })
      .then((searchResult) => {
        if (ignore) return;
        dispatch({ type: "resolved", cities: searchResult });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        if (err instanceof Error) {
          dispatch({ type: "failed", error: err });
        } else {
          dispatch({
            type: "failed",
            error: new Error("An unexpected error occurred"),
          });
        }
      })
      .finally(() => {
        if (ignore) return;
        dispatch({ type: "settled" }); // always lower loading for either try or catch
      });

    return () => {
      ignore = true;
    };
  }, [searchTerm, retryAttempt]);

  // Receives the term the search box has settled on rather than every
  // keystroke: the debounce lives with the box now, so what arrives here is
  // already the term worth issuing a request for. Memoized because the child
  // holds on to it, and an empty dependency array is what makes that hold safe.
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // The next keystroke would re-run the search too, but nothing on screen says
  // so, which leaves a reader of the error with no way forward. Retrying on a
  // timer with backoff was rejected instead: it hides a misconfigured
  // deployment behind a spinner and re-downloads several megabytes of city data
  // with nobody watching.
  const handleRetry = useCallback(() => {
    dispatch({ type: "retry" });
  }, []);

  return (
    <RootLayout>
      <h1>City List</h1>
      <CityTable
        data={cities}
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

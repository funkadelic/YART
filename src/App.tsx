import { useEffect, useCallback, useReducer, useState } from "react";

import { DatasetError, getCities } from "./api/getCities";
import { INITIAL_APP_STATE, applyAppAction } from "./appState";
import { useLocale } from "./hooks/useLocale";
import { datasetErrorText } from "./i18n/datasetErrorText";

import { RootLayout } from "./features/RootLayout";
import { CityTable, parseSearchTerm } from "./features/CityTable";

const App = () => {
  // Seeded from the address so the first render already asks for the right
  // rows. Without this the effect below issues a request for the empty term and
  // then immediately another for the restored one, so every shared link costs
  // two requests on a cold start; the stale-result guard makes that survivable
  // rather than correct.
  //
  // This is a read of the address and stays one. The single write lives with
  // the table's view state, one layer down, and adding a second writer here is
  // what would make the address a thing two components argue over.
  const [searchTerm, setSearchTerm] = useState(() =>
    parseSearchTerm(window.location.search),
  );
  const [{ cities, error, loading, datasetReady, retryAttempt }, dispatch] =
    useReducer(applyAppAction, INITIAL_APP_STATE);
  const { catalog, tag } = useLocale();

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
          // A rejection carrying no error at all, which the loader never
          // produces and a stubbed seam can. It enters state as a dataset
          // error so what the reducer holds is always something the translator
          // below has a sentence for.
          dispatch({
            type: "failed",
            error: new DatasetError(
              "unexpected",
              0,
              "The search rejected with something that was not an error",
            ),
          });
        }
      })
      .finally(() => {
        if (ignore) return;
        dispatch({ type: "settled" });
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

  // Derived here, during render, rather than at the catch above, and that is
  // the whole reason this line is not two lines further up. The catch is inside
  // the fetch effect, so reading the catalog there would make the locale a
  // dependency of the effect and a reader changing language would re-issue the
  // search. Here the catalog is already in scope and the effect's dependencies
  // are untouched.
  const errorMessage =
    error === null ? null : datasetErrorText(error, catalog, tag);

  return (
    <RootLayout>
      <h1>{catalog.appTitle}</h1>
      <CityTable
        data={cities}
        onSearchChange={handleSearchChange}
        loading={loading}
        datasetReady={datasetReady}
        errorMessage={errorMessage}
        onRetry={handleRetry}
      />
    </RootLayout>
  );
};

export default App;

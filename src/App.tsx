import { useEffect, useCallback, useReducer, useState } from "react";

import { DatasetError, getCities, type City } from "./api/getCities";
import { INITIAL_APP_STATE, applyAppAction } from "./appState";
import { useLocale } from "./hooks/useLocale";
import { datasetErrorText } from "./i18n/datasetErrorText";

import { RootLayout } from "./features/RootLayout";
import { CityTable, parseSearchTerm } from "./features/CityTable";

const App = () => {
  // Seeded from the address, or every shared link costs two requests on a cold
  // start. A read and it stays one: the single write is one layer down.
  const [searchTerm, setSearchTerm] = useState(() =>
    parseSearchTerm(window.location.search),
  );
  // The row type is supplied here rather than inferred, because the initial
  // state is typed over no row and would otherwise pin the reducer to that.
  const [{ rows, error, loading, datasetReady, retryAttempt }, dispatch] =
    useReducer(applyAppAction<City>, INITIAL_APP_STATE);
  const { catalog, tag } = useLocale();

  useEffect(() => {
    // The fetch sits in the effect so this one flag guards every write below.
    // A result arriving after cleanup belongs to a search already moved past.
    let ignore = false;

    // Clear the last failure as the new attempt starts, so a retry does not
    // leave the old error on screen beside the new load.
    dispatch({ type: "attempt" });

    getCities({ searchTerm })
      .then((searchResult) => {
        if (ignore) return;
        dispatch({ type: "resolved", rows: searchResult });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        if (err instanceof Error) {
          dispatch({ type: "failed", error: err });
        } else {
          // A rejection carrying no error, which only a stubbed seam produces.
          // It enters state as a dataset error so a sentence always exists.
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

  // Receives the settled term rather than every keystroke. Memoized with an
  // empty dependency array, because the child holds on to it.
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  // Deliberately manual. A backoff timer would hide a misconfigured deployment
  // behind a spinner and re-download the dataset with nobody watching.
  const handleRetry = useCallback(() => {
    dispatch({ type: "retry" });
  }, []);

  // Derived during render rather than at the catch, which is inside the fetch
  // effect: reading the catalog there would make the locale a dependency of it.
  const errorMessage =
    error === null ? null : datasetErrorText(error, catalog.cities, tag);

  return (
    <RootLayout domain="cities">
      <h1>{catalog.cities.appTitle}</h1>
      <CityTable
        data={rows}
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

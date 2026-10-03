import type { DataTableLabels } from "./components/DataTable/DataTable.js";
import type { SearchInputLabels } from "./components/SearchInput.js";

const none = () => "";

/** English table copy. Spread it and override the entries you need. */
export const englishTableLabels: DataTableLabels = {
  loading: "",
  empty: "",
  emptyAnnouncement: "",
  results: none,
  caption: none,
  error: none,
  retry: "",
  sortedAnnouncement: none,
  sortClearedAnnouncement: "",
  unsorted: "",
  sortSummary: none,
  pagination: {
    pageSize: "",
    navigation: "",
    firstPage: "",
    previousPage: "",
    nextPage: "",
    lastPage: "",
    pageStatus: none,
  },
};

/** English search box copy. Spread it and override the entries you need. */
export const englishSearchLabels: SearchInputLabels = {
  name: "",
  placeholder: "",
};

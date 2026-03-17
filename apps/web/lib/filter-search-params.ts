type StringFilters = Record<string, string>;

type SearchParamsLike = {
  get: (name: string) => string | null;
};

export const getFiltersFromSearchParams = <TFilters extends StringFilters>(
  searchParams: SearchParamsLike,
  emptyFilters: TFilters
): TFilters => {
  const nextFilters = { ...emptyFilters };

  (Object.keys(emptyFilters) as Array<keyof TFilters>).forEach((key) => {
    nextFilters[key] = (searchParams.get(String(key)) ??
      "") as TFilters[typeof key];
  });

  return nextFilters;
};

export const createFilterQueryString = <TFilters extends StringFilters>(
  filters: TFilters
): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  return params.toString();
};

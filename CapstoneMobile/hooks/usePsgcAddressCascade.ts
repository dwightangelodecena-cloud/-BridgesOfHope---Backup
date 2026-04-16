import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  fetchProvinceOptions,
  fetchCitiesMunicipalities,
  fetchBarangays,
  toOption,
  type ProvinceRow,
} from '../lib/psgcApi';

type CityFieldKey = 'municipality' | 'municipalityCity';

type SavedHydrate = {
  provinceCode: string;
  provinceKind?: 'province' | 'region';
  cityCode?: string;
  barangayCode?: string;
  province?: string;
  street?: string;
};

export function usePsgcAddressCascade({ cityFieldKey }: { cityFieldKey: CityFieldKey }) {
  const [provinceRows, setProvinceRows] = useState<ProvinceRow[]>([]);
  const [citiesRaw, setCitiesRaw] = useState<unknown[]>([]);
  const [barangaysRaw, setBarangaysRaw] = useState<unknown[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProvinces(true);
      setFetchError('');
      try {
        const rows = await fetchProvinceOptions();
        if (!cancelled) setProvinceRows(rows);
      } catch (e: unknown) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : 'Could not load provinces.');
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const provinceOptions = useMemo(
    () =>
      provinceRows.map((p) => ({
        code: p.code,
        name: p.name,
        kind: p.kind || ('province' as const),
      })),
    [provinceRows]
  );

  const cityOptions = useMemo(() => citiesRaw.map(toOption).filter((o) => o.name), [citiesRaw]);
  const barangayOptions = useMemo(() => barangaysRaw.map(toOption).filter((o) => o.name), [barangaysRaw]);

  const applyBarangayList = useCallback(
    (list: unknown[], setFormData: Dispatch<SetStateAction<any>>, autoPickSingle: boolean) => {
      setBarangaysRaw(list);
      if (autoPickSingle && list.length === 1) {
        const b = toOption(list[0]);
        setFormData((prev: any) => ({ ...prev, barangay: b.name }));
      }
    },
    []
  );

  const fetchBarangaysForCityRow = useCallback(
    async (
      cityRow: unknown,
      setFormData: Dispatch<SetStateAction<any>>,
      opts: { autoSelectSingleBarangay?: boolean } = {}
    ) => {
      const { autoSelectSingleBarangay = true } = opts;
      const opt = toOption(cityRow);
      setFormData((prev: any) => ({
        ...prev,
        [cityFieldKey]: opt.name,
        barangay: '',
      }));
      setBarangaysRaw([]);
      setLoadingBarangays(true);
      setFetchError('');
      try {
        const list = await fetchBarangays(opt.code);
        applyBarangayList(list, setFormData, autoSelectSingleBarangay);
      } catch (e: unknown) {
        setFetchError(e instanceof Error ? e.message : 'Could not load barangays.');
        setBarangaysRaw([]);
      } finally {
        setLoadingBarangays(false);
      }
    },
    [applyBarangayList, cityFieldKey]
  );

  const onProvinceSelected = useCallback(
    async (
      opt: { code: string; name: string; kind?: 'province' | 'region' },
      setFormData: Dispatch<SetStateAction<any>>
    ) => {
      const kind = opt.kind || 'province';
      setFormData((prev: any) => ({
        ...prev,
        province: opt.name,
        [cityFieldKey]: '',
        barangay: '',
        street: '',
      }));
      setCitiesRaw([]);
      setBarangaysRaw([]);
      setLoadingCities(true);
      setFetchError('');
      try {
        const list = await fetchCitiesMunicipalities(opt.code, kind);
        setCitiesRaw(list);
        if (list.length === 1) {
          await fetchBarangaysForCityRow(list[0], setFormData, { autoSelectSingleBarangay: true });
        }
      } catch (e: unknown) {
        setFetchError(e instanceof Error ? e.message : 'Could not load cities / municipalities.');
        setCitiesRaw([]);
      } finally {
        setLoadingCities(false);
      }
    },
    [cityFieldKey, fetchBarangaysForCityRow]
  );

  const onCitySelected = useCallback(
    async (opt: { code: string; name: string }, setFormData: Dispatch<SetStateAction<any>>) => {
      const row =
        citiesRaw.find((r) => String((r as { code: string }).code) === String(opt.code)) ||
        ({ code: opt.code, name: opt.name } as unknown);
      await fetchBarangaysForCityRow(row, setFormData, { autoSelectSingleBarangay: true });
    },
    [citiesRaw, fetchBarangaysForCityRow]
  );

  const onBarangaySelected = useCallback(
    (opt: { code: string; name: string }, setFormData: Dispatch<SetStateAction<any>>) => {
      setFormData((prev: any) => ({ ...prev, barangay: opt.name }));
    },
    []
  );

  const onProvinceCleared = useCallback(
    (setFormData: Dispatch<SetStateAction<any>>) => {
      setFormData((prev: any) => ({
        ...prev,
        province: '',
        [cityFieldKey]: '',
        barangay: '',
        street: '',
      }));
      setCitiesRaw([]);
      setBarangaysRaw([]);
    },
    [cityFieldKey]
  );

  const onCityCleared = useCallback(
    (setFormData: Dispatch<SetStateAction<any>>) => {
      setFormData((prev: any) => ({
        ...prev,
        [cityFieldKey]: '',
        barangay: '',
      }));
      setBarangaysRaw([]);
    },
    [cityFieldKey]
  );

  const onBarangayCleared = useCallback((setFormData: Dispatch<SetStateAction<any>>) => {
    setFormData((prev: any) => ({ ...prev, barangay: '' }));
  }, []);

  const hydrateFromSaved = useCallback(
    async (saved: SavedHydrate | null, setFormData: Dispatch<SetStateAction<any>>) => {
      if (!saved?.provinceCode) return false;
      setFetchError('');
      setCitiesRaw([]);
      setBarangaysRaw([]);
      setFormData((prev: any) => ({
        ...prev,
        province: saved.province || '',
        [cityFieldKey]: '',
        barangay: '',
        street: typeof saved.street === 'string' ? saved.street : prev.street || '',
      }));

      setLoadingCities(true);
      try {
        const list = await fetchCitiesMunicipalities(
          saved.provinceCode,
          saved.provinceKind || 'province'
        );
        setCitiesRaw(list);
        const cityRow =
          list.find((c) => String((c as { code: string }).code) === String(saved.cityCode)) ||
          (list.length === 1 ? list[0] : null);
        if (!cityRow) {
          return true;
        }
        const cityOpt = toOption(cityRow);
        setFormData((prev: any) => ({ ...prev, [cityFieldKey]: cityOpt.name, barangay: '' }));

        setLoadingBarangays(true);
        const brList = await fetchBarangays(cityOpt.code);
        setBarangaysRaw(brList);
        const brRow =
          brList.find((b) => String((b as { code: string }).code) === String(saved.barangayCode)) ||
          (brList.length === 1 ? brList[0] : null);
        if (brRow) {
          setFormData((prev: any) => ({ ...prev, barangay: toOption(brRow).name }));
        }
        return true;
      } catch (e: unknown) {
        setFetchError(e instanceof Error ? e.message : 'Could not restore saved address.');
        return false;
      } finally {
        setLoadingCities(false);
        setLoadingBarangays(false);
      }
    },
    [cityFieldKey]
  );

  return {
    provinceOptions,
    cityOptions,
    barangayOptions,
    loadingProvinces,
    loadingCities,
    loadingBarangays,
    fetchError,
    setFetchError,
    onProvinceSelected,
    onCitySelected,
    onBarangaySelected,
    onProvinceCleared,
    onCityCleared,
    onBarangayCleared,
    hydrateFromSaved,
  };
}

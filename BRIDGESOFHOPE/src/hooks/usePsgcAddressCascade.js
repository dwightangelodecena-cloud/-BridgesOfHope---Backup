import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchProvinceOptions,
  fetchCitiesMunicipalities,
  fetchBarangays,
  toOption,
} from '@/lib/psgcApi';

/**
 * Loads provinces once; fetches cities/barangays on demand. Supports NCR via `kind: 'region'`.
 * Auto-selects when a level returns exactly one option. Provides `hydrateFromSaved` for localStorage restore.
 *
 * @param {object} opts
 * @param {'municipality' | 'municipalityCity'} opts.cityFieldKey form field for city name
 */
export function usePsgcAddressCascade({ cityFieldKey }) {
  const [provinceRows, setProvinceRows] = useState([]);
  const [citiesRaw, setCitiesRaw] = useState([]);
  const [barangaysRaw, setBarangaysRaw] = useState([]);

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
      } catch (e) {
        if (!cancelled) setFetchError(e?.message || 'Could not load provinces.');
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
        kind: p.kind || 'province',
      })),
    [provinceRows]
  );

  const cityOptions = useMemo(() => citiesRaw.map(toOption).filter((o) => o.name), [citiesRaw]);
  const barangayOptions = useMemo(() => barangaysRaw.map(toOption).filter((o) => o.name), [barangaysRaw]);

  const applyBarangayList = useCallback((list, setFormData, autoPickSingle) => {
    setBarangaysRaw(list);
    if (autoPickSingle && list.length === 1) {
      const b = toOption(list[0]);
      setFormData((prev) => ({ ...prev, barangay: b.name }));
    }
  }, []);

  /**
   * Load barangays for a city row; optionally auto-select if only one.
   */
  const fetchBarangaysForCityRow = useCallback(
    async (cityRow, setFormData, { autoSelectSingleBarangay = true } = {}) => {
      const opt = toOption(cityRow);
      setFormData((prev) => ({
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
      } catch (e) {
        setFetchError(e?.message || 'Could not load barangays.');
        setBarangaysRaw([]);
      } finally {
        setLoadingBarangays(false);
      }
    },
    [applyBarangayList, cityFieldKey]
  );

  const onProvinceSelected = useCallback(
    async (opt, setFormData) => {
      const kind = opt.kind || 'province';
      setFormData((prev) => ({
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
      } catch (e) {
        setFetchError(e?.message || 'Could not load cities / municipalities.');
        setCitiesRaw([]);
      } finally {
        setLoadingCities(false);
      }
    },
    [cityFieldKey, fetchBarangaysForCityRow]
  );

  const onCitySelected = useCallback(
    async (opt, setFormData) => {
      const row = citiesRaw.find((r) => String(r.code) === String(opt.code)) || {
        code: opt.code,
        name: opt.name,
      };
      await fetchBarangaysForCityRow(row, setFormData, { autoSelectSingleBarangay: true });
    },
    [citiesRaw, fetchBarangaysForCityRow]
  );

  const onBarangaySelected = useCallback((opt, setFormData) => {
    setFormData((prev) => ({ ...prev, barangay: opt.name }));
  }, []);

  /** User cleared province — reset entire address branch and loaded lists. */
  const onProvinceCleared = useCallback(
    (setFormData) => {
      setFormData((prev) => ({
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

  /** User cleared city — reset barangay and its list. */
  const onCityCleared = useCallback(
    (setFormData) => {
      setFormData((prev) => ({
        ...prev,
        [cityFieldKey]: '',
        barangay: '',
      }));
      setBarangaysRaw([]);
    },
    [cityFieldKey]
  );

  const onBarangayCleared = useCallback((setFormData) => {
    setFormData((prev) => ({ ...prev, barangay: '' }));
  }, []);

  /**
   * Restore cascading state from a saved snapshot (e.g. localStorage).
   * @param {object|null} saved
   * @param {string} [saved.provinceCode]
   * @param {'province'|'region'} [saved.provinceKind]
   * @param {string} [saved.cityCode]
   * @param {string} [saved.barangayCode]
   * @param {string} [saved.province]
   * @param {string} [saved.city]
   * @param {string} [saved.barangay]
   * @param {string} [saved.street]
   */
  const hydrateFromSaved = useCallback(
    async (saved, setFormData) => {
      if (!saved?.provinceCode) return false;
      setFetchError('');
      setCitiesRaw([]);
      setBarangaysRaw([]);
      setFormData((prev) => ({
        ...prev,
        province: saved.province || '',
        [cityFieldKey]: '',
        barangay: '',
        street: typeof saved.street === 'string' ? saved.street : prev.street || '',
      }));

      setLoadingCities(true);
      try {
        const list = await fetchCitiesMunicipalities(saved.provinceCode, saved.provinceKind || 'province');
        setCitiesRaw(list);
        const cityRow =
          list.find((c) => String(c.code) === String(saved.cityCode)) || (list.length === 1 ? list[0] : null);
        if (!cityRow) {
          return true;
        }
        const cityOpt = toOption(cityRow);
        setFormData((prev) => ({ ...prev, [cityFieldKey]: cityOpt.name, barangay: '' }));

        setLoadingBarangays(true);
        const brList = await fetchBarangays(cityOpt.code);
        setBarangaysRaw(brList);
        const brRow =
          brList.find((b) => String(b.code) === String(saved.barangayCode)) ||
          (brList.length === 1 ? brList[0] : null);
        if (brRow) {
          setFormData((prev) => ({ ...prev, barangay: toOption(brRow).name }));
        }
        return true;
      } catch (e) {
        setFetchError(e?.message || 'Could not restore saved address.');
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

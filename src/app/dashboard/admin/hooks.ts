
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDepartments, getDivisions, getOffices, getRoles, getUsers, getBranches, getDistricts } from '@/app/actions/memo';
import type { Department, Division, Office, Role, User, Branch, District } from '@/lib/types';

type UseDataHook<T> = {
  data: T[];
  loading: boolean;
  mutate: () => Promise<void>;
};

function createDataHook<T>(fetcher: () => Promise<T[]>): () => UseDataHook<T> {
  return () => {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
      setLoading(true);
      try {
        const result = await fetcher();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }, [fetcher]);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    return { data, loading, mutate: fetchData };
  };
}

export const useDivisions = createDataHook(getDivisions);
export const useDepartments = createDataHook(getDepartments);
export const useBranches = createDataHook(getBranches);
export const useDistricts = createDataHook(getDistricts);
export const useOffices = createDataHook(getOffices);
export const useRoles = createDataHook(getRoles);
export const useUsers = createDataHook(getUsers);


'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDepartments, getDivisions, getOffices, getRoles, getUsers, getBranches, getDistricts, getLabels } from '@/app/actions/memo';
import type { Department, Division, Office, Role, User, Branch, District, Label } from '@/lib/types';

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
    }, []);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    return { data, loading, mutate: fetchData };
  };
}

export const useDivisions = createDataHook(getDivisions as () => Promise<Division[]>);
export const useDepartments = createDataHook(getDepartments as () => Promise<Department[]>);
export const useBranches = createDataHook(getBranches as () => Promise<Branch[]>);
export const useDistricts = createDataHook(getDistricts as () => Promise<District[]>);
export const useOffices = createDataHook(getOffices as () => Promise<Office[]>);
export const useRoles = createDataHook(getRoles as () => Promise<Role[]>);
export const useUsers = createDataHook(getUsers as () => Promise<User[]>);
export const useLabels = createDataHook(getLabels as () => Promise<Label[]>);

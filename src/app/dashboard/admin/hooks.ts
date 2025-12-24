
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDepartments, getDivisions, getOffices, getRoles, getUsers } from '@/app/actions/memo';
import type { Department, Division, Office, Role, User } from '@/lib/types';

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

export const useDivisions = createDataHook(getDivisions);
export const useDepartments = createDataHook(getDepartments);
export const useOffices = createDataHook(getOffices as () => Promise<(Office & { department: { division: { name: string; }; }; })[]>);
export const useRoles = createDataHook(getRoles);
export const useUsers = createDataHook(getUsers as () => Promise<(User & { office: Office & { department: { name: string; division: { name: string; }; }; }; role: Role; })[]>);

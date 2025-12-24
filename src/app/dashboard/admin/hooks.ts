
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
      const result = await fetcher();
      setData(result);
      setLoading(false);
    }, []);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    return { data, loading, mutate: fetchData };
  };
}

// Renaming the exports to avoid naming collisions
export const useDivisions = createDataHook(getDivisions);

export const useDepartments = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
     const fetchData = useCallback(async () => {
        setLoading(true);
        const depts = await getDepartments();
        setDepartments(depts);
        setLoading(false);
    }, []);
    useEffect(() => {
      fetchData();
    }, [fetchData]);
    return { departments, loading, mutate: fetchData };
}


export const useOffices = () => {
    const [offices, setOffices] = useState<(Office & { department: { division: { name: string; }; }; })[]>([]);
    const [loading, setLoading] = useState(true);
     const fetchData = useCallback(async () => {
        setLoading(true);
        const offs = await getOffices();
        setOffices(offs);
        setLoading(false);
    }, []);
     useEffect(() => {
      fetchData();
    }, [fetchData]);
    return { offices, loading, mutate: fetchData };
}

export const useRoles = createDataHook(getRoles);


export const useUsers = () => {
    const [users, setUsers] = useState<(User & { office: Office & { department: { name: string; division: { name: string; }; }; }; role: Role; })[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const usersData = await getUsers() as any;
        setUsers(usersData);
        setLoading(false);
    }, []);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    return { users, loading, mutate: fetchData };
};

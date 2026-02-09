

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getDepartments, getDivisions, getOffices, getRoles, getUsers, getBranches, getDistricts, getLabels } from '@/app/actions/memo';
import type { Department, Division, Office, Role, User, Branch, District, Label } from '@/lib/types';

interface AdminDataContextType {
    users: User[];
    roles: Role[];
    offices: Office[];
    departments: Department[];
    divisions: Division[];
    districts: District[];
    branches: Branch[];
    labels: Label[];
    loading: boolean;
    mutate: () => Promise<void>;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
    const [data, setData] = useState<Omit<AdminDataContextType, 'loading' | 'mutate'>>({
        users: [], roles: [], offices: [], departments: [], divisions: [], districts: [], branches: [], labels: []
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [users, roles, offices, departments, divisions, districts, branches, labels] = await Promise.all([
                getUsers(),
                getRoles(),
                getOffices(),
                getDepartments(),
                getDivisions(),
                getDistricts(),
                getBranches(),
                getLabels(),
            ]);
            setData({ users, roles, offices, departments, divisions, districts, branches, labels } as Omit<AdminDataContextType, 'loading' | 'mutate'>);
        } catch (error) {
            console.error("Failed to fetch admin data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const value = { ...data, loading, mutate: fetchData };

    return (
        <AdminDataContext.Provider value={value}>
            {children}
        </AdminDataContext.Provider>
    );
}

function useAdminData() {
    const context = useContext(AdminDataContext);
    if (!context) {
        throw new Error('useAdminData must be used within an AdminDataProvider');
    }
    return context;
}

// Individual hooks that consume the context
export const useUsers = () => { const { users, loading, mutate } = useAdminData(); return { data: users, loading, mutate }; };
export const useRoles = () => { const { roles, loading, mutate } = useAdminData(); return { data: roles, loading, mutate }; };
export const useOffices = () => { const { offices, loading, mutate } = useAdminData(); return { data: offices, loading, mutate }; };
export const useDepartments = () => { const { departments, loading, mutate } = useAdminData(); return { data: departments, loading, mutate }; };
export const useDivisions = () => { const { divisions, loading, mutate } = useAdminData(); return { data: divisions, loading, mutate }; };
export const useDistricts = () => { const { districts, loading, mutate } = useAdminData(); return { data: districts, loading, mutate }; };
export const useBranches = () => { const { branches, loading, mutate } = useAdminData(); return { data: branches, loading, mutate }; };
export const useLabels = () => { const { labels, loading, mutate } = useAdminData(); return { data: labels, loading, mutate }; };


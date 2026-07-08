import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

export const useUsers = (searchParams: any) => {
  return useQuery({
    queryKey: ['users', searchParams],
    queryFn: async () => {
      const query = new URLSearchParams();
      
      // Map searchParams to API query string
      if (searchParams.page) query.set('page', searchParams.page);
      if (searchParams.pageSize) query.set('pageSize', searchParams.pageSize);
      if (searchParams.search) query.set('search', searchParams.search);
      if (searchParams.role) query.set('role', searchParams.role);
      if (searchParams.status) query.set('status', searchParams.status);
      if (searchParams.program) query.set('programId', searchParams.program);
      if (searchParams.semester) query.set('semesterId', searchParams.semester);
      if (searchParams.sort) {
        const [sortBy, sortOrder] = searchParams.sort.split('.');
        query.set('sortBy', sortBy);
        query.set('sortOrder', sortOrder);
      }

      return await apiRequest(`/users?${query.toString()}`);
    },
  });
};

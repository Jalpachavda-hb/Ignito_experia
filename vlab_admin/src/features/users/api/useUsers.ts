import { useQuery } from '@tanstack/react-query';
import { fetchUsers } from '@/Utils/GetApiHandler';

export const useUsers = (searchParams: any) => {
  return useQuery({
    queryKey: ['users', searchParams],
    queryFn: async () => {
      const params: Record<string, string> = {};
      
      // Map searchParams to API query parameters
      if (searchParams.page) params.page = searchParams.page;
      if (searchParams.pageSize) params.pageSize = searchParams.pageSize;
      if (searchParams.search) params.search = searchParams.search;
      if (searchParams.role) params.role = searchParams.role;
      if (searchParams.status) params.status = searchParams.status;
      if (searchParams.program) params.programId = searchParams.program;
      if (searchParams.semester) params.semesterId = searchParams.semester;
      if (searchParams.sort) {
        const [sortBy, sortOrder] = searchParams.sort.split('.');
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }

      return await fetchUsers(params);
    },
  });
};


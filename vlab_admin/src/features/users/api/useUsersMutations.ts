import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/apiClient';

export const useUserMutations = () => {
  const queryClient = useQueryClient();

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const createUser = useMutation({
    mutationFn: async (data: any) => {
      // Map frontend model to backend camelCase DTO
      const payload = {
        fullName: data.FullName,
        email: data.Email,
        phoneNumber: data.PhoneNumber,
        password: data.password,
        roleId: data.Role === 'admin' ? 1 : data.Role === 'instructor' ? 2 : 3, // Basic mapping for now
        programId: data.ProgramId || null,
        semesterId: data.SemesterId || null,
        enrollmentNumber: data.EnrollmentNumber || null,
        status: 'active'
      };
      return await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateUsers,
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: any }) => {
      const payload = {
        fullName: data.FullName,
        email: data.Email,
        phoneNumber: data.PhoneNumber,
        password: data.password || undefined,
        roleId: data.Role === 'admin' ? 1 : data.Role === 'instructor' ? 2 : 3,
        programId: data.ProgramId || null,
        semesterId: data.SemesterId || null,
        enrollmentNumber: data.EnrollmentNumber || null,
      };
      return await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateUsers,
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: invalidateUsers,
  });

  const assignCredits = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      return await apiRequest(`/users/${userId}/credits`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: invalidateUsers,
  });

  return {
    createUser,
    updateUser,
    deleteUser,
    assignCredits,
  };
};

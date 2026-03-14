import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listCapps, getCapp, createCapp, updateCapp, deleteCapp } from '@/api/capps';
import { Capp } from '@/types/capp';

export function useCapps(namespace?: string) {
  return useQuery({
    queryKey: ['capps', namespace ?? 'all'],
    queryFn: () => listCapps(namespace),
    select: (data) => data.items,
  });
}

export function useCapp(namespace: string, name: string) {
  return useQuery({
    queryKey: ['capp', namespace, name],
    queryFn: () => getCapp(namespace, name),
    enabled: Boolean(namespace && name),
  });
}

export function useCreateCapp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ namespace, capp }: { namespace: string; capp: Partial<Capp> }) =>
      createCapp(namespace, capp),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps'] });
      queryClient.invalidateQueries({ queryKey: ['capps', variables.namespace] });
    },
  });
}

export function useUpdateCapp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      name,
      capp,
    }: {
      namespace: string;
      name: string;
      capp: Capp;
    }) => updateCapp(namespace, name, capp),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps'] });
      queryClient.invalidateQueries({ queryKey: ['capp', variables.namespace, variables.name] });
    },
  });
}

export function useDeleteCapp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ namespace, name }: { namespace: string; name: string }) =>
      deleteCapp(namespace, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['capps'] });
      queryClient.invalidateQueries({ queryKey: ['capp', variables.namespace, variables.name] });
    },
  });
}

import { createContext, useContext } from 'react';
import type { DataSource } from '../api/types';

const SourceContext = createContext<DataSource | null>(null);

export const SourceProvider = SourceContext.Provider;

export function useSource(): DataSource {
  const source = useContext(SourceContext);
  if (!source) throw new Error('useSource must be used inside a SourceProvider');
  return source;
}

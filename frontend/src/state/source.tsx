import { createContext, useContext, type ReactNode } from 'react';
import type { DataSource } from '../api/types';
import { LiveSource } from '../api/live';
import { DemoPreloader } from '../features/demo/DemoPreloader';

const SourceContext = createContext<DataSource | null>(null);

export function SourceProvider({ value, children }: { value: DataSource; children: ReactNode }) {
  return <SourceContext.Provider value={value}>
    {value instanceof LiveSource && <DemoPreloader source={value} />}
    {children}
  </SourceContext.Provider>;
}

export function useSource(): DataSource {
  const source = useContext(SourceContext);
  if (!source) throw new Error('useSource must be used inside a SourceProvider');
  return source;
}

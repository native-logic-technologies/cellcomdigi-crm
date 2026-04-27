import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Page } from '../components/Layout';

interface NavigationContextValue {
  page: Page;
  setPage: (p: Page) => void;
  pendingAction: string | null;
  navigate: (p: Page, action?: string) => void;
  clearAction: () => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  page: 'dashboard',
  setPage: () => {},
  pendingAction: null,
  navigate: () => {},
  clearAction: () => {},
});

export function NavigationProvider({ children, page, setPage }: {
  children: ReactNode;
  page: Page;
  setPage: (p: Page) => void;
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const navigate = useCallback((p: Page, action?: string) => {
    setPage(p);
    setPendingAction(action ?? null);
  }, [setPage]);

  const clearAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ page, setPage, pendingAction, navigate, clearAction }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

import { useState, useCallback } from "react";

type ModalRecord<T extends string> = Partial<Record<T, boolean>>;

export function useModalState<T extends string>(...keys: T[]) {
  const initial = keys.reduce<ModalRecord<T>>((acc, k) => {
    acc[k] = false;
    return acc;
  }, {});

  const [state, setState] = useState<ModalRecord<T>>(initial);

  const show = useCallback((key: T) => {
    setState((prev) => ({ ...prev, [key]: true }));
  }, []);

  const hide = useCallback((key: T) => {
    setState((prev) => ({ ...prev, [key]: false }));
  }, []);

  const toggle = useCallback((key: T) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isVisible = useCallback((key: T) => !!state[key], [state]);

  return { show, hide, toggle, isVisible };
}

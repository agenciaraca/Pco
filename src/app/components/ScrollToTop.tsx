import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scroll para o topo automaticamente quando a rota muda.
 * Mounted no root das layouts (StudentLayout, AdminLayout) — sem render.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Smooth desliga em mobile pra evitar lag perceptível
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

import { type RefObject, useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Focus handling for the evidence panel. Escape always closes it. When it is shown as a modal
 * sheet (narrow screens) focus moves in, Tab is kept inside, the page behind does not scroll,
 * and focus returns to the control that opened it.
 */
export function usePanelFocus(ref: RefObject<HTMLElement | null>, options: { modal: boolean; onClose: () => void; focusKey: string }) {
  const { modal, onClose, focusKey } = options;

  useEffect(() => {
    const panel = ref.current;
    if (!panel || !modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref, modal, focusKey]);

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => panel.removeEventListener('keydown', onKey);
  }, [ref, modal, onClose]);
}

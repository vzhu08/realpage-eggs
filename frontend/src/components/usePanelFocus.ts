import { type RefObject, useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * True when Tab can land on the element. Content of a closed <details> is skipped by the
 * browser without being `display: none`, so `offsetParent` alone would count it; if the last
 * such element were taken for the end of the panel, Tab would walk out of a modal panel.
 */
function reachable(item: HTMLElement): boolean {
  const closed = item.closest('details:not([open])');
  if (closed && !(item.tagName === 'SUMMARY' && item.parentElement === closed)) return false;
  if (typeof item.checkVisibility === 'function') return item.checkVisibility({ visibilityProperty: true });
  return item.offsetParent !== null;
}

/**
 * Focus handling for the evidence panel and the property chooser. Escape always closes it. When it is shown as a modal
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
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(reachable);
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

import type * as React from "react";

const NOT_FIELD = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "file",
  "hidden",
  "image",
]);

const isField = (el: HTMLElement): boolean => {
  if (el instanceof HTMLInputElement) {
    if (NOT_FIELD.has(el.type) || el.readOnly) return false;
  } else if (!(el instanceof HTMLSelectElement)) {
    return false;
  }
  const f = el as HTMLInputElement | HTMLSelectElement;
  if (f.disabled || f.tabIndex < 0) return false;
  return f.offsetParent !== null; // hidden (display:none) fields are skipped
};

export const editableFields = (
  root: HTMLElement,
): Array<HTMLInputElement | HTMLSelectElement> =>
  Array.from(root.querySelectorAll<HTMLElement>("input, select")).filter(
    isField,
  ) as Array<HTMLInputElement | HTMLSelectElement>;

const focusField = (el: HTMLInputElement | HTMLSelectElement) => {
  el.focus();
  if (
    el instanceof HTMLInputElement &&
    ["text", "number", "search", "tel", "email"].includes(el.type)
  ) {
    try {
      el.select();
    } catch {
      /* some input types cannot select */
    }
  }
};

export const focusFirstEmpty = (root: HTMLElement): void => {
  const empty = editableFields(root).find((f) => f.value.trim() === "");
  if (empty) focusField(empty);
};

export function handleEnterNext(
  e: React.KeyboardEvent<HTMLElement>,
  opts: {
    onLast?: (root: HTMLElement) => void;

    skip?: (el: HTMLElement) => boolean;
  } = {},
): void {
  if (
    e.key !== "Enter" ||
    e.shiftKey ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey ||
    e.nativeEvent.isComposing
  )
    return;
  const target = e.target as HTMLElement;
  if (!isField(target)) return;
  if (opts.skip?.(target)) return;
  e.preventDefault();
  const root = e.currentTarget;
  const fields = editableFields(root);
  const at = fields.indexOf(target as HTMLInputElement | HTMLSelectElement);
  if (at < 0) return;
  const next = fields[at + 1];
  if (next) focusField(next);
  else opts.onLast?.(root);
}

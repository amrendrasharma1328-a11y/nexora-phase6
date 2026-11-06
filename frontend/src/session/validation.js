/** Client-side form validation. Mirrors backend/src/validation/inputs.js so users see errors before a request. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const OPERATOR_PATTERN = /^[\p{L}\p{N} ._'-]+$/u;

export const LIMITS = { operatorMax: 40, routeNameMax: 80 };

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

/** Optional operator name. @returns {{value: string}|{error: string}} */
export function validateOperatorName(raw) {
  const value = collapse(raw ?? '');
  if (value === '') return { value: '' };
  if (value.length > LIMITS.operatorMax) return { error: `Use ${LIMITS.operatorMax} characters or fewer (now ${value.length}).` };
  if (!OPERATOR_PATTERN.test(value)) return { error: "Use letters, numbers, spaces and . _ ' - only." };
  return { value };
}

/** Saved-route name (required). @returns {{value: string}|{error: string}} */
export function validateRouteName(raw) {
  const value = collapse(raw ?? '');
  if (value === '') return { error: 'Enter a name for this route.' };
  if (CONTROL_CHARS.test(value)) return { error: 'The name contains unsupported characters.' };
  if (value.length > LIMITS.routeNameMax) return { error: `Use ${LIMITS.routeNameMax} characters or fewer (now ${value.length}).` };
  return { value };
}

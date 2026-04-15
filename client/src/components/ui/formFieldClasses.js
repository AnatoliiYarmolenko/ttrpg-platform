export const FORM_FIELD_CONTROL_BASE_CLASSES =
  'w-full px-4 py-3 rounded-xl border-2 text-brand-dark placeholder:text-brand-medium/70 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed';
export const FORM_FIELD_CONTROL_DEFAULT_CLASSES =
  'border-brand-light/30 focus:border-brand-dark';
export const FORM_FIELD_CONTROL_ERROR_CLASSES =
  'border-red-500 focus:border-red-600';

export function getFormFieldControlClasses({ error, className = '' } = {}) {
  const statusClasses = error
    ? FORM_FIELD_CONTROL_ERROR_CLASSES
    : FORM_FIELD_CONTROL_DEFAULT_CLASSES;

  return `${FORM_FIELD_CONTROL_BASE_CLASSES} ${statusClasses} ${className}`.trim();
}

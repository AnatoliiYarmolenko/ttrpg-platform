import React from 'react';

export const FORM_FIELD_CONTROL_BASE_CLASSES =
  'w-full px-4 py-3 rounded-xl border-2 text-brand-dark placeholder:text-brand-medium/70 transition-colors focus:outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed';
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

/**
 * FormField — стандартне поле форми з label/hint/error та уніфікованими стилями.
 *
 * Підтримує 2 режими:
 * 1) children-режим (повна кастомізація control)
 * 2) вбудований control через props (as/input/textarea/select)
 */
export default function FormField({
  as = 'input',
  id,
  name,
  type = 'text',
  label,
  value,
  defaultValue,
  onChange,
  onBlur,
  placeholder,
  disabled,
  required = false,
  autoComplete,
  maxLength,
  minLength,
  min,
  max,
  step,
  rows = 4,
  inputMode,
  error,
  hint,
  register,
  rules,
  children,
  className,
  controlClassName,
  ...rest
}) {
  const fieldId = id || name;
  const errorText = typeof error === 'string' ? error : error?.message;
  const registerProps = register && name ? register(name, rules) : {};

  const shouldRenderControl = !children;
  const controlClasses = getFormFieldControlClasses({
    error: Boolean(errorText),
    className: controlClassName,
  });

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-2 block text-sm font-medium text-brand-dark"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {shouldRenderControl && as === 'textarea' && (
        <textarea
          id={fieldId}
          name={name}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          rows={rows}
          className={controlClasses}
          aria-invalid={Boolean(errorText)}
          {...registerProps}
          {...rest}
        />
      )}

      {shouldRenderControl && as !== 'textarea' &&
        React.createElement(as, {
          id: fieldId,
          name,
          type,
          value,
          defaultValue,
          onChange,
          onBlur,
          placeholder,
          disabled,
          required,
          autoComplete,
          maxLength,
          minLength,
          min,
          max,
          step,
          inputMode,
          className: controlClasses,
          'aria-invalid': Boolean(errorText),
          ...registerProps,
          ...rest,
        })}

      {children}

      {errorText && <p className="mt-1 text-xs text-red-500">{errorText}</p>}
      {hint && !errorText && <p className="mt-1 text-xs text-brand-medium">{hint}</p>}
    </div>
  );
}

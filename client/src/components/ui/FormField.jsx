import React from 'react';
import PropTypes from 'prop-types';
import {
  getFormFieldControlClasses,
} from './formFieldClasses';

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

FormField.propTypes = {
  as: PropTypes.elementType,
  id: PropTypes.string,
  name: PropTypes.string,
  type: PropTypes.string,
  label: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  autoComplete: PropTypes.string,
  maxLength: PropTypes.number,
  minLength: PropTypes.number,
  min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  max: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  step: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  rows: PropTypes.number,
  inputMode: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  hint: PropTypes.node,
  register: PropTypes.func,
  rules: PropTypes.object,
  children: PropTypes.node,
  className: PropTypes.string,
  controlClassName: PropTypes.string,
};

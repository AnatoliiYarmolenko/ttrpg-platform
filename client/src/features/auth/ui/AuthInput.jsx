import React from 'react';
import FormField from '@/components/ui/FormField';

export default function AuthInput({ 
  type = "text", 
  placeholder, 
  register, 
  name, 
  rules, 
  error, 
  disabled,
  className,
  id,
  ...rest 
}) {
  return (
    <FormField
      as="input"
      id={id || name}
      name={name}
      type={type}
      placeholder={placeholder}
      register={register}
      rules={rules}
      error={error}
      disabled={disabled}
      className={`w-full ${className || ''}`.trim()}
      {...rest}
    />
  );
}
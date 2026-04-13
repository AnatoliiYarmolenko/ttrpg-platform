/**
 * FormField — обгортка для поля форми з лейблом та повідомленням про помилку.
 *
 * Забезпечує семантичний зв'язок label ↔ input через htmlFor/id,
 * уніфіковані стилі лейблів і виведення помилок.
 *
 * Використання:
 *   <FormField id="title" label="Назва" error={errors.title} required>
 *     <input id="title" name="title" ... />
 *   </FormField>
 *
 * @param {string}    id        — id поля (має збігатися з id input/select/textarea)
 * @param {string}    label     — текст лейблу
 * @param {string}    [error]   — повідомлення про помилку
 * @param {string}    [hint]    — підказка під полем (відображається якщо немає помилки)
 * @param {boolean}   [required=false] — додає * до лейблу
 * @param {ReactNode} children  — поле форми (input, select, textarea тощо)
 */
export default function FormField({
  id,
  label,
  error,
  hint,
  required = false,
  children,
}) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-brand-dark mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-brand-medium mt-1">{hint}</p>}
    </div>
  );
}

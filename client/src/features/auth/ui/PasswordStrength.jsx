function Item({ isValid, label }) {
  return (
    <div className={`flex items-center gap-1 ${isValid ? 'text-brand-medium font-bold' : 'text-gray-400'}`}>
      <span>{isValid ? '✓' : '○'}</span> {label}
    </div>
  );
}

export default function PasswordStrength({ password }) {
    if (!password) return null;
  
    const checks = {
      length: password.length >= 8,
      lower: /[a-zа-яіїєґ]/.test(password),
      upper: /[A-ZА-ЯІЇЄҐ]/.test(password),
      number: /\d/.test(password),
    };
  
    return (
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Item isValid={checks.length} label="8+ символів" />
        <Item isValid={checks.lower} label="Мала літера" />
        <Item isValid={checks.upper} label="Велика літера" />
        <Item isValid={checks.number} label="Цифра" />
      </div>
    );
  }
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border-2 border-brand-light/30 rounded-2xl shadow-xl p-8">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-brand-dark mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-brand-medium">
                {subtitle}
              </p>
            )}
          </div>

          {/* Тут буде сама форма */}
          {children}
          
        </div>
      </div>
    </div>
  );
}
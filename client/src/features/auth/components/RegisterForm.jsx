import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { registerUser } from "../api/authApi";
import AuthInput from "../ui/AuthInput";
import AuthButton from "../ui/AuthButton";
import PasswordStrength from "../ui/PasswordStrength";
import { VALIDATION_RULES } from "../../../utils/validationRules";
import { toast } from "@/stores/useToastStore";
import logger from "../../../lib/clientLogger";

function applyRegisterValidationErrors(errors, setError) {
  if (!Array.isArray(errors)) {
    return false;
  }

  errors.forEach((entry) => {
    if (entry.path) {
      setError(entry.path, { type: 'server', message: entry.message });
    }
  });

  return true;
}

function applyRegisterFieldError(errorText, setError) {
  const normalizedText = errorText.toLowerCase();
  let handled = false;

  if (normalizedText.includes('email') || normalizedText.includes('пошта')) {
    setError('email', {
      type: 'server',
      message: 'Цей email вже використовується',
    });
    handled = true;
  }

  if (normalizedText.includes('nickname') || normalizedText.includes('username') || normalizedText.includes('нікнейм')) {
    setError('username', {
      type: 'server',
      message: 'Цей нікнейм зайнятий',
    });
    handled = true;
  }

  return handled;
}

function handleRegisterSubmitError(error, setError) {
  const responseData = error.response?.data;
  logger.error('Помилка реєстрації:', responseData);

  if (error.response?.status === 429) {
    toast.error(responseData?.error || 'Занадто багато спроб. Спробуйте пізніше.');
    return;
  }

  if (applyRegisterValidationErrors(responseData?.errors, setError)) {
    return;
  }

  if (responseData?.error) {
    if (!applyRegisterFieldError(responseData.error, setError)) {
      toast.error(responseData.error);
    }
    return;
  }

  toast.error('Помилка реєстрації. Спробуйте пізніше.');
}

function RegisterForm({ onSuccess }) {
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { isSubmitting, errors },
  } = useForm({ mode: "onChange" });

  const password = useWatch({ control, name: "password", defaultValue: "" });

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
      if (onSuccess) onSuccess(data.email);
    } catch (error) {
      handleRegisterSubmitError(error, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <AuthInput
        name="username"
        type="text"
        placeholder="Нікнейм"
        register={register}
        error={errors.username}
        rules={VALIDATION_RULES.username}
      />

      <AuthInput
        name="email"
        type="email"
        placeholder="Email"
        register={register}
        error={errors.email}
        rules={VALIDATION_RULES.email}
      />

      <AuthInput
        name="password"
        type="password"
        placeholder="Пароль"
        register={register}
        error={errors.password}
        rules={VALIDATION_RULES.password}
      />

      <PasswordStrength password={password} />

      <AuthButton isLoading={isSubmitting} loadingText="Реєстрація...">
        Зареєструватись
      </AuthButton>

      <div className="mt-6 text-center">
        <p className="text-brand-dark">
          Вже є акаунт?{" "}
          <Link to="/login" className="text-brand-accent hover:text-brand-medium font-semibold transition-colors">
            Увійти
          </Link>
        </p>
      </div>
    </form>
  );
}

export default RegisterForm;

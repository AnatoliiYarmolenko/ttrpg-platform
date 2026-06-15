import { useNavigate } from 'react-router-dom';
import ErrorScreen from './ErrorScreen';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorScreen
      message="Сторінку не знайдено"
      onAction={() => navigate('/', { replace: true })}
      actionLabel="На головну"
    />
  );
}

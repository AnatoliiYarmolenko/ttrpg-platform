import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '@/stores/useAuthStore';
import { logoutUser } from '@/features/auth/api/authApi';
import { ConfirmModal } from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
import {
  useAdminStatsQuery,
  useAdminUsersQuery,
  useAdminCampaignsQuery,
  useAdminSessionsQuery,
  useAdminMutations,
} from '../hooks/useAdminQueries';
import StatsCards from '../components/StatsCards';
import AdminSearchBar from '../components/AdminSearchBar';
import AdminPagination from '../components/AdminPagination';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import NavButton from '@/components/ui/NavButton';
import Button from '@/components/ui/Button';
import Dice20 from '@/components/ui/icons/Dice20';
import {
  parseEnumSearchParam,
  setOrDeleteParam,
  updateSearchParams,
} from '@/utils/urlState';

// Вкладки адмін-панелі
const TABS = {
  DASHBOARD: 'dashboard',
  USERS: 'users',
  CAMPAIGNS: 'campaigns',
  SESSIONS: 'sessions',
};
const TAB_VALUES = Object.values(TABS);
const TAB_PARAM = 'tab';

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);
  const { openConfirm, confirmModalProps } = useConfirmDialog();
  const activeTab = parseEnumSearchParam(searchParams, TAB_PARAM, TAB_VALUES, TABS.DASHBOARD);
  const setActiveTab = useCallback((nextTab) => {
    const normalizedTab = TAB_VALUES.includes(nextTab) ? nextTab : TABS.DASHBOARD;
    updateSearchParams(setSearchParams, (next) => {
      setOrDeleteParam(next, TAB_PARAM, normalizedTab, TABS.DASHBOARD);
    });
  }, [setSearchParams]);

  // Users state
  const [usersSearchInput, setUsersSearchInput] = useState('');
  const [usersParams, setUsersParams] = useState({ page: 1, search: '' });

  // Campaigns state
  const [campaignsSearchInput, setCampaignsSearchInput] = useState('');
  const [campaignsParams, setCampaignsParams] = useState({ page: 1, search: '' });

  // Sessions state
  const [sessionsSearchInput, setSessionsSearchInput] = useState('');
  const [sessionsStatusFilter, setSessionsStatusFilter] = useState('');
  const [sessionsParams, setSessionsParams] = useState({ page: 1, search: '', status: '' });

  // Delete modal
  const [deleteModal, setDeleteModal] = useState({ open: false, type: '', id: null, title: '' });

  // Queries
  const { data: stats, isLoading: statsLoading } = useAdminStatsQuery({ enabled: activeTab === TABS.DASHBOARD });
  
  const { data: usersData, isLoading: usersLoading } = useAdminUsersQuery(usersParams, { enabled: activeTab === TABS.USERS });
  const users = usersData?.users ?? [];
  const usersPagination = usersData?.pagination ?? null;

  const { data: campaignsData, isLoading: campaignsLoading } = useAdminCampaignsQuery(campaignsParams, { enabled: activeTab === TABS.CAMPAIGNS });
  const campaigns = campaignsData?.campaigns ?? [];
  const campaignsPagination = campaignsData?.pagination ?? null;

  const { data: sessionsData, isLoading: sessionsLoading } = useAdminSessionsQuery(sessionsParams, { enabled: activeTab === TABS.SESSIONS });
  const sessions = sessionsData?.sessions ?? [];
  const sessionsPagination = sessionsData?.pagination ?? null;

  const mutations = useAdminMutations();

  useEffect(() => {
    const rawTab = searchParams.get(TAB_PARAM);
    if (!rawTab || rawTab === activeTab) {
      return;
    }

    updateSearchParams(setSearchParams, (next) => {
      setOrDeleteParam(next, TAB_PARAM, activeTab, TABS.DASHBOARD);
    }, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  // ============== Видалення ==============

  const handleDelete = async () => {
    try {
      if (deleteModal.type === 'campaign') {
        await mutations.deleteCampaign(deleteModal.id);
      } else if (deleteModal.type === 'session') {
        await mutations.deleteSession(deleteModal.id);
      }
      setDeleteModal({ open: false, type: '', id: null, title: '' });
    } catch {
      // Помилки вже оброблені у mutations
    }
  };

  // ============== Logout ==============

  const handleLogout = async () => {
    try {
      await logoutUser();
    } finally {
      clearUser();
      navigate('/login');
    }
  };

  const handleLogoutClick = () => {
    openConfirm({
      title: 'Вийти з акаунту?',
      message: 'Після виходу доведеться знову авторизуватися.',
      variant: 'danger',
      confirmText: 'Вийти',
      onConfirm: handleLogout,
    });
  };

  // ============== Форматування ==============

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const statusLabels = {
    PLANNED: 'Заплановано',
    ACTIVE: 'Активна',
    FINISHED: 'Завершена',
    CANCELED: 'Скасована',
  };

  const statusColors = {
    PLANNED: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    FINISHED: 'bg-gray-100 text-gray-600',
    CANCELED: 'bg-red-100 text-red-600',
  };

  const visibilityLabels = {
    PUBLIC: 'Публічна',
    PRIVATE: 'Приватна',
    LINK_ONLY: 'За посиланням',
  };

  const adminTabs = [
    { key: TABS.DASHBOARD, label: 'Огляд', to: '/admin' },
    { key: TABS.USERS, label: 'Користувачі', to: '/admin?tab=users' },
    { key: TABS.CAMPAIGNS, label: 'Кампанії', to: '/admin?tab=campaigns' },
    { key: TABS.SESSIONS, label: 'Сесії', to: '/admin?tab=sessions' },
  ];

  // ============== Рендер таблиць ==============

  const renderUsersTable = () => (
    <div>
      <AdminSearchBar
        value={usersSearchInput}
        onChange={setUsersSearchInput}
        onSearch={() => setUsersParams(p => ({ ...p, page: 1, search: usersSearchInput }))}
        placeholder="Пошук за username, email або ім'ям..."
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-brand-light/30">
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Username</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Email</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Роль</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Рєстрація</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Кампанії</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Сесії</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-brand-light/10 hover:bg-brand-light/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{u.id}</td>
                <td className="py-2 px-3 font-medium text-brand-dark">{u.username}</td>
                <td className="py-2 px-3 text-gray-600">{u.email}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500">{formatDate(u.createdAt)}</td>
                <td className="py-2 px-3 text-gray-500">{u._count?.campaignsOwned ?? 0}</td>
                <td className="py-2 px-3 text-gray-500">{u._count?.ownedSessions ?? 0}</td>
              </tr>
            ))}
            {users.length === 0 && !usersLoading && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Нічого не знайдено</td></tr>
            )}
            {usersLoading && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Завантаження...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {usersPagination && (
        <AdminPagination
          page={usersPagination.page}
          totalPages={usersPagination.totalPages}
          onPageChange={(p) => setUsersParams(prev => ({ ...prev, page: p }))}
        />
      )}
    </div>
  );

  const renderCampaignsTable = () => (
    <div>
      <AdminSearchBar
        value={campaignsSearchInput}
        onChange={setCampaignsSearchInput}
        onSearch={() => setCampaignsParams(p => ({ ...p, page: 1, search: campaignsSearchInput }))}
        placeholder="Пошук за назвою або власником..."
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-brand-light/30">
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Назва</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Власник</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Система</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Статус</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Видимість</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Учасники</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Сесії</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Створено</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-brand-light/10 hover:bg-brand-light/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{c.id}</td>
                <td className="py-2 px-3 font-medium text-brand-dark max-w-[200px] truncate">{c.title}</td>
                <td className="py-2 px-3 text-gray-600">{c.owner?.username ?? '—'}</td>
                <td className="py-2 px-3 text-gray-500">{c.system || '—'}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[c.status] || c.status || 'ACTIVE'}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {visibilityLabels[c.visibility] || c.visibility}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500">{c._count?.members ?? 0}</td>
                <td className="py-2 px-3 text-gray-500">{c._count?.sessions ?? 0}</td>
                <td className="py-2 px-3 text-gray-500">{formatDate(c.createdAt)}</td>
                <td className="py-2 px-3">
                  <Button
                    onClick={() => setDeleteModal({ open: true, type: 'campaign', id: c.id, title: c.title })}
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    className="px-2 py-1 border-red-300 text-red-600 hover:bg-red-500"
                  >
                    Видалити
                  </Button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && !campaignsLoading && (
              <tr><td colSpan={10} className="py-8 text-center text-gray-400">Нічого не знайдено</td></tr>
            )}
            {campaignsLoading && (
              <tr><td colSpan={10} className="py-8 text-center text-gray-400">Завантаження...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {campaignsPagination && (
        <AdminPagination
          page={campaignsPagination.page}
          totalPages={campaignsPagination.totalPages}
          onPageChange={(p) => setCampaignsParams(prev => ({ ...prev, page: p }))}
        />
      )}
    </div>
  );

  const renderSessionsTable = () => (
    <div>
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1">
          <AdminSearchBar
            value={sessionsSearchInput}
            onChange={setSessionsSearchInput}
            onSearch={() => setSessionsParams(p => ({ ...p, page: 1, search: sessionsSearchInput }))}
            placeholder="Пошук за назвою або GM..."
          />
        </div>
        <select
          value={sessionsStatusFilter}
          onChange={(e) => { 
            const newStatus = e.target.value;
            setSessionsStatusFilter(newStatus); 
            setSessionsParams(p => ({ ...p, page: 1, status: newStatus }));
          }}
          className="px-3 py-2 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark text-brand-dark bg-white transition-colors"
        >
          <option value="">Всі статуси</option>
          <option value="PLANNED">Заплановано</option>
          <option value="ACTIVE">Активна</option>
          <option value="FINISHED">Завершена</option>
          <option value="CANCELED">Скасована</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-brand-light/30">
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Назва</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">GM</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Кампанія</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Статус</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Дата</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold">Гравці</th>
              <th className="text-left py-2 px-3 text-brand-dark font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-brand-light/10 hover:bg-brand-light/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{s.id}</td>
                <td className="py-2 px-3 font-medium text-brand-dark max-w-[200px] truncate">{s.title}</td>
                <td className="py-2 px-3 text-gray-600">{s.owner?.username ?? '—'}</td>
                <td className="py-2 px-3 text-gray-500">{s.campaign?.title || 'One-shot'}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[s.status] || s.status}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500">{formatDate(s.date)}</td>
                <td className="py-2 px-3 text-gray-500">{s._count?.participants ?? 0}/{s.maxPlayers}</td>
                <td className="py-2 px-3">
                  <Button
                    onClick={() => setDeleteModal({ open: true, type: 'session', id: s.id, title: s.title })}
                    variant="danger"
                    size="sm"
                    fullWidth={false}
                    className="px-2 py-1 border-red-300 text-red-600 hover:bg-red-500"
                  >
                    Видалити
                  </Button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && !sessionsLoading && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">Нічого не знайдено</td></tr>
            )}
            {sessionsLoading && (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">Завантаження...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {sessionsPagination && (
        <AdminPagination
          page={sessionsPagination.page}
          totalPages={sessionsPagination.totalPages}
          onPageChange={(p) => setSessionsParams(prev => ({ ...prev, page: p }))}
        />
      )}
    </div>
  );

  // ============== Контент вкладки ==============

  const renderTabContent = () => {
    if (activeTab === TABS.DASHBOARD && statsLoading && !stats) {
      return <div className="text-center py-12 text-gray-400">Завантаження статистики...</div>;
    }

    switch (activeTab) {
      case TABS.DASHBOARD:
        return (
          <div>
            <StatsCards stats={stats} />
            <div className="mt-6 bg-white rounded-xl border-2 border-brand-light/30 p-6">
              <h3 className="text-lg font-bold text-brand-dark mb-2">Адміністрування</h3>
              <p className="text-gray-500 text-sm">
                Використовуйте вкладки зверху для перегляду та модерації користувачів, кампаній і сесій.
                Функціональність буде розширюватися з часом.
              </p>
            </div>
          </div>
        );
      case TABS.USERS:
        return renderUsersTable();
      case TABS.CAMPAIGNS:
        return renderCampaignsTable();
      case TABS.SESSIONS:
        return renderSessionsTable();
      default:
        return null;
    }
  };

  // ============== Top Bar ==============

  const topBar = (
    <>
      <nav className="hidden lg:flex items-center gap-4 justify-between w-full">
        <div className="flex items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2">
            <Dice20 className="w-6 h-6 text-brand-dark" />
            <span className="font-bold text-brand-dark hidden md:block">Адмін-панель</span>
          </div>

          {adminTabs.map((tab) => (
            <NavButton
              key={tab.key}
              label={tab.label}
              isActive={activeTab === tab.key}
              to={tab.to}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          
          {user && (
            <span className="text-white font-medium drop-shadow-md hidden sm:block">
              {user.username}
            </span>
          )}
          <Button
            onClick={() => navigate('/')}
            variant="topbar"
            size="md"
            fullWidth={false}
          >
            На головну
          </Button>
          <Button
            onClick={handleLogoutClick}
            title="Вийти з акаунту"
            variant="topbar"
            size="md"
            fullWidth={false}
          >
            Вийти
          </Button>
        </div>
      </nav>

      <nav className="lg:hidden flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="bg-white px-3 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2 min-w-0">
            <Dice20 className="w-6 h-6 text-brand-dark" />
            <span className="font-bold text-brand-dark text-sm truncate">Адмін-панель</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => navigate('/')}
              variant="topbar"
              size="sm"
              fullWidth={false}
              className="whitespace-nowrap"
            >
              На головну
            </Button>
            <Button
              onClick={handleLogoutClick}
              title="Вийти з акаунту"
              variant="topbar"
              size="sm"
              fullWidth={false}
              className="whitespace-nowrap"
            >
              Вийти
            </Button>
          </div>
        </div>

        {user && (
          <span className="text-white/90 font-medium drop-shadow-md text-sm px-1 truncate">
            {user.username}
          </span>
        )}

        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex items-center gap-2 min-w-max">
            {adminTabs.map((tab) => (
              <NavButton
                key={tab.key}
                label={tab.label}
                isActive={activeTab === tab.key}
                to={tab.to}
                onClick={() => setActiveTab(tab.key)}
                className="px-3 py-1.5 text-sm whitespace-nowrap flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );

  // ============== Main Content ==============

  const mainContent = (
    <div className="bg-white border-2 border-brand-light/30 rounded-2xl shadow-xl h-full overflow-y-auto p-6">
      {renderTabContent()}
    </div>
  );

  return (
    <>
      <div className="h-dvh bg-brand-dark p-3 lg:p-4 flex flex-col gap-3 relative overflow-hidden">
        <header className="relative z-10 w-full">
          {topBar}
        </header>

        <main className="relative z-10 flex-1 min-h-0 overflow-hidden">
          {mainContent}
        </main>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModal.open}
        title={`Видалити ${deleteModal.type === 'campaign' ? 'кампанію' : 'сесію'}?`}
        message={`Ви впевнені, що хочете видалити "${deleteModal.title}"? Цю дію неможливо скасувати.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal({ open: false, type: '', id: null, title: '' })}
      />

      <ConfirmModal {...confirmModalProps} />
    </>
  );
}

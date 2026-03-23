import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/stores/useAuthStore';
import { logoutUser } from '@/features/auth/api/authApi';
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

// Вкладки адмін-панелі
const TABS = {
  DASHBOARD: 'dashboard',
  USERS: 'users',
  CAMPAIGNS: 'campaigns',
  SESSIONS: 'sessions',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearUser = useAuthStore((state) => state.clearUser);

  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);

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
            <tr className="border-b-2 border-[#9DC88D]/30">
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Username</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Email</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Роль</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Рєстрація</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Кампанії</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Сесії</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-[#9DC88D]/10 hover:bg-[#9DC88D]/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{u.id}</td>
                <td className="py-2 px-3 font-medium text-[#164A41]">{u.username}</td>
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
            <tr className="border-b-2 border-[#9DC88D]/30">
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Назва</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Власник</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Система</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Статус</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Видимість</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Учасники</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Сесії</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Створено</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[#9DC88D]/10 hover:bg-[#9DC88D]/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{c.id}</td>
                <td className="py-2 px-3 font-medium text-[#164A41] max-w-[200px] truncate">{c.title}</td>
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
                  <button
                    onClick={() => setDeleteModal({ open: true, type: 'campaign', id: c.id, title: c.title })}
                    className="text-red-400 hover:text-red-600 transition-colors font-medium text-xs"
                  >
                    Видалити
                  </button>
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
          className="px-3 py-2 rounded-xl border-2 border-[#9DC88D]/30 focus:border-[#164A41] focus:outline-none text-[#164A41] bg-white transition-colors"
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
            <tr className="border-b-2 border-[#9DC88D]/30">
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">ID</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Назва</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">GM</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Кампанія</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Статус</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Дата</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold">Гравці</th>
              <th className="text-left py-2 px-3 text-[#164A41] font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-[#9DC88D]/10 hover:bg-[#9DC88D]/5 transition-colors">
                <td className="py-2 px-3 text-gray-500">{s.id}</td>
                <td className="py-2 px-3 font-medium text-[#164A41] max-w-[200px] truncate">{s.title}</td>
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
                  <button
                    onClick={() => setDeleteModal({ open: true, type: 'session', id: s.id, title: s.title })}
                    className="text-red-400 hover:text-red-600 transition-colors font-medium text-xs"
                  >
                    Видалити
                  </button>
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
            <div className="mt-6 bg-white rounded-xl border-2 border-[#9DC88D]/30 p-6">
              <h3 className="text-lg font-bold text-[#164A41] mb-2">Адміністрування</h3>
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
    <nav className="flex items-center gap-4 justify-between w-full">
      <div className="flex items-center gap-4">
        <div className="bg-white px-4 py-2 rounded-xl border-2 border-[#9DC88D]/30 shadow-md flex items-center gap-2">
          <div className="w-6 h-6 bg-[#164A41] rounded-full flex items-center justify-center text-[#F1B24A] font-bold text-xs">
            ⚙
          </div>
          <span className="font-bold text-[#164A41] hidden md:block">Адмін-панель</span>
        </div>

        <NavButton
          label="Огляд"
          isActive={activeTab === TABS.DASHBOARD}
          onClick={() => setActiveTab(TABS.DASHBOARD)}
        />
        <NavButton
          label="Користувачі"
          isActive={activeTab === TABS.USERS}
          onClick={() => setActiveTab(TABS.USERS)}
        />
        <NavButton
          label="Кампанії"
          isActive={activeTab === TABS.CAMPAIGNS}
          onClick={() => setActiveTab(TABS.CAMPAIGNS)}
        />
        <NavButton
          label="Сесії"
          isActive={activeTab === TABS.SESSIONS}
          onClick={() => setActiveTab(TABS.SESSIONS)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl border-2 border-white/50 bg-[#4D774E] text-white hover:bg-[#9DC88D] hover:text-[#164A41] transition-all font-bold shadow-lg"
        >
          На головну
        </button>
        {user && (
          <span className="text-white font-medium drop-shadow-md hidden sm:block">
            {user.username}
          </span>
        )}
        <button
          onClick={handleLogout}
          title="Вийти з акаунту"
          className="px-4 py-2 rounded-xl border-2 border-white/50 bg-[#164A41] text-white hover:bg-[#F1B24A] hover:text-[#164A41] hover:border-[#164A41] transition-all font-bold shadow-lg"
        >
          Вийти
        </button>
      </div>
    </nav>
  );

  // ============== Main Content ==============

  const mainContent = (
    <div className="bg-white border-2 border-[#9DC88D]/30 rounded-2xl shadow-xl h-full overflow-y-auto p-6">
      {renderTabContent()}
    </div>
  );

  return (
    <>
      <div className="h-screen bg-[#164A41] p-3 lg:p-4 flex flex-col gap-3 relative overflow-hidden">
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
        isLoading={deleting}
      />
    </>
  );
}

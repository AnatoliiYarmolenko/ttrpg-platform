import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CampaignNextSessionWidget from '@/features/campaigns/components/widgets/CampaignNextSessionWidget';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

const baseSession = {
  id: 55,
  title: 'The Sunless Citadel',
  description: 'Наступна пригода.',
  startAt: '2026-04-25T18:00:00.000Z',
  duration: 180,
  status: 'PLANNED',
  visibility: 'PRIVATE',
  system: 'D&D 5e',
  maxPlayers: 5,
  participantsSummaryCount: 3,
  ownerId: 10,
  owner: {
    id: 10,
    username: 'gm',
    displayName: 'GM',
  },
};

describe('CampaignNextSessionWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('renders campaign title as link when navigation target is available', () => {
    render(
      <MemoryRouter>
        <CampaignNextSessionWidget
          sessions={[baseSession]}
          campaignTitle="Hidden Realm"
          campaignNavigationTarget="/campaign/901"
        />
      </MemoryRouter>
    );

    const campaignLink = screen.getByRole('link', { name: 'Hidden Realm' });
    expect(campaignLink).toHaveAttribute('href', '/campaign/901');
  });

  it('renders campaign title as plain text when navigation target is unavailable', () => {
    render(
      <MemoryRouter>
        <CampaignNextSessionWidget
          sessions={[baseSession]}
          campaignTitle="Hidden Realm"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Hidden Realm')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hidden Realm' })).not.toBeInTheDocument();
  });

  it('preserves campaign share token when opening session', async () => {

    render(
      <MemoryRouter>
        <CampaignNextSessionWidget
          sessions={[baseSession]}
          campaignTitle="Hidden Realm"
          campaignNavigationTarget="/campaign/share/abc123"
          campaignShareToken="abc123"
        />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Перейти до сесії' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/session/55?campaignShareToken=abc123');
  });
});

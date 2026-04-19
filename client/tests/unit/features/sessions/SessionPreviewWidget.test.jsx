import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionPagePreviewWidget from '@/features/sessions/components/widgets/SessionPreviewWidget';

describe('SessionPagePreviewWidget', () => {
  it('uses summary data for players count and confirmed GM message in preview mode', async () => {
    const session = {
      id: 77,
      title: 'Preview Session',
      description: 'desc',
      date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      maxPlayers: 4,
      ownerId: 10,
      owner: {
        id: 10,
        username: 'owner',
        displayName: 'Owner',
      },
      campaign: null,
      participants: [],
      participantsSummaryCount: 2,
      hasConfirmedGm: true,
    };

    render(
      <MemoryRouter>
        <SessionPagePreviewWidget
          session={session}
          onJoin={vi.fn().mockResolvedValue({ success: true })}
          canJoin={true}
          canApplyAsGm={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('2 / 4 гравців')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Приєднатись до сесії' }));

    expect(screen.getByText('Після підтвердження ви одразу приєднаєтесь як гравець.')).toBeInTheDocument();
    expect(screen.queryByText('У сесії поки немає підтвердженого GM. Оберіть роль, на яку хочете податися.')).not.toBeInTheDocument();
  });

  it('shows player-only message when GM application is unavailable', async () => {
    const session = {
      id: 78,
      title: 'Preview Session No GmApply',
      description: 'desc',
      date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      maxPlayers: 4,
      ownerId: 10,
      owner: {
        id: 10,
        username: 'owner',
        displayName: 'Owner',
      },
      campaign: null,
      participants: [],
      participantsSummaryCount: 1,
      hasConfirmedGm: false,
    };

    render(
      <MemoryRouter>
        <SessionPagePreviewWidget
          session={session}
          onJoin={vi.fn().mockResolvedValue({ success: true })}
          canJoin={true}
          canApplyAsGm={false}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Приєднатись до сесії' }));

    expect(screen.getByText('Бажаєте приєднатися як гравець?')).toBeInTheDocument();
    expect(screen.queryByText('У сесії поки немає підтвердженого GM. Оберіть роль, на яку хочете податися.')).not.toBeInTheDocument();
  });

  it('renders campaign title as link when campaign is visible and directly linkable', () => {
    const session = {
      id: 79,
      title: 'Preview Session Campaign Link',
      date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      owner: {
        id: 10,
        username: 'owner',
      },
      campaign: {
        id: 901,
        title: 'Hidden Realm',
        status: 'ACTIVE',
      },
      participants: [],
    };

    render(
      <MemoryRouter>
        <SessionPagePreviewWidget
          session={session}
          showCampaignInfo={true}
          canNavigateToCampaignDirectly={true}
        />
      </MemoryRouter>
    );

    const campaignLink = screen.getByRole('link', { name: 'Hidden Realm' });
    expect(campaignLink).toHaveAttribute('href', '/campaign/901');
  });

  it('renders campaign title as plain text when direct navigation is unavailable', () => {
    const session = {
      id: 80,
      title: 'Preview Session Text Campaign',
      date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      owner: {
        id: 10,
        username: 'owner',
      },
      campaign: {
        id: 902,
        title: 'Shown Without Link',
        status: 'ACTIVE',
      },
      participants: [],
    };

    render(
      <MemoryRouter>
        <SessionPagePreviewWidget
          session={session}
          showCampaignInfo={true}
          canNavigateToCampaignDirectly={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Кампанія:')).toBeInTheDocument();
    expect(screen.getByText('Shown Without Link')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Shown Without Link' })).not.toBeInTheDocument();
  });
});

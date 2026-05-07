export const invalidateDashboardCampaignsQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'campaigns'] });

export const invalidateDashboardGamesQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'games'] });

export const invalidateDashboardHomeQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'home'] });

export const invalidateCalendarQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['calendar'] });

export const invalidateDailySessionsQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['sessions', 'daily'] });

export const invalidateSearchCampaignsQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['search', 'campaigns'] });

export const invalidateSearchSessionsQuery = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ['search', 'sessions'] });

export const invalidateSessionCollectionQueries = (
  queryClient,
  {
    includeHome = true,
    includeSearch = true,
  } = {}
) => {
  const tasks = [
    invalidateDashboardGamesQuery(queryClient),
    invalidateCalendarQuery(queryClient),
    invalidateDailySessionsQuery(queryClient),
  ];

  if (includeHome) {
    tasks.push(invalidateDashboardHomeQuery(queryClient));
  }

  if (includeSearch) {
    tasks.push(invalidateSearchSessionsQuery(queryClient));
  }

  return Promise.allSettled(tasks);
};

export const invalidateCampaignCollectionQueries = (
  queryClient,
  {
    includeGames = false,
    includeHome = false,
    includeSearchSessions = false,
  } = {}
) => {
  const tasks = [
    invalidateDashboardCampaignsQuery(queryClient),
    invalidateSearchCampaignsQuery(queryClient),
  ];

  if (includeGames) {
    tasks.push(invalidateDashboardGamesQuery(queryClient));
  }

  if (includeHome) {
    tasks.push(invalidateDashboardHomeQuery(queryClient));
  }

  if (includeSearchSessions) {
    tasks.push(invalidateSearchSessionsQuery(queryClient));
  }

  return Promise.allSettled(tasks);
};

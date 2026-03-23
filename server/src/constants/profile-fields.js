const PUBLIC_PROFILE_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
};

const PRIVATE_PROFILE_FIELDS = {
  ...PUBLIC_PROFILE_FIELDS,
  email: true,
  role: true,
  timezone: true,
  language: true,
  lastActiveAt: true,
  updatedAt: true,
  emailVerified: true,
};

module.exports = {
  PUBLIC_PROFILE_FIELDS,
  PRIVATE_PROFILE_FIELDS,
};

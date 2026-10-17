export const routePaths = {
  login: '/login',
  register: '/register',
  verify: '/verify',
  dashboard: '/dashboard',
  deals: '/deals',
  deal: (id: string) => `/deals/${id}`,
  dealDetail: '/deals/:id',
  profile: '/profile',
} as const

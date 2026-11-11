export const routePaths = {
  login: '/login',
  register: '/register',
  verify: '/verify',
  dashboard: '/dashboard',
  deals: '/deals',
  deal: (id: string) => `/deals/${id}`,
  dealDetail: '/deals/:id',
  marketplace: '/marketplace',
  marketplaceDetail: '/marketplace/:id',
  profile: '/profile',
} as const

export const dealInclude = {
  financeInstructions: { orderBy: { createdAt: 'asc' as const } },
  borrower: true,
  collateral: true,
  disbursements: {
    where: { voidedAt: null },
    orderBy: { issuedAt: 'desc' as const },
  },
  payments: { where: { voidedAt: null }, orderBy: { paidAt: 'desc' as const } },
};

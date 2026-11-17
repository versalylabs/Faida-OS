export interface DeliverableItem {
  id: string;
  businessId: string;
  clientId?: string | null;
  title: string;
  description?: string | null;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface ClientItem {
  id: string;
  businessId: string;
  name: string;
  industry?: string | null;
  scope?: string | null;
  status: "ACTIVE" | "ONBOARDING" | "LEAD" | "PROPOSAL" | "COMPLETED" | "PAUSED" | string;
  contractType: "RETAINER" | "MILESTONE" | "ONE_TIME" | string;
  contractValue: number;
  billingCycle: "MONTHLY" | "PROJECT" | "QUARTERLY" | "ONE_TIME" | string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  health: "HEALTHY" | "ATTENTION" | "AT_RISK" | string;
  notes?: string | null;
  startDate?: string | null;
  createdAt: string;
  deliverables?: DeliverableItem[];
}

export interface MetricItem {
  id: string;
  businessId: string;
  weekStartDate: string;
  outreachSent: number;
  replyRateWarm: number;
  replyRateCold: number;
  auditsBooked: number;
  showRate: number;
  closeRate: number;
  avgTimeToLiveDays: number;
  mrr: number;
  clientChurnCount: number;
  referralsCount: number;
  cac: number;
  ltv: number;
  notes?: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  businessId: string;
  name: string;
  category: "EQUIPMENT" | "SOFTWARE" | "MARKETING" | "OFFICE" | "OTHER" | string;
  estimatedCost: number;
  actualCost?: number | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string;
  status: "WISHLIST" | "PLANNED" | "BOUGHT" | string;
  neededBy?: string | null;
  link?: string | null;
  notes?: string | null;
  purchasedAt?: string | null;
  createdAt: string;
}

export interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  color: string;
  mrr: number; // worked out from the active recurring clients
  projectValue: number;
  targetMrr: number;
  currency: string;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  clients: ClientItem[];
  weeklyMetrics: MetricItem[];
  deliverables: DeliverableItem[];
  purchases: PurchaseItem[];
}

export interface PortfolioSummary {
  totalBusinesses: number;
  activeClientsCount: number;
  totalContractValue: number;
  totalMrr: number;
  totalDeliverablesCount: number;
  pendingDeliverablesCount: number;
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
}

export interface TransactionItem {
  id: string;
  businessId: string | null;
  clientId: string | null;
  description: string;
  amount: number; // income positive, expense negative
  type: string;
  category: string;
  date: string;
  business?: { name: string; slug: string; color: string } | null;
  client?: { name: string } | null;
}

export interface FinanceOverview {
  month: { key: string; income: number; expense: number; net: number };
  perBusiness: {
    id: string;
    name: string;
    slug: string;
    color: string;
    income: number;
    expense: number;
    net: number;
    expectedMonthly: number;
    stillToCollect: number;
  }[];
  clients: { id: string; name: string; businessId: string; businessName: string; expected: number; paidThisMonth: number }[];
  months: { key: string; income: number; expense: number }[];
  expenseByCategory: { category: string; amount: number }[];
  transactions: TransactionItem[];
  accounts: { id: string; name: string; type: string; balance: number; color?: string | null }[];
  totalBalance: number;
  purchases: PurchaseItem[];
  purchaseSummary: { openCount: number; openEstimate: number };
}

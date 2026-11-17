/**
 * VersalyLabs: Business Plan Draft (28-product portfolio, pre-incorporation, pre-revenue), kept as data so the
 * VersalyLabs page can show it, track it against the calendar and tie products to your Projects.
 * Figures are the plan's own proposals and internal estimates, not audited results.
 */

/** The plan gives its timeline in months from the start ("Months 0 to 3"), so dates are counted from here. */
export const VERSALY_PLAN_START = "2026-11-17";

export const VERSALY_PROFILE = {
  oneLiner: "A Kenyan software company building practical, industry-specific business management systems.",
  stage: "Pre-incorporation, pre-revenue",
  hq: "Nairobi, Kenya",
  founders: ["Ted Khalwale", "Gregory Gichohi"],
  ownership: "Proposed 41% / 41% founders and 18% for investors (not yet legally issued)",
  valuation: "Founder-set target pre-money valuation of KSh 2,000,000 (not independently validated)",
  spendToDate: "About KSh 7,000, mainly development tools and two Claude Pro subscriptions (to be reconciled against payment records)",
  focus: "Validate three launch products in Nairobi before spreading wider: customer discovery, demos, pilots, then paying customers.",
  note: "Straten is the current income focus. VersalyLabs follows the validation-first plan below.",
};

export interface PortfolioProduct {
  name: string;
  aliases: string[]; // lower-case words that identify a matching Project
  completion: number; // internal estimate from the plan, not audited
  segment: string;
  tier: "priority" | "secondary" | "portfolio";
  what: string;
}

export const VERSALY_PORTFOLIO: PortfolioProduct[] = [
  { name: "Melio RMS", aliases: ["melio"], completion: 75, segment: "Restaurants, cafés, restaurant groups", tier: "priority", what: "POS, kitchen workflows, reservations, inventory, online ordering" },
  { name: "Mylkio", aliases: ["mylkio"], completion: 45, segment: "Small and medium dairy farmers", tier: "priority", what: "Milk production, cow records, animal health, pregnancy and immunisation tracking" },
  { name: "Dukaset Business MS", aliases: ["dukaset"], completion: 65, segment: "Retailers, wholesalers, growing SMEs", tier: "priority", what: "Unified SME management: selling, documents, money, reporting" },
  { name: "Vehisoft", aliases: ["vehisoft"], completion: 75, segment: "Vehicle dealerships and motor traders", tier: "secondary", what: "Dealership operations" },
  { name: "Semplo", aliases: ["semplo"], completion: 70, segment: "SMEs and larger organisations", tier: "secondary", what: "HR and payroll: recruitment, attendance, leave, payroll" },
  { name: "Pulse", aliases: ["pulse"], completion: 65, segment: "Gyms and fitness centres", tier: "secondary", what: "Memberships, attendance, subscriptions, payments" },
  { name: "Versaly CRM", aliases: ["versaly crm"], completion: 55, segment: "SMEs with sales or service operations", tier: "secondary", what: "Prospects, customers, pipelines, follow-ups" },
  { name: "Versandry", aliases: ["versandry"], completion: 45, segment: "Laundromats and commercial laundry", tier: "secondary", what: "Orders, garment tracking, payments" },
  { name: "LipaTim", aliases: ["lipatim"], completion: 40, segment: "Retailers, wholesalers, distributors", tier: "secondary", what: "Sales, stock, customers, payments" },
  { name: "Vensure", aliases: ["vensure"], completion: 40, segment: "SMEs, procurement teams, distributors", tier: "secondary", what: "Suppliers, purchasing, inventory" },
  { name: "Versaly Flow", aliases: ["versaly flow"], completion: 40, segment: "Social media managers and agencies", tier: "secondary", what: "Clients, content, publishing, campaigns" },
  { name: "Afyaware", aliases: ["afyaware"], completion: 45, segment: "Outpatient clinics, pharmacies, diagnostics", tier: "portfolio", what: "Patient records, billing, clinic workflows" },
  { name: "Versamail", aliases: ["versamail", "versaly mail"], completion: 45, segment: "SMEs, agencies, sales teams", tier: "portfolio", what: "Bulk email contacts and campaigns" },
  { name: "Versaleads", aliases: ["versaleads"], completion: 45, segment: "Sales teams, agencies, businesses", tier: "portfolio", what: "Lead acquisition, qualification, outreach" },
  { name: "Adversoft", aliases: ["adversoft"], completion: 35, segment: "Marketing and advertising agencies", tier: "portfolio", what: "Clients, campaigns, projects" },
  { name: "Fielys", aliases: ["fielys"], completion: 35, segment: "Field service and maintenance businesses", tier: "portfolio", what: "Service requests, field teams, work orders" },
  { name: "Fleesio", aliases: ["fleesio"], completion: 35, segment: "Transport, logistics, fleets", tier: "portfolio", what: "Vehicles and fleet operations" },
  { name: "Operra", aliases: ["operra"], completion: 35, segment: "Distributors and wholesalers", tier: "portfolio", what: "Inventory and distribution" },
  { name: "Structa", aliases: ["structa"], completion: 35, segment: "Construction companies and contractors", tier: "portfolio", what: "Construction project coordination" },
  { name: "Mortusoft", aliases: ["mortusoft"], completion: 30, segment: "Mortuaries and funeral providers", tier: "portfolio", what: "Mortuary records and operations" },
  { name: "Highland Gardens", aliases: ["highland"], completion: 25, segment: "Property developers and estate managers", tier: "portfolio", what: "Property and estate management" },
  { name: "Veloura Nails", aliases: ["veloura"], completion: 25, segment: "Nail technicians and salons", tier: "portfolio", what: "Client services and salon business" },
  { name: "Inframap", aliases: ["inframap"], completion: 15, segment: "Infrastructure developers, asset managers", tier: "portfolio", what: "Infrastructure mapping and information" },
  { name: "Inventory MS", aliases: ["inventory ms"], completion: 15, segment: "SMEs, retailers, stock-heavy businesses", tier: "portfolio", what: "Stock tracking and movements" },
  { name: "Hotel MS", aliases: ["hotel ms"], completion: 10, segment: "Hotels, lodges, accommodation", tier: "portfolio", what: "Accommodation operations" },
  { name: "Institution MS", aliases: ["institution ms"], completion: 10, segment: "Schools and institutions", tier: "portfolio", what: "Institutional records and processes" },
  { name: "Rental Property MS", aliases: ["rental property"], completion: 10, segment: "Landlords and property managers", tier: "portfolio", what: "Rental property management" },
  { name: "Skulivent", aliases: ["skulivent"], completion: 0, segment: "Secondary schools and event organisers", tier: "portfolio", what: "School event discovery and registration" },
];

/** Product readiness steps from the plan's Phase 1, used when a product is turned into a tracked project. */
export const VERSALY_READINESS_MILESTONES = [
  "Audit existing functionality",
  "Fix high-priority usability and functional issues",
  "Test across devices and screen sizes",
  "Review authentication, permissions, data protection and backups",
  "Prepare a demo environment with realistic sample data",
  "Record customer feedback from demos",
];

export interface VersalyPhase {
  id: string;
  name: string;
  fromMonth: number;
  toMonth: number;
  focus: string;
  activities: string[];
  outcome: string;
}

export const VERSALY_PHASES: VersalyPhase[] = [
  {
    id: "v1",
    name: "Phase 1: Product readiness and validation",
    fromMonth: 0,
    toMonth: 3,
    focus: "Melio RMS and Mylkio, with discovery and product definition for Dukaset.",
    activities: [
      "Audit the existing functionality of Melio and Mylkio",
      "Identify incomplete, unreliable or poorly implemented workflows",
      "Resolve high-priority usability and functional issues",
      "Test the applications across devices and screen sizes",
      "Review authentication, permissions, data protection and backups",
      "Prepare demo environments with realistic sample data",
      "Run structured customer discovery with potential users",
      "Record feedback, objections, feature requests and willingness to pay",
      "Define Dukaset's first customer segment and MVP requirements",
    ],
    outcome: "A clear picture of how ready Melio and Mylkio are, demonstrable core workflows, documented customer feedback and a defined Dukaset scope.",
  },
  {
    id: "v2",
    name: "Phase 2: Pilot preparation and first commercial activity",
    fromMonth: 3,
    toMonth: 6,
    focus: "Validate the first two products through real use and prepare Dukaset for development.",
    activities: [
      "Fix the issues found in demonstrations and discovery",
      "Find suitable businesses for structured product trials",
      "Agree pilot scope, responsibilities and feedback arrangements",
      "Test onboarding and customer-support procedures",
      "Set initial pricing hypotheses and implementation requirements",
      "Track customer engagement and willingness to pay",
      "Begin Dukaset MVP development only once requirements are clear",
    ],
    outcome: "Evidence the products solve real problems, documented pilot feedback, better pricing and onboarding assumptions. Paid pilots are an objective, not an assumed outcome.",
  },
  {
    id: "v3",
    name: "Phase 3: Repeatability and selective expansion",
    fromMonth: 6,
    toMonth: 12,
    focus: "Improve the commercial performance of products that show genuine demand.",
    activities: [
      "Refine products using customer feedback and usage evidence",
      "Improve onboarding, support and implementation",
      "Establish repeatable lead generation and sales",
      "Measure acquisition cost, conversion, retention and support effort",
      "Evaluate the next secondary product",
      "Continue Dukaset according to validated requirements",
    ],
    outcome: "Knowing which segments convert, more reliable delivery and support, and a justified decision on expanding the portfolio.",
  },
  {
    id: "v4",
    name: "Phase 4: Scaled commercialisation",
    fromMonth: 12,
    toMonth: 24,
    focus: "Expand only where there is evidence, delivery capacity and money.",
    activities: [
      "Grow activity around products with demonstrated demand",
      "Consider other Kenyan regions or customer segments",
      "Introduce secondary products where readiness and demand justify it",
      "Improve integrations, reporting and automation from customer needs",
      "Review each product's economics and drop or redesign those that do not justify investment",
    ],
    outcome: "A diversified but disciplined portfolio, stronger recurring revenue and a clearer basis for expansion.",
  },
];

export interface VersalyMilestone {
  title: string;
  atMonth: number; // end of the target period, in months from the plan start
  period: string;
  evidence: string;
}

export const VERSALY_MILESTONES: VersalyMilestone[] = [
  { title: "Incorporate VersalyLabs Limited", atMonth: 1, period: "Immediate", evidence: "Certificate of incorporation, share register, founder agreements, IP assignment, company bank account, KRA PIN" },
  { title: "Finalise launch-product scope", atMonth: 3, period: "Months 0 to 3", evidence: "Approved MVP scope, pricing hypothesis, target-customer profiles, product roadmap" },
  { title: "Complete customer discovery", atMonth: 4, period: "Months 0 to 4", evidence: "30 to 50 documented interviews across target segments" },
  { title: "Launch paid pilots", atMonth: 6, period: "Months 3 to 6", evidence: "3 to 5 signed pilot agreements or paid deployments" },
  { title: "Establish the sales process", atMonth: 6, period: "Months 3 to 6", evidence: "Repeatable outreach, demo, proposal, contract, onboarding and support workflow" },
  { title: "First recurring revenue", atMonth: 9, period: "Months 6 to 9", evidence: "First customers paying subscription and/or implementation fees" },
  { title: "Prove retention", atMonth: 12, period: "Months 9 to 12", evidence: "Documented usage, renewal intent, support requests and churn data" },
  { title: "Prepare the next funding round", atMonth: 12, period: "Months 9 to 12", evidence: "Updated financial model, traction evidence, investor materials, funding target" },
];

export const VERSALY_PROJECT_NAME = "VersalyLabs Launch Plan";

/** First-12-month validation targets (plan section 5.6). The plan stresses evidence quality over hitting numbers. */
export const VERSALY_TARGETS = {
  interviews: 30, // the plan says 30 to 45, about 10 to 15 per priority product
  interviewsStretch: 45,
  perProductInterviews: 10,
  contacted: 50, // "50 or more"
  demos: 10,
  pilots: 3, // qualified pilot opportunities
};

export const VERSALY_PRIORITY_PRODUCTS = [
  {
    name: "Melio RMS",
    segment: "Medium-to-large independent restaurants, cafés and restaurant groups",
    priorities: [
      "Complete and test the essential restaurant workflows",
      "Make POS and order management reliable",
      "Verify kitchen workflow and inventory",
      "Improve responsiveness across devices",
      "Validate with restaurant operators through demos and structured feedback",
      "Find the real onboarding, support and implementation effort",
    ],
  },
  {
    name: "Mylkio",
    segment: "Commercially oriented small and medium dairy farms",
    priorities: [
      "Complete the core milk-production recording workflow",
      "Refine cow registration and individual records",
      "Improve health, pregnancy and immunisation tracking",
      "Test on phone-sized screens in realistic farm conditions",
      "Investigate Kenyan livestock identification and traceability initiatives",
      "Interview dairy farmers and cooperatives; learn which features justify paying",
    ],
  },
  {
    name: "Dukaset Business MS",
    segment: "Selected retailers, wholesalers and growing SMEs",
    priorities: [
      "Define the first customer segment and ideal customer profile",
      "Interview retailers, wholesalers and other users",
      "Find the most frequent and costly operational problems",
      "Decide which workflows the first release must include",
      "Fix a tight MVP scope and development roadmap",
      "Avoid duplicating what other VersalyLabs products already do",
    ],
  },
];

export const VERSALY_QUALIFICATION = [
  { factor: "Business suitability", question: "Is it in the intended customer segment?" },
  { factor: "Problem relevance", question: "Does it have the problem the product solves?" },
  { factor: "Problem severity", question: "Is it serious enough to justify a new solution?" },
  { factor: "Current solution", question: "How does it handle the problem today?" },
  { factor: "Decision-making authority", question: "Is this person involved in software buying decisions?" },
  { factor: "Ability to pay", question: "Is there a realistic budget?" },
  { factor: "Adoption readiness", question: "Willing and able to introduce new software?" },
  { factor: "Product fit", question: "Can the current or planned product meet the most important needs?" },
];

export const VERSALY_ONBOARDING = [
  "Confirm requirements, implementation scope and agreed terms; list what is needed from the customer",
  "Initial configuration: business profile, users, permissions, products or records",
  "Data preparation and migration, with responsibilities for accuracy agreed",
  "User setup and access: only the access each role needs",
  "Training for owners, managers and staff, on the workflows they use regularly",
  "Testing and customer verification of the main agreed workflows",
  "Go-live with a clear point of contact for problems",
  "Post-implementation review and follow-up",
];

export const VERSALY_MODEL = {
  streams: [
    "Software subscriptions (monthly or annual)",
    "Implementation and setup fees",
    "Customisation and development",
    "Maintenance and support",
    "Software licensing (one-time or periodic)",
    "Strategic software partnerships (revenue share and commission)",
  ],
  preferred: "An implementation or setup fee plus an ongoing subscription, adjusted per product.",
  tiers: ["Entry-level plan", "Standard plan", "Advanced plan", "Enterprise or custom plan", "Annual subscription (prepaid, possibly discounted)"],
  note: "Prices are not set yet. They come from competitor benchmarking, customer discovery, demos, pricing experiments and a commercial review. Record each quote in the client's value so it can be compared.",
  partners: "Possible partner products to market without presenting them as VersalyLabs' own: Cribs Kenya (rental management) and StoneGrid (construction and surveying estimation).",
};

/** A date a number of months after the plan start, as YYYY-MM-DD. */
export function planDate(monthsAfterStart: number, start: string = VERSALY_PLAN_START): string {
  const [y, m, d] = start.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + monthsAfterStart, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, lastDay));
  return base.toISOString().slice(0, 10);
}

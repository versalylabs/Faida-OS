/**
 * Straten's business plan (Business Plan & Implementation Blueprint, Nov 2026 to Nov 2027), kept as data so the
 * Straten page can show it, track the roadmap against today's date and pre-fill clients from the price list.
 * Prices are the plan's proposed TEST prices, not verified market rates.
 */

export interface CatalogItem {
  name: string;
  group: "Social media kits" | "Business kits" | "Branding & digital" | "Monthly services";
  price: number;
  billing: "ONE_TIME" | "MONTHLY";
  startingFrom?: boolean; // the plan quotes "KSh X+"
  scope: string;
}

export const STRATEN_CATALOG: CatalogItem[] = [
  { name: "Social Media Starter", group: "Social media kits", price: 4500, billing: "ONE_TIME", scope: "10 designed posts, 10 captions, hashtags, brand colours applied, simple posting schedule, 1 revision round" },
  { name: "Social Media Business", group: "Social media kits", price: 8000, billing: "ONE_TIME", scope: "20 designed posts, 20 captions, hashtags, 4 content categories, posting calendar, profile recommendations, 2 revision rounds" },
  { name: "Social Media Premium", group: "Social media kits", price: 12000, billing: "ONE_TIME", scope: "20 posts, 5 story designs, 20 captions, hashtags, content calendar, promotional concepts, 2 revision rounds" },
  { name: "Social Media Business Plus", group: "Social media kits", price: 15000, billing: "ONE_TIME", scope: "20 posts, 4 short-form video edits (client footage), 20 captions, hashtags, content calendar, campaign concepts, 2 revision rounds" },
  { name: "Brand Starter Kit", group: "Business kits", price: 8000, billing: "ONE_TIME", scope: "Logo, colour palette, typography, basic brand guidelines, social profile image, 3 branded templates" },
  { name: "Business Profile Kit", group: "Business kits", price: 6000, billing: "ONE_TIME", scope: "Designed company profile (digital PDF): overview, products and services, contacts" },
  { name: "Menu Design Kit", group: "Business kits", price: 5000, billing: "ONE_TIME", scope: "Designed menu, digital menu, print-ready PDF, optional QR menu, promotional artwork" },
  { name: "Social Media Makeover", group: "Business kits", price: 7500, billing: "ONE_TIME", scope: "Profile and cover redesign, bio optimisation, highlight covers, 3 introductory posts, recommendations" },
  { name: "Product Catalogue Kit", group: "Business kits", price: 6000, billing: "ONE_TIME", scope: "Catalogue design, product descriptions from client info, categories and pricing, digital PDF" },
  { name: "Business Flyer Kit", group: "Business kits", price: 3000, billing: "ONE_TIME", scope: "Business flyer design" },
  { name: "Corporate Stationery Kit", group: "Business kits", price: 5000, billing: "ONE_TIME", scope: "Corporate stationery set" },
  { name: "Logo Design", group: "Branding & digital", price: 5000, billing: "ONE_TIME", scope: "Logo design" },
  { name: "Complete Brand Identity", group: "Branding & digital", price: 20000, billing: "ONE_TIME", startingFrom: true, scope: "Full brand identity system" },
  { name: "Company Profile Design", group: "Branding & digital", price: 10000, billing: "ONE_TIME", scope: "Company profile design" },
  { name: "Landing Page", group: "Branding & digital", price: 12000, billing: "ONE_TIME", startingFrom: true, scope: "Landing page" },
  { name: "Business Website", group: "Branding & digital", price: 25000, billing: "ONE_TIME", startingFrom: true, scope: "Business website (final quote by pages, features, hosting and support)" },
  { name: "Corporate Website", group: "Branding & digital", price: 45000, billing: "ONE_TIME", startingFrom: true, scope: "Corporate website" },
  { name: "E-commerce Website", group: "Branding & digital", price: 60000, billing: "ONE_TIME", startingFrom: true, scope: "E-commerce website" },
  { name: "Website Maintenance", group: "Monthly services", price: 3000, billing: "MONTHLY", scope: "Monthly website maintenance" },
  { name: "Creative Partner Lite", group: "Monthly services", price: 8000, billing: "MONTHLY", scope: "12 designs, 12 captions, monthly content calendar, 1 revision round" },
  { name: "Creative Partner Growth", group: "Monthly services", price: 15000, billing: "MONTHLY", scope: "16 designs, 2 short video edits, captions and hashtags, calendar, 2 campaign concepts, 2 revision rounds" },
  { name: "Creative Partner Pro", group: "Monthly services", price: 25000, billing: "MONTHLY", scope: "20 designs, 4 video edits, captions, monthly strategy, scheduling, basic monthly report" },
  { name: "Social media management", group: "Monthly services", price: 20000, billing: "MONTHLY", startingFrom: true, scope: "Account admin, publishing, community engagement, campaign coordination, basic reporting" },
  { name: "Digital marketing management", group: "Monthly services", price: 25000, billing: "MONTHLY", startingFrom: true, scope: "Channel management and reporting (ad spend paid by the client)" },
];

export interface Phase {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  tasks: string[];
  completion: string;
}

export const STRATEN_PHASES: Phase[] = [
  {
    id: "p1",
    name: "Phase 1: Business foundation",
    start: "2026-11-17",
    end: "2026-11-30",
    tasks: [
      "Finalise positioning and messaging",
      "Finalise the five business divisions",
      "Approve the initial service catalogue",
      "Confirm prices and production costs",
      "Confirm priority customer segments",
      "Create quotation and service agreement templates",
      "Establish sales and delivery workflows",
      "Review financial and compliance requirements",
    ],
    completion: "Straten can clearly explain what it sells, who it serves, what it charges and how it delivers.",
  },
  {
    id: "p2",
    name: "Phase 2: Product development",
    start: "2026-12-01",
    end: "2026-12-16",
    tasks: [
      "Produce samples for all four social media kits",
      "Produce Brand Starter Kit sample",
      "Produce Menu Design Kit sample",
      "Produce Social Media Makeover sample",
      "Create three industry-specific sample collections",
      "Create Business Presence Audit template",
      "Create client briefing forms",
      "Create delivery and revision checklists",
      "Produce the product catalogue PDF",
    ],
    completion: "Every launch product has a finished example, defined deliverables and a price.",
  },
  {
    id: "p3",
    name: "Phase 3: Sales infrastructure",
    start: "2026-12-17",
    end: "2026-12-31",
    tasks: [
      "Update the Straten website",
      "Create product and service pages",
      "Organise the portfolio",
      "Set up WhatsApp Business",
      "Establish lead capture",
      "Set up the sales pipeline",
      "Prepare outreach scripts",
      "Prepare proposal templates",
      "Build the initial prospect database",
    ],
    completion: "A prospect can discover Straten, understand an offer, request a quotation and make a purchase.",
  },
  {
    id: "p4",
    name: "Phase 4: Commercial launch",
    start: "2027-01-01",
    end: "2027-01-30",
    tasks: [
      "Launch the new Straten positioning",
      "Contact qualified businesses",
      "Deliver preliminary audits",
      "Conduct consultations",
      "Close initial orders",
      "Deliver work professionally",
      "Collect customer feedback",
      "Publish approved portfolio examples",
      "Test referral partnerships",
    ],
    completion: "Five or more paying customers and evidence of which products generate the strongest interest.",
  },
  {
    id: "p5",
    name: "Phase 5: Evaluation and optimisation",
    start: "2027-01-31",
    end: "2027-02-14",
    tasks: [
      "Analyse sales performance",
      "Calculate actual package profitability",
      "Identify the best-performing customer segment",
      "Improve weak products and pricing",
      "Introduce monthly Creative Partner offers",
      "Establish customer retention procedures",
      "Prepare the next six-month plan",
    ],
    completion: "A validated core offer, a functioning sales process and a repeatable delivery system.",
  },
];

export const STRATEN_PROJECT_NAME = "Straten Launch Plan 2026-27";

export const STRATEN_PROFILE = {
  tagline: "Growing Businesses. Digitally.",
  headline: "Everything Your Business Needs to Grow.",
  salesMessage: "We help businesses look better, reach further and work smarter.",
  positioning: "Business Growth & Digital Solutions Company",
  corePromise: "One partner for a business's branding, marketing, digital presence and technology needs.",
  firstMilestone: "Win the first five paying Kenyan businesses, deliver excellent work, measure the true cost of delivery and prove which offers customers are willing to buy.",
  firstMilestoneTarget: 5,
  note: "Real estate digital marketing subscriptions stay the normal model. They are re-adapted after this plan is solid.",
};

export const STRATEN_DIVISIONS = [
  { name: "Branding & Creative Solutions", text: "Brand identity, social media kits, menus, catalogues, business profiles." },
  { name: "Marketing & Customer Growth", text: "Social media management, campaigns, email marketing, lead generation." },
  { name: "Digital Presence & Commerce", text: "Websites, landing pages, e-commerce, online catalogues." },
  { name: "Business Technology & Automation", text: "POS, CRM, inventory, workflow automation and custom software through a documented technology partner." },
  { name: "Business Growth Solutions", text: "Industry packages that combine the other divisions. Introduced only after the parts are validated." },
];

export const STRATEN_SEGMENTS = [
  { rank: 1, name: "Restaurants & hospitality", text: "Menus, promotions, social content, digital and QR menus, websites, POS and inventory later." },
  { rank: 2, name: "Beauty & lifestyle", text: "Branding, promotions, social content, catalogues, booking websites." },
  { rank: 3, name: "Real estate", text: "Brand identity, property marketing, websites and landing pages, lead generation. The Lead Intelligence project can support prospecting." },
  { rank: 4, name: "Retail & professional services", text: "Company profiles, catalogues, websites, email marketing, systems later." },
];

export const STRATEN_RULES = {
  payment: [
    "Customised projects: 60% deposit before work begins, 40% before final delivery.",
    "Low-cost fixed-scope kits: full payment upfront.",
    "Subscriptions: monthly, in advance.",
    "No project enters production without an approved scope and confirmed payment.",
  ],
  exclusions: [
    "Social media kits do not include publishing or account management.",
    "Video edits use client-supplied footage.",
    "Advertising spend is not included.",
    "Photography and videography are not included.",
    "Printing and delivery are not included.",
    "Website hosting, domains and third-party subscriptions are separate.",
    "Software support and maintenance need a separate agreement.",
    "Extra revisions and out-of-scope work are quoted separately.",
  ],
  workflow: [
    "Lead identified",
    "Prospect researched and qualified",
    "Consultation or audit completed",
    "Package recommended",
    "Proposal and quotation issued",
    "Scope and terms approved",
    "Deposit or full payment received",
    "Client briefing and materials collected",
    "Production begins",
    "Internal quality review",
    "Client review",
    "Agreed revisions completed",
    "Final payment received",
    "Final files or system handed over",
    "Follow-up and retention started",
  ],
  qualification: [
    { factor: "Clear business need", points: 25 },
    { factor: "Ability to pay", points: 20 },
    { factor: "Decision-maker accessibility", points: 15 },
    { factor: "Business activity and legitimacy", points: 15 },
    { factor: "Potential for repeat purchases", points: 15 },
    { factor: "Buying readiness", points: 10 },
  ],
  qualificationBands: "80 to 100: high priority. 60 to 79: qualified. 40 to 59: nurture. Below 40: low priority.",
  outreach: [
    "Personalise each approach and refer to a genuine, observable opportunity.",
    "Keep first messages short; offer a useful next step such as a short consultation or audit.",
    "Never send repeated unwanted messages; respect opt-outs immediately.",
    "Do not promise sales, leads or revenue you cannot control.",
  ],
};

/** Monthly management targets from the plan (targets, not forecasts). */
export const STRATEN_TARGETS = {
  outreachPerMonth: 100,
  consultationsPerMonth: 10,
  payingCustomers: 5,
  recurringCustomers: 2,
  launchRevenue: 40000,
  revenueMilestones: [
    { label: "Launch", amount: 40000 },
    { label: "Month 3", amount: 80000 },
    { label: "Month 6", amount: 150000 },
    { label: "Month 9", amount: 250000 },
    { label: "Month 12", amount: 350000 },
  ],
};

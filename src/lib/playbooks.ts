/**
 * Straten's business plan (Business Plan & Implementation Blueprint, version 2.0, revised 17 November 2026, covering
 * November 2026 to November 2027), kept as data so the Straten page can show it, track the roadmap against today's date
 * and pre-fill clients from the price list. Prices are the plan's proposed TEST prices, not verified market rates.
 */

export const STRATEN_PLAN_VERSION = 2;
/** Written into the tracking project's description once it follows this version of the plan. */
export const STRATEN_PLAN_MARKER = "Plan version 2";

export interface CatalogItem {
  name: string;
  group: "Social media kits" | "Business kits" | "Branding & digital" | "Monthly services";
  price: number;
  billing: "ONE_TIME" | "MONTHLY";
  startingFrom?: boolean; // the plan quotes "KSh X+"
  scope: string;
}

export const STRATEN_CATALOG: CatalogItem[] = [
  { name: "Social Media Starter", group: "Social media kits", price: 6000, billing: "ONE_TIME", scope: "10 designed posts, 10 captions, hashtags, brand colours and typography, simple posting schedule, 1 revision round" },
  { name: "Social Media Business", group: "Social media kits", price: 11000, billing: "ONE_TIME", scope: "20 designed posts, 20 captions, hashtags, 4 content categories, posting calendar, basic profile recommendations, 2 revision rounds" },
  { name: "Social Media Business Plus", group: "Social media kits", price: 18000, billing: "ONE_TIME", scope: "20 posts, 5 story designs, 3 short video edits (client footage, up to 30 seconds each), 20 captions, hashtags, content calendar, campaign concepts, 2 revision rounds" },
  { name: "Festive Season Promo Pack", group: "Business kits", price: 7000, billing: "ONE_TIME", scope: "Festive menu or menu insert, 6 promotional posts and WhatsApp status graphics for restaurants, cafés and bakeries. Delivered by 12 December, so the offer closes early" },
  { name: "Brand Starter Kit", group: "Business kits", price: 8000, billing: "ONE_TIME", scope: "Logo, colour palette, typography, basic brand guidelines, social profile image, 3 branded templates" },
  { name: "Business Profile Kit", group: "Business kits", price: 6000, billing: "ONE_TIME", scope: "Designed company profile (digital PDF): overview, products and services, contacts" },
  { name: "Menu Design Kit", group: "Business kits", price: 5000, billing: "ONE_TIME", scope: "Designed menu (up to 2 pages or 40 items, KSh 1,500 per extra page), digital menu, print-ready PDF, optional QR menu, promotional artwork" },
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
  { name: "Creative Partner Lite", group: "Monthly services", price: 8000, billing: "MONTHLY", scope: "16 designs, 16 captions, monthly content calendar, 1 revision round. 3-month minimum, paid monthly in advance" },
  { name: "Creative Partner Growth", group: "Monthly services", price: 15000, billing: "MONTHLY", scope: "20 designs, 3 short video edits, captions and hashtags, content calendar, 2 campaign concepts, 2 revision rounds. 3-month minimum" },
  { name: "Creative Partner Pro", group: "Monthly services", price: 25000, billing: "MONTHLY", scope: "24 designs, 4 video edits, captions and hashtags, monthly strategy, scheduling, basic performance report. 3-month minimum" },
  { name: "Social media management", group: "Monthly services", price: 20000, billing: "MONTHLY", startingFrom: true, scope: "Account admin, publishing, community engagement, campaign coordination, basic reporting" },
  { name: "Digital marketing management", group: "Monthly services", price: 25000, billing: "MONTHLY", startingFrom: true, scope: "Channel management and reporting (ad spend paid by the client)" },
];

export interface PlanTask {
  title: string;
  /** Own due date (YYYY-MM-DD); the phase's end date when missing. */
  due?: string;
  /** New in version 2: the only tasks added to a project that was made from version 1. */
  added?: boolean;
  /** The wording this task had in version 1, so a project made from version 1 can be renamed. */
  renamedFrom?: string;
}

export interface Phase {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string;
  tasks: PlanTask[];
  completion: string;
  /** Run alongside the numbered phases instead of one after another. */
  parallel?: boolean;
}

const t = (title: string, extra: Partial<PlanTask> = {}): PlanTask => ({ title, ...extra });
const added = (title: string, due?: string): PlanTask => ({ title, due, added: true });

export const STRATEN_PHASES: Phase[] = [
  {
    id: "rs",
    name: "Revenue sprint: sell from day 1",
    start: "2026-11-17",
    end: "2026-12-31",
    parallel: true,
    tasks: [
      added("List and personally message 30 warm contacts with a specific offer", "2026-11-23"),
      added("Offer the Festive Season Promo Pack to restaurants, cafés and bakeries", "2026-12-01"),
      added("Deliver the Festive Season Promo Packs", "2026-12-12"),
      added("Pitch real estate prospects with one redesigned listing or brochure page as the hook", "2026-12-28"),
      added("Reach three paying customers", "2026-12-31"),
    ],
    completion: "Three paying customers by 31 December 2026, from existing clients, referrals and warm contacts.",
  },
  {
    id: "p1",
    name: "Phase 1: Business foundation",
    start: "2026-11-17",
    end: "2026-11-30",
    tasks: [
      t("Finalise positioning and messaging"),
      t("Finalise the five business divisions"),
      t("Approve the initial service catalogue"),
      t("Confirm prices and production costs"),
      t("Confirm priority customer segments"),
      t("Create quotation and service agreement templates"),
      t("Establish sales and delivery workflows"),
      t("Review financial and compliance requirements"),
      added("Register for eTIMS and open an M-Pesa Till or Paybill in the business name", "2026-11-23"),
      added("Accountant review: turnover tax or income tax, VAT, withholding tax"),
      added("Get a written ODPC position for Straten and VersalyLabs"),
      added("Sign the Straten and VersalyLabs inter-company agreement"),
      added("Block exam periods in the calendar and accept no project due inside them"),
    ],
    completion: "Straten can clearly explain what it sells, who it serves, what it charges and how it delivers.",
  },
  {
    id: "p2",
    name: "Phase 2: Product development",
    start: "2026-12-01",
    end: "2026-12-16",
    tasks: [
      t("Produce samples for all three social media kits", { renamedFrom: "Produce samples for all four social media kits" }),
      t("Produce Brand Starter Kit sample"),
      t("Produce Menu Design Kit sample"),
      t("Produce Social Media Makeover sample"),
      t("Create three industry-specific sample collections"),
      t("Create Business Presence Audit template"),
      t("Create client briefing forms"),
      t("Create delivery and revision checklists"),
      t("Produce the product catalogue PDF"),
    ],
    completion: "Every launch product has a finished example, defined deliverables and a price.",
  },
  {
    id: "p3",
    name: "Phase 3: Sales infrastructure",
    start: "2026-12-17",
    end: "2026-12-31",
    tasks: [
      t("Update the Straten website"),
      t("Create product and service pages"),
      t("Organise the portfolio"),
      t("Set up WhatsApp Business"),
      t("Establish lead capture"),
      t("Set up the sales pipeline"),
      t("Prepare outreach scripts"),
      t("Prepare proposal templates"),
      t("Build the initial prospect database"),
      added("Set up the do-not-contact list and the opt-out process"),
      added("Line up a freelance designer on a per-post rate"),
      added("Confirm Melio is live for at least one pilot restaurant before selling it with Straten"),
    ],
    completion: "A prospect can discover Straten, understand an offer, request a quotation and make a purchase.",
  },
  {
    id: "p4",
    name: "Phase 4: Commercial launch",
    start: "2027-01-01",
    end: "2027-01-30",
    tasks: [
      t("Launch the new Straten positioning"),
      t("Contact qualified businesses"),
      t("Deliver preliminary audits"),
      t("Conduct consultations"),
      t("Close initial orders"),
      t("Deliver work professionally"),
      t("Collect customer feedback"),
      t("Publish approved portfolio examples"),
      t("Test referral partnerships"),
      added("Reach five paying customers", "2027-01-31"),
      added("Time every project and record contribution per founder hour"),
    ],
    completion: "Five or more paying customers and evidence of which products generate the strongest interest.",
  },
  {
    id: "p5",
    name: "Phase 5: Evaluation and optimisation",
    start: "2027-01-31",
    end: "2027-02-14",
    tasks: [
      t("Analyse sales performance"),
      t("Calculate actual package profitability"),
      t("Identify the best-performing customer segment"),
      t("Improve weak products and pricing"),
      t("Introduce monthly Creative Partner offers"),
      t("Establish customer retention procedures"),
      t("Prepare the next six-month plan"),
      added("Review the two-segment launch focus and decide whether to open outreach to beauty, retail and professional services"),
    ],
    completion: "A validated core offer, a functioning sales process and a repeatable delivery system.",
  },
];

export const STRATEN_PROJECT_NAME = "Straten Launch Plan 2026-27";
export const STRATEN_PROJECT_DESCRIPTION = `Straten business plan roadmap, November 2026 to February 2027: a revenue sprint from day 1, then foundation, products, sales set-up, launch and evaluation. ${STRATEN_PLAN_MARKER} (revised 17 November 2026).`;

export const STRATEN_PROFILE = {
  tagline: "Growing Businesses. Digitally.",
  headline: "Everything Your Business Needs to Grow.",
  salesMessage: "We help businesses look better, reach further and work smarter.",
  positioning: "Business Growth & Digital Solutions Company",
  corePromise: "One partner for a business's branding, marketing, digital presence and technology needs.",
  firstMilestone: "Win the first five paying Kenyan businesses, deliver excellent work, measure the true cost of delivery and prove which offers customers are willing to buy.",
  firstMilestoneTarget: 5,
  firstMilestoneEarly: { target: 3, by: "31 December 2026", label: "Paying customers by 31 December" },
  firstMilestoneBy: "31 January 2027",
  note: "For the first 90 days, proactive outreach covers two segments only: restaurants and hospitality, and real estate.",
};

export const STRATEN_DIVISIONS = [
  { name: "Branding & Creative Solutions", text: "Brand identity, social media kits, menus, catalogues, business profiles." },
  { name: "Marketing & Customer Growth", text: "Social media management, campaigns, email marketing, lead generation." },
  { name: "Digital Presence & Commerce", text: "Websites, landing pages, e-commerce, online catalogues." },
  { name: "Business Technology & Automation", text: "POS, CRM, inventory, workflow automation and custom software, delivered through VersalyLabs." },
  { name: "Business Growth Solutions", text: "Industry packages that combine the other divisions. Introduced only after the parts are validated." },
];

export const STRATEN_SEGMENTS = [
  {
    rank: 1,
    launch: true,
    name: "Restaurants & hospitality",
    text: "Menus, promotions, social content, digital and QR menus, websites. A direct route to Melio, VersalyLabs' restaurant system. Start with the Festive Season Promo Pack.",
  },
  {
    rank: 2,
    launch: true,
    name: "Real estate",
    text: "Straten's existing specialism: brand identity, property marketing, websites and landing pages, lead generation. Prior client work and a researched list of 100+ agencies are already in hand.",
  },
  { rank: 3, launch: false, name: "Beauty & lifestyle", text: "Inbound and referral only: no dedicated outreach, sample collections or packages until a launch segment is producing consistent sales." },
  { rank: 4, launch: false, name: "Retail & professional services", text: "Inbound and referral only, on the same terms. The plan reviews this at the end of Phase 5." },
];

export const STRATEN_RULES = {
  payment: [
    "Customised projects: 60% deposit before work begins, 40% before final delivery.",
    "Low-cost fixed-scope kits: full payment upfront.",
    "Subscriptions: monthly, in advance. Creative Partner plans have a three-month minimum.",
    "No project enters production without an approved scope and confirmed payment.",
    "Collect through an M-Pesa Till or Paybill and a bank account in the business name, issue an eTIMS invoice for every sale and send receipts the same day.",
    "Some corporate clients withhold tax on professional fees. Confirm with the accountant, and if it applies plan cash flow around receiving 95%.",
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
    "Personalise each approach and refer to one specific, observable point about the business. End with a yes or no question and leave links out of the first message.",
    "Contact businesses through their published business channels, never personal numbers.",
    "Keep a do-not-contact list and check it before every outreach batch. Respect opt-outs immediately and never send repeated unwanted messages.",
    "For prospects scoring 60 or more, one free sample may be used as a hook: one asset per prospect, never more.",
    "Do not promise sales, leads or revenue you cannot control.",
  ],
};

/** Founder time is the limit in year one (plan section 11.2). */
export const STRATEN_CAPACITY = {
  hours: [
    { activity: "Sales: research, outreach, follow-up, consultations", hours: "8 to 10" },
    { activity: "Production and quality control", hours: "8 to 10" },
    { activity: "Admin, invoicing, reporting", hours: "2" },
  ],
  total: "18 to 22 hours a week (semester)",
  rules: [
    "Roughly two kits plus one or two retainers a month if you do all the design yourself.",
    "Bring in a freelance designer on a per-post rate before a fifth concurrent project or a third retainer.",
    "Start no new VersalyLabs product builds during the 90-day window. VersalyLabs time goes into making Melio ready for paying restaurants.",
    "Block exam periods now and accept no project whose deadline falls inside them.",
  ],
};

export const STRATEN_ECONOMICS = {
  floorPerHour: 500,
  fixedCostsPerMonth: 15000,
  lines: [
    "Contribution = selling price minus direct project costs. It is not profit: overheads, tax and your own pay still come out of it.",
    "A Social Media Business Kit at KSh 11,000 leaves about KSh 10,550 if you design it all (about 16 hours, roughly KSh 660 an hour) or about KSh 5,550 with a freelance designer (about 6 of your hours, roughly KSh 925 an hour). These figures are assumptions: replace them with timed records from your first five projects.",
    "Track contribution per founder hour on every project. Below KSh 500 an hour means a higher price, a smaller scope or better templates.",
    "Illustrative fixed costs are about KSh 15,000 a month. At roughly KSh 7,000 contribution per sale that is two to three sales a month just to cover costs, and about seven if the business is also to pay a KSh 30,000 founder draw.",
    "A Creative Partner month must always cost less per asset than the equivalent one-off kit.",
  ],
  firstNinetyDays: { total: 112000, note: "Illustration for 17 November 2026 to 14 February 2027: 6 Business Kits, 2 Starter Kits, 2 Menu Design Kits, 1 Brand Starter Kit and 2 first-month Lite retainers." },
};

/** Revenue milestones from the plan (illustrative planning milestones, not forecasts). */
export const STRATEN_REVENUE_MILESTONES = [
  { label: "Month 1 (Dec 2026)", amount: 30000, needs: "Three warm-network or festive sales" },
  { label: "Month 3 (Feb 2027)", amount: 50000, needs: "Weekly outreach running; first retainer" },
  { label: "Month 6 (May 2027)", amount: 135000, needs: "Regular freelance designer; four retainers; first website" },
  { label: "Month 9 (Aug 2027)", amount: 220000, needs: "Six or seven retainers; first Melio referrals" },
  { label: "Month 12 (Nov 2027)", amount: 300000, needs: "Eight to ten retainers; a second regular freelancer or a part-time hire" },
];

/** Tax and data-protection points the plan checked in November 2026. Not legal or tax advice. */
export const STRATEN_COMPLIANCE = [
  "eTIMS: every business must issue eTIMS invoices, and from 1 January 2026 KRA checks expenses claimed in returns against eTIMS records. Register before the first sale and ask freelancers and suppliers for eTIMS invoices.",
  "Turnover tax is 3% of gross sales between KSh 1 million and KSh 25 million with no deductions. KRA says it does not apply to professional fees, so confirm with an accountant whether creative and marketing services fall in that exclusion.",
  "VAT registration is compulsory above KSh 5 million in annual taxable turnover. Watch turnover monthly once it passes about KSh 3 million.",
  "Data protection: direct marketing, hospitality and property management are among the sectors that must register with the ODPC whatever their size. Get a written position before selling lead generation, email marketing or Melio.",
  "Marketing to people needs them to be informed, with a simple free opt-out. That applies to Straten's own prospecting too.",
  "Client files and intellectual property pass to the client on full payment. Straten keeps the right to show the work in its portfolio unless the client opts out in writing.",
  "Keep both companies registered, with up-to-date statutory records. A private limited company is needed before raising investment.",
];

/** How Straten works with VersalyLabs (plan section 12). Both companies have the same owner. */
export const STRATEN_VERSALY_LINK = {
  summary: "VersalyLabs is Straten's technology delivery partner. Both companies have the same owner, so this is a related-party arrangement and should be documented and disclosed to customers and investors.",
  rules: [
    "Separate registration, bank and M-Pesa accounts, and books for each company.",
    "A written inter-company agreement covering referral fees, joint-project splits, customer ownership and support duties.",
    "Fees between the two set at the rates an outside partner would pay.",
    "Common ownership disclosed in every investor document and joint proposal.",
  ],
  referral: "Terms to test: Straten receives 20% of the setup fee and 10% of subscription fees for the first 12 months on Melio clients it refers. VersalyLabs receives 10% of the first project value on clients it refers to Straten. Fees are paid only after the referred client's payment clears.",
  bridge: [
    "Straten sells a Menu Design Kit or festive promotion pack as a low-risk first purchase.",
    "The QR or digital menu can be hosted on Melio as an optional add-on.",
    "Promotional posts link to the Melio ordering page, so campaigns produce countable orders.",
    "Restaurants that see orders upgrade to Melio ordering or POS, and Straten earns a referral fee.",
    "Before this is sold, Melio must be running for at least one real restaurant (a pilot is fine) and support duties must be written down.",
  ],
};

/** The milestone in a project that stands for a phase (matched by its number, so a renamed phase still matches). */
export function phaseMilestone<M extends { title: string }>(phase: Phase, milestones: M[]): M | undefined {
  const n = /^p(\d)$/.exec(phase.id)?.[1];
  return milestones.find((m) => (n ? new RegExp(`^phase\\s*${n}\\b`, "i").test(m.title.trim()) : /revenue sprint/i.test(m.title)));
}

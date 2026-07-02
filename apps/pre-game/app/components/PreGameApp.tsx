"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";

// ── Types ─────────────────────────────────────────────────────────────────────

type Screen = "list" | "detected" | "projection" | "countdown" | "classify" | "history" | "settings";
type Theme = "ember" | "forest";
type SrcKind = "work" | "invest";
type PayType = "W2" | "1099" | "GIG";
type W2PayMode = "hourly" | "salary";
type PayPeriod = "weekly" | "biweekly" | "monthly";
type PassiveFrequency = "weekly" | "biweekly" | "monthly" | "annual";
type Instrument = "CD" | "Dividend" | "Interest" | "Recurring";
type ActivityCategory = "selling" | "delivery" | "application" | "skill_asset" | "admin" | "uncategorized";
type MomentumClass = "direct_money" | "advanced_opportunity" | "built_skill_or_asset" | "important_not_income_linked" | "not_sure";
type IntegrationSource = "gmail" | "google_calendar" | "indeed";
type DetectedActivityStatus = "pending" | "logged" | "ignored" | "linked";
type DetectedActivityType =
  | "job_application"
  | "recruiter_reply"
  | "interview_request"
  | "client_lead"
  | "invoice"
  | "payment_notice"
  | "follow_up"
  | "unanswered_opportunity"
  | "calendar_interview"
  | "calendar_client_call"
  | "calendar_networking"
  | "work_block"
  | "deadline"
  | "weekly_review"
  | "application_status_change"
  | "saved_job";

interface SuggestedClassification {
  category: ActivityCategory;
  momentum: MomentumClass;
  creates?: "activity" | "opportunity" | "income_event" | "follow_up";
}

interface DetectedActivity {
  id: string;
  source: IntegrationSource;
  sourceId: string;
  detectedAt: number;
  eventDate?: string;
  title: string;
  summary: string;
  suggestedType: DetectedActivityType;
  suggestedClassification: SuggestedClassification;
  confidence: number;
  status: DetectedActivityStatus;
  linkedActivityId?: string;
  linkedOpportunityId?: string;
  linkedIncomeEventId?: string;
  linkedFollowUpId?: string;
  rawMetadata: {
    fromDomain?: string;
    senderLabel?: string;
    subjectHash?: string;
    calendarId?: string;
    calendarEventLink?: string;
    provider?: string;
    threadId?: string;
    messageId?: string;
    eventId?: string;
  };
}

interface Opportunity {
  id: string;
  title: string;
  companyOrClient?: string;
  source?: IntegrationSource | "manual";
  stage: "lead" | "applied" | "replied" | "interview" | "offer" | "won" | "lost";
  createdAt: number;
  updatedAt: number;
  detectedActivityIds: string[];
}

interface IncomeEvent {
  id: string;
  title: string;
  amount?: number;
  eventDate: string;
  source?: IntegrationSource | "manual";
  detectedActivityId?: string;
  opportunityId?: string;
  notes?: string;
}

interface FollowUp {
  id: string;
  title: string;
  dueDate?: string;
  source?: IntegrationSource | "manual";
  detectedActivityId?: string;
  status: "open" | "done" | "dismissed";
  createdAt: number;
}

interface IntegrationConnection {
  id: IntegrationSource;
  label: string;
  status: "mock" | "connected" | "error" | "disconnected";
  connectedAt?: number;
  lastSyncAt?: number;
  scopes: string[];
  readOnly: boolean;
  canDisconnect: boolean;
  privacySummary: string;
  errorMessage?: string;
}

interface StoredSource {
  id: string;
  name: string;
  kind: SrcKind;
  payType?: PayType;
  pay?: number;
  hours?: number;
  w2PayMode?: W2PayMode;
  hourlyRate?: number;
  salaryAmount?: number;
  salaryPeriod?: PayPeriod;
  instrument?: Instrument;
  principal?: number;
  rate?: number;
  recurringAmount?: number;
  recurringFrequency?: PassiveFrequency;
}

interface NormSource extends StoredSource {
  synced: boolean;
}

type ActionType = "daily" | "goal" | "upcoming";

interface Task {
  id: string;
  text: string;
  done: boolean;
  completedAt?: string;
  category?: ActivityCategory;
  type: ActionType;
  completedDates?: string[];
  scheduledAt?: string;
}

interface Activity {
  id: string;
  taskId: string;
  title: string;
  dateCompleted: string;
  timestamp: number;
  category?: ActivityCategory;
  momentum: MomentumClass;
}

interface TrackedPlatform {
  id: string;
  name: string;
  addedAt: number;
}

interface PlaidAccountSummary {
  id: string;
  name: string;
  officialName?: string;
  mask?: string;
  type: string;
  subtype?: string;
  current: number | null;
  available: number | null;
  currency: string;
  rate?: number;
  rateUpdatedAt?: number;
}

interface PlaidBankItem {
  itemId: string;
  institutionName: string;
  connectedAt: number;
  accounts: PlaidAccountSummary[];
  weeklyIncome: number;
}

type PlaidHandler = { open: () => void; destroy: () => void };
type PlaidCreateConfig = {
  token: string;
  onSuccess: (publicToken: string, metadata: { institution?: { name?: string } }) => void;
  onExit: (error: { error_message?: string } | null) => void;
};

declare global {
  interface Window { Plaid?: { create: (config: PlaidCreateConfig) => PlaidHandler } }
}

// ── Catalog ───────────────────────────────────────────────────────────────────

const HORIZONS = [1, 5, 10, 20];
const BADGE_MAP: Record<string, string> = { CD: "CD", Dividend: "DIV", Interest: "INT" };
const INVESTMENT_ACCOUNT_TYPES = new Set(["investment"]);
const INVESTMENT_ACCOUNT_SUBTYPES = new Set([
  "cd", "certificate of deposit", "share certificate",
  "money market", "savings",
  "ira", "401k", "403b", "457b", "529", "brokerage", "mutual fund", "stock plan",
  "hsa", "keogh", "pension", "profit sharing plan", "retirement", "roth", "roth 401k",
  "sep ira", "simple ira", "ugma", "utma", "variable annuity", "non-taxable brokerage account",
]);
function isInvestmentPlaidAccount(account: { type: string; subtype?: string }): boolean {
  const type = (account.type || "").toLowerCase();
  const subtype = (account.subtype || "").toLowerCase();
  return INVESTMENT_ACCOUNT_TYPES.has(type) || INVESTMENT_ACCOUNT_SUBTYPES.has(subtype);
}
function plaidInstrumentForSubtype(subtype: string | undefined): Instrument {
  const s = (subtype || "").toLowerCase();
  if (s === "cd" || s === "certificate of deposit" || s === "share certificate") return "CD";
  if (s === "savings" || s === "money market") return "Interest";
  return "Dividend";
}
const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: "selling", label: "Selling" },
  { id: "delivery", label: "Delivery" },
  { id: "application", label: "Application" },
  { id: "skill_asset", label: "Skill / asset" },
  { id: "admin", label: "Admin" },
];
const MOMENTUM_CLASSES: { id: MomentumClass; label: string; short: string; helpsIncome: boolean }[] = [
  { id: "direct_money", label: "Direct money", short: "Money", helpsIncome: true },
  { id: "advanced_opportunity", label: "Advanced opportunity", short: "Opportunity", helpsIncome: true },
  { id: "built_skill_or_asset", label: "Built skill or asset", short: "Skill / asset", helpsIncome: true },
  { id: "important_not_income_linked", label: "Important, not income-linked", short: "Important", helpsIncome: false },
  { id: "not_sure", label: "Not sure", short: "Not sure", helpsIncome: false },
];
const PAY_PERIODS: { id: PayPeriod; label: string; suffix: string; annualMultiplier: number }[] = [
  { id: "weekly", label: "WEEKLY", suffix: "wk", annualMultiplier: 52 },
  { id: "biweekly", label: "BIWEEKLY", suffix: "biweekly", annualMultiplier: 26 },
  { id: "monthly", label: "MONTHLY", suffix: "mo", annualMultiplier: 12 },
];
const PASSIVE_FREQUENCIES: { id: PassiveFrequency; label: string; suffix: string; annualMultiplier: number }[] = [
  { id: "weekly", label: "WEEKLY", suffix: "wk", annualMultiplier: 52 },
  { id: "biweekly", label: "BIWEEKLY", suffix: "biweekly", annualMultiplier: 26 },
  { id: "monthly", label: "MONTHLY", suffix: "mo", annualMultiplier: 12 },
  { id: "annual", label: "ANNUAL", suffix: "yr", annualMultiplier: 1 },
];

const SOURCE_LABELS: Record<IntegrationSource, string> = {
  gmail: "Gmail",
  google_calendar: "Google Calendar",
  indeed: "Indeed via Gmail",
};

const TYPE_LABELS: Record<DetectedActivityType, string> = {
  job_application: "Job application",
  recruiter_reply: "Recruiter reply",
  interview_request: "Interview request",
  client_lead: "Client lead",
  invoice: "Invoice",
  payment_notice: "Payment notice",
  follow_up: "Follow-up reminder",
  unanswered_opportunity: "Unanswered opportunity",
  calendar_interview: "Calendar interview",
  calendar_client_call: "Client call",
  calendar_networking: "Networking",
  work_block: "Work block",
  deadline: "Deadline",
  weekly_review: "Weekly review",
  application_status_change: "Application status",
  saved_job: "Saved job",
};

const DEFAULT_INTEGRATION_CONNECTIONS: IntegrationConnection[] = [
  {
    id: "gmail",
    label: "Gmail",
    status: "mock",
    scopes: ["gmail.readonly later"],
    readOnly: true,
    canDisconnect: true,
    privacySummary: "Mock inbox now. Later: read-only income-related email metadata/snippets; no sending and no full body storage by default.",
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    status: "mock",
    scopes: ["calendar.readonly later"],
    readOnly: true,
    canDisconnect: true,
    privacySummary: "Mock calendar signals now. Later: read-only event metadata for interviews, client calls, follow-ups, and work blocks.",
  },
  {
    id: "indeed",
    label: "Indeed",
    status: "mock",
    scopes: ["gmail-derived notifications later"],
    readOnly: true,
    canDisconnect: true,
    privacySummary: "Direct Indeed access is not enabled. MVP signals come from Indeed notification emails through Gmail once Gmail exists.",
  },
];

const MOCK_DETECTED_ACTIVITY_BLUEPRINTS: Omit<DetectedActivity, "detectedAt" | "eventDate">[] = [
  {
    id: "mock-gmail-recruiter-reply",
    source: "gmail",
    sourceId: "gmail:mock:recruiter-reply",
    title: "Gmail recruiter reply",
    summary: "A recruiter at a hiring domain replied asking for availability. No full email body is stored; this is a mock metadata/snippet suggestion.",
    suggestedType: "recruiter_reply",
    suggestedClassification: { category: "application", momentum: "advanced_opportunity", creates: "activity" },
    confidence: 0.9,
    status: "pending",
    rawMetadata: { fromDomain: "hiring.example", senderLabel: "Recruiter", provider: "mock", threadId: "mock-thread-recruiter" },
  },
  {
    id: "mock-calendar-interview",
    source: "google_calendar",
    sourceId: "calendar:mock:interview",
    title: "Google Calendar interview",
    summary: "Calendar event title suggests an interview screen with an external attendee. Event metadata only; no calendar edits are made.",
    suggestedType: "interview_request",
    suggestedClassification: { category: "application", momentum: "advanced_opportunity", creates: "activity" },
    confidence: 0.88,
    status: "pending",
    rawMetadata: { provider: "mock", eventId: "mock-event-interview" },
  },
  {
    id: "mock-indeed-application",
    source: "indeed",
    sourceId: "gmail:mock:indeed-application",
    title: "Indeed application confirmation",
    summary: "An Indeed notification email appears to confirm an application was submitted. Treated as Gmail-derived evidence, not direct Indeed access.",
    suggestedType: "job_application",
    suggestedClassification: { category: "application", momentum: "advanced_opportunity", creates: "activity" },
    confidence: 0.84,
    status: "pending",
    rawMetadata: { fromDomain: "indeed.com", provider: "gmail-mock", messageId: "mock-message-indeed" },
  },
  {
    id: "mock-client-lead",
    source: "gmail",
    sourceId: "gmail:mock:client-lead",
    title: "Client lead email",
    summary: "A prospective client asked about a project estimate. The suggestion stores only a short privacy-safe summary.",
    suggestedType: "client_lead",
    suggestedClassification: { category: "selling", momentum: "advanced_opportunity", creates: "opportunity" },
    confidence: 0.78,
    status: "pending",
    rawMetadata: { fromDomain: "client.example", senderLabel: "Prospect", provider: "mock", threadId: "mock-thread-client" },
  },
  {
    id: "mock-follow-up-reminder",
    source: "google_calendar",
    sourceId: "calendar:mock:follow-up",
    title: "Follow-up reminder",
    summary: "Upcoming reminder to follow up on an open opportunity. Future calendar items should become follow-ups, not completed activities.",
    suggestedType: "follow_up",
    suggestedClassification: { category: "admin", momentum: "advanced_opportunity", creates: "follow_up" },
    confidence: 0.72,
    status: "pending",
    rawMetadata: { provider: "mock", eventId: "mock-event-follow-up" },
  },
];

// ── Storage ───────────────────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function save<T>(key: string, val: T): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function uid(): string {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}
function generateSyncCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return seg() + "-" + seg();
}

// ── Legacy-shape migration ────────────────────────────────────────────────────
// "ig_connections" used to store a Record<string, ConnectionDetails> keyed by
// platform id (see CATALOG in earlier versions). It's now a TrackedPlatform[].
// Old-shaped data (an object, not an array) must be upgraded, not thrown on.
const LEGACY_PLATFORM_NAMES: Record<string, string> = {
  eaze: "Eaze", uber: "Uber Driver", instawork: "Instawork",
  workwhile: "WorkWhile", fiverr: "Fiverr", indeed: "Indeed", zip: "ZipRecruiter",
};
function normalizePlatforms(raw: unknown): TrackedPlatform[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
      .map(p => ({
        id: typeof p.id === "string" && p.id ? p.id : uid(),
        name: typeof p.name === "string" && p.name ? p.name : "Platform",
        addedAt: typeof p.addedAt === "number" ? p.addedAt : Date.now(),
      }));
  }
  if (raw && typeof raw === "object") {
    // Legacy Record<string, ConnectionDetails> shape.
    return Object.entries(raw as Record<string, unknown>).map(([id, details]) => {
      const linkedAt = details && typeof details === "object" && typeof (details as { linkedAt?: unknown }).linkedAt === "number"
        ? (details as { linkedAt: number }).linkedAt
        : Date.now();
      return { id, name: LEGACY_PLATFORM_NAMES[id] || id, addedAt: linkedAt };
    });
  }
  return [];
}
// "pg_tasks" used to be a single undifferentiated list ("Daily Action Plan").
// Items now carry a `type` ("daily" | "goal") that splits them across two
// sections. Older stored tasks lack this field and must be upgraded, not
// thrown on: everything defaults to "goal" except the uber delivery action,
// which is the one item that was actually a daily-resistance action.
function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map(t => {
      const text = typeof t.text === "string" ? t.text : "";
      const type: ActionType = t.type === "daily" || t.type === "goal" || t.type === "upcoming"
        ? t.type
        : /deliver a meal on uber/i.test(text) ? "daily" : "goal";
      return {
        id: typeof t.id === "string" && t.id ? t.id : uid(),
        text,
        done: t.done === true,
        completedAt: typeof t.completedAt === "string" ? t.completedAt : undefined,
        category: typeof t.category === "string" ? (t.category as ActivityCategory) : undefined,
        type,
        completedDates: Array.isArray(t.completedDates) ? t.completedDates.filter((d): d is string => typeof d === "string") : [],
        scheduledAt: typeof t.scheduledAt === "string" ? t.scheduledAt : undefined,
      };
    });
}
function normalizePlaidAccount(raw: unknown): PlaidAccountSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== "string") return null;
  return {
    id: a.id,
    name: typeof a.name === "string" ? a.name : "Account",
    officialName: typeof a.officialName === "string" ? a.officialName : undefined,
    mask: typeof a.mask === "string" ? a.mask : undefined,
    type: typeof a.type === "string" ? a.type : "",
    subtype: typeof a.subtype === "string" ? a.subtype : undefined,
    current: typeof a.current === "number" ? a.current : null,
    available: typeof a.available === "number" ? a.available : null,
    currency: typeof a.currency === "string" ? a.currency : "USD",
    rate: typeof a.rate === "number" ? a.rate : undefined,
    rateUpdatedAt: typeof a.rateUpdatedAt === "number" ? a.rateUpdatedAt : undefined,
  };
}
function normalizePlaidItems(raw: unknown): PlaidBankItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof i.itemId === "string")
    .map(i => ({
      itemId: i.itemId as string,
      institutionName: typeof i.institutionName === "string" ? i.institutionName : "Bank account",
      connectedAt: typeof i.connectedAt === "number" ? i.connectedAt : Date.now(),
      accounts: Array.isArray(i.accounts) ? i.accounts.map(normalizePlaidAccount).filter((a): a is PlaidAccountSummary => a !== null) : [],
      weeklyIncome: typeof i.weeklyIncome === "number" ? i.weeklyIncome : 0,
    }));
}
function mergeLocalPlaidRates(cloudItems: PlaidBankItem[], localItems: PlaidBankItem[]): PlaidBankItem[] {
  if (localItems.length === 0) return cloudItems;
  return cloudItems.map(item => {
    const localItem = localItems.find(local => local.itemId === item.itemId);
    if (!localItem) return item;
    return {
      ...item,
      accounts: item.accounts.map(account => {
        const localAccount = localItem.accounts.find(local => local.id === account.id);
        const localRateTime = localAccount?.rateUpdatedAt || 0;
        const cloudRateTime = account.rateUpdatedAt || 0;
        if (localAccount?.rate !== undefined && localRateTime > cloudRateTime) {
          return { ...account, rate: localAccount.rate, rateUpdatedAt: localAccount.rateUpdatedAt };
        }
        return account;
      }),
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dstr(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayStr(): string { return dstr(new Date()); }
function pacificTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function offsetDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return dstr(d);
}
function formatScheduled(scheduledAt?: string): string {
  if (!scheduledAt) return "";
  const [datePart, timePart] = scheduledAt.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!timePart) return dateLabel;
  const [hh, mm] = timePart.split(":").map(Number);
  const timeLabel = new Date(y, m - 1, d, hh, mm).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return dateLabel + ", " + timeLabel;
}
function fmt(n: number): string { return Math.round(n).toLocaleString("en-US"); }
function labelFor<T extends string>(items: { id: T; label: string }[], id: T | undefined, fallback = "Uncategorized"): string {
  return items.find(x => x.id === id)?.label || fallback;
}
function momentumMeta(id: MomentumClass) {
  return MOMENTUM_CLASSES.find(x => x.id === id) || MOMENTUM_CLASSES[MOMENTUM_CLASSES.length - 1];
}
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.7) return "Medium";
  return "Low";
}
function buildMockDetectedActivities(): DetectedActivity[] {
  const dates = [0, 1, -1, 0, 3];
  const now = Date.now();
  return MOCK_DETECTED_ACTIVITY_BLUEPRINTS.map((item, i) => ({
    ...item,
    detectedAt: now - i * 3600000,
    eventDate: offsetDate(dates[i] || 0),
  }));
}
function periodInfo(period: PayPeriod | undefined) {
  return PAY_PERIODS.find(p => p.id === period) || PAY_PERIODS[2];
}
function passiveFrequencyInfo(frequency: PassiveFrequency | undefined) {
  return PASSIVE_FREQUENCIES.find(p => p.id === frequency) || PASSIVE_FREQUENCIES[2];
}
function sourceAnnual(s: StoredSource): number {
  if (s.kind === "invest" && s.instrument === "Recurring") return (s.recurringAmount || 0) * passiveFrequencyInfo(s.recurringFrequency).annualMultiplier;
  if (s.kind === "invest") return (s.principal || 0) * (s.rate || 0) / 100;
  if (s.payType === "W2" && s.w2PayMode === "hourly") return (s.hourlyRate || 0) * (s.hours || 0) * 52;
  if (s.payType === "W2" && s.w2PayMode === "salary") return (s.salaryAmount || 0) * periodInfo(s.salaryPeriod).annualMultiplier;
  return (s.pay || 0) * 52;
}
function sourceDetail(s: StoredSource): string {
  if (s.kind === "invest" && s.instrument === "Recurring") {
    const frequency = passiveFrequencyInfo(s.recurringFrequency);
    return "$" + fmt(s.recurringAmount || 0) + "/" + frequency.suffix;
  }
  if (s.kind === "invest") return "$" + fmt(s.principal || 0) + " balance";
  if (s.payType === "W2" && s.w2PayMode === "hourly") return "$" + fmt(s.hourlyRate || 0) + "/hr · " + (s.hours || 0) + "h/wk";
  if (s.payType === "W2" && s.w2PayMode === "salary") {
    const period = periodInfo(s.salaryPeriod);
    return "$" + fmt(s.salaryAmount || 0) + "/" + period.suffix;
  }
  return "$" + fmt(s.pay || 0) + "/wk" + ((s.hours || 0) > 0 ? " · " + (s.hours || 0) + "h/wk" : "");
}
function sourceRate(s: StoredSource): string {
  if (s.kind === "invest" && s.instrument === "Recurring") return "$" + fmt(sourceAnnual(s)) + "/yr";
  if (s.kind === "invest") return s.rate === undefined ? "enter rate for projection" : s.rate.toFixed(2) + "%";
  if (s.payType === "W2" && s.w2PayMode === "hourly") return "$" + (s.hourlyRate || 0).toFixed(2) + "/hr";
  if (s.payType === "W2" && s.w2PayMode === "salary") return "$" + fmt(sourceAnnual(s)) + "/yr";
  return (s.hours || 0) > 0 ? "$" + ((s.pay || 0) / (s.hours || 1)).toFixed(2) + "/hr" : "—";
}

// ── Style constants ───────────────────────────────────────────────────────────

const FM: React.CSSProperties = { fontFamily: "var(--font-mono), monospace" };
const FS: React.CSSProperties = { fontFamily: "var(--font-sans), sans-serif" };

function seg(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "10px 6px", cursor: "pointer", textAlign: "center",
    border: "1px solid " + (active ? "var(--pg-accent)" : "var(--pg-border2)"),
    background: active ? "var(--pg-accent)" : "var(--pg-panel)",
    color: active ? "var(--pg-on-accent)" : "var(--pg-mut)",
    ...FM, fontWeight: 700, fontSize: "11px", letterSpacing: "0.06em",
  };
}

const inputBase: React.CSSProperties = {
  background: "var(--pg-panel)", border: "1px solid var(--pg-border2)", color: "var(--pg-ink)",
  fontSize: "14px", padding: "11px 13px",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PreGameApp() {
  // persisted
  const [tasks,       setTasks]       = useState<Task[]>([]);
  const [days,        setDays]        = useState<string[]>([]);
  const [phone,       setPhone]       = useState("");
  const [sources,     setSources]     = useState<StoredSource[]>([]);
  const [platforms,   setPlatforms]   = useState<TrackedPlatform[]>([]);
  const [activities,  setActivities]  = useState<Activity[]>([]);
  const [detectedActivities, setDetectedActivities] = useState<DetectedActivity[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [incomeEvents, setIncomeEvents] = useState<IncomeEvent[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [integrationConnections, setIntegrationConnections] = useState<IntegrationConnection[]>([]);
  const [plaidItems,  setPlaidItems]  = useState<PlaidBankItem[]>([]);
  const [syncedRateDrafts, setSyncedRateDrafts] = useState<Record<string, string>>({});
  const [plaidStatus, setPlaidStatus] = useState<"idle" | "loading" | "opening" | "connected" | "error">("idle");
  const [plaidError,  setPlaidError]  = useState<string | null>(null);
  const [platformDraft, setPlatformDraft] = useState("");
  const [hydrated,    setHydrated]    = useState(false);
  const [theme,       setTheme]       = useState<Theme>("ember");
  const [isDesktop,   setIsDesktop]   = useState(false);
  const [syncId,      setSyncId]      = useState("");
  const [syncStatus,  setSyncStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [syncCodeInput, setSyncCodeInput] = useState("");
  const [syncQrDataUrl, setSyncQrDataUrl] = useState("");
  const [scannerOpen,  setScannerOpen]  = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ui
  const [screen,   setScreen]   = useState<Screen>("list");
  const [draft,    setDraft]    = useState("");
  const [draftDaily, setDraftDaily] = useState("");
  const [draftUpcoming, setDraftUpcoming] = useState("");
  const [draftUpcomingDate, setDraftUpcomingDate] = useState("");
  const [draftUpcomingTime, setDraftUpcomingTime] = useState("");
  const [projId,   setProjId]   = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [seconds,  setSeconds]  = useState(60);
  const [phase,    setPhase]    = useState<"running" | "finished">("running");

  // add-income form
  const [addIncomeExpanded, setAddIncomeExpanded] = useState(false);
  const [srcType,       setSrcType]       = useState<SrcKind>("work");
  const [srcPayType,    setSrcPayType]    = useState<PayType>("W2");
  const [srcW2PayMode,  setSrcW2PayMode]  = useState<W2PayMode>("hourly");
  const [srcPayPeriod,  setSrcPayPeriod]  = useState<PayPeriod>("monthly");
  const [srcPassiveFrequency, setSrcPassiveFrequency] = useState<PassiveFrequency>("monthly");
  const [srcInstrument, setSrcInstrument] = useState<Instrument>("CD");
  const [srcName,       setSrcName]       = useState("");
  const [srcPay,        setSrcPay]        = useState("");
  const [srcHours,      setSrcHours]      = useState("");
  const [srcValue,      setSrcValue]      = useState("");
  const [srcRate,       setSrcRate]       = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanVideoRef  = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanRafRef    = useRef<number | null>(null);

  // hydrate
  useEffect(() => {
    const run = async () => {
      // 1. Load from localStorage
      const rawTasks = load<unknown>("pg_tasks", []);
      const normalizedTasks = normalizeTasks(rawTasks);
      setTasks(normalizedTasks);
      save("pg_tasks", normalizedTasks);
      setDays(load("pg_days", []));
      setPhone(load("pg_phone", ""));
      setTheme(load<Theme>("pg_theme", "ember"));
      setLeftSidebarCollapsed(load("pg_left_sidebar_collapsed", false));
      setRightSidebarCollapsed(load("pg_right_sidebar_collapsed", false));
      setSources(load("ii_sources", []));
      const rawPlatforms = load<unknown>("ig_connections", []);
      const normalizedPlatforms = normalizePlatforms(rawPlatforms);
      setPlatforms(normalizedPlatforms);
      if (!Array.isArray(rawPlatforms)) save("ig_connections", normalizedPlatforms);
      setActivities(load("pg_activities", []));
      const storedDetected = load<DetectedActivity[]>("pg_detected_activities", []);
      if (storedDetected.length > 0) {
        setDetectedActivities(storedDetected);
      } else {
        const seeded = buildMockDetectedActivities();
        setDetectedActivities(seeded);
        save("pg_detected_activities", seeded);
      }
      setOpportunities(load("pg_opportunities", []));
      setIncomeEvents(load("pg_income_events", []));
      setFollowUps(load("pg_followups", []));
      const storedIntegrationConnections = load<IntegrationConnection[]>("pg_integration_connections", []);
      const nextIntegrationConnections = storedIntegrationConnections.length > 0 ? storedIntegrationConnections : DEFAULT_INTEGRATION_CONNECTIONS;
      setIntegrationConnections(nextIntegrationConnections);
      save("pg_integration_connections", nextIntegrationConnections);
      const rawPlaidItems = load<unknown>("pg_plaid_items", []);
      let plaidItemsForIncome = normalizePlaidItems(rawPlaidItems);
      setPlaidItems(plaidItemsForIncome);
      if (!Array.isArray(rawPlaidItems)) save("pg_plaid_items", plaidItemsForIncome);

      // 2. Resolve sync ID
      let sid = load<string>("pg_sync_id", "");
      if (!sid) { sid = generateSyncCode(); save("pg_sync_id", sid); }
      setSyncId(sid);

      // 3. Pull from cloud (wins over local if data exists)
      try {
        const res = await fetch(`/api/sync?id=${encodeURIComponent(sid)}`);
        if (res.ok) {
          const { data } = await res.json() as { data: string | null };
          if (data) {
            const d = typeof data === "string" ? JSON.parse(data) : data;
            if (d.pg_tasks)                  { const nt = normalizeTasks(d.pg_tasks);  setTasks(nt);                     save("pg_tasks", nt); }
            if (d.pg_days)                   { setDays(d.pg_days);                    save("pg_days", d.pg_days); }
            if (d.pg_phone !== undefined)    { setPhone(d.pg_phone);                  save("pg_phone", d.pg_phone); }
            if (d.ii_sources)                { setSources(d.ii_sources);               save("ii_sources", d.ii_sources); }
            if (d.ig_connections)            { const p = normalizePlatforms(d.ig_connections); setPlatforms(p); save("ig_connections", p); }
            if (d.pg_activities)             { setActivities(d.pg_activities);          save("pg_activities", d.pg_activities); }
            if (d.pg_detected_activities)    { setDetectedActivities(d.pg_detected_activities); save("pg_detected_activities", d.pg_detected_activities); }
            if (d.pg_opportunities)          { setOpportunities(d.pg_opportunities);   save("pg_opportunities", d.pg_opportunities); }
            if (d.pg_income_events)          { setIncomeEvents(d.pg_income_events);    save("pg_income_events", d.pg_income_events); }
            if (d.pg_followups)              { setFollowUps(d.pg_followups);           save("pg_followups", d.pg_followups); }
            if (d.pg_integration_connections){ setIntegrationConnections(d.pg_integration_connections); save("pg_integration_connections", d.pg_integration_connections); }
            if (d.pg_plaid_items)            { const pi = mergeLocalPlaidRates(normalizePlaidItems(d.pg_plaid_items), plaidItemsForIncome); setPlaidItems(pi); save("pg_plaid_items", pi); plaidItemsForIncome = pi; }
          }
        }
      } catch { /* offline — use localStorage */ }

      if (plaidItemsForIncome.length > 0) void fetchPlaidIncome(sid, plaidItemsForIncome);

      setHydrated(true);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncId) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("sync", syncId);
    QRCode.toDataURL(shareUrl.toString(), { margin: 1, width: 220, errorCorrectionLevel: "M" })
      .then(setSyncQrDataUrl)
      .catch(() => setSyncQrDataUrl(""));
  }, [syncId]);

  useEffect(() => {
    if (!hydrated) return;
    const urlCode = new URLSearchParams(window.location.search).get("sync")?.trim().toUpperCase();
    if (!urlCode || urlCode === syncId) return;
    void Promise.resolve().then(() => setSyncCodeInput(urlCode));
    void handleLoadSyncCode(urlCode);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("sync");
    window.history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, syncId]);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  function chooseTheme(next: Theme) {
    setTheme(next);
    save("pg_theme", next);
  }

  function toggleLeftSidebar() {
    setLeftSidebarCollapsed(prev => {
      const next = !prev;
      save("pg_left_sidebar_collapsed", next);
      return next;
    });
  }

  function toggleRightSidebar() {
    setRightSidebarCollapsed(prev => {
      const next = !prev;
      save("pg_right_sidebar_collapsed", next);
      return next;
    });
  }

  // sync to cloud (debounced 1.5s after any state change)
  useEffect(() => {
    if (!hydrated || !syncId) return;
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      const data = { pg_tasks: tasks, pg_days: days, pg_phone: phone, ii_sources: sources, ig_connections: platforms, pg_activities: activities, pg_detected_activities: detectedActivities, pg_opportunities: opportunities, pg_income_events: incomeEvents, pg_followups: followUps, pg_integration_connections: integrationConnections, pg_plaid_items: plaidItems };
      setSyncStatus("saving");
      fetch(`/api/sync?id=${encodeURIComponent(syncId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(() => {
          setSyncStatus("saved");
          setTimeout(() => setSyncStatus(s => s === "saved" ? "idle" : s), 2000);
        })
        .catch(() => setSyncStatus("error"));
    }, 1500);
    return () => { if (syncRef.current) clearTimeout(syncRef.current); };
  }, [tasks, days, phone, sources, platforms, activities, detectedActivities, opportunities, incomeEvents, followUps, integrationConnections, plaidItems, hydrated, syncId]);

  // countdown timer
  useEffect(() => {
    if (screen !== "countdown") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeconds(60);
    setPhase("running");
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setPhase("finished"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, activeId]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const normManual: NormSource[] = sources.map(s => ({ ...s, synced: false }));
  const plaidWorkSources: NormSource[] = plaidItems
    .filter(item => item.accounts.length === 0 || item.accounts.some(a => !isInvestmentPlaidAccount(a)))
    .map(item => ({
      id: "plaid:" + item.itemId, name: item.institutionName, kind: "work", payType: "GIG", pay: item.weeklyIncome, synced: true,
    }));
  const plaidInvestSources: NormSource[] = plaidItems.flatMap(item =>
    item.accounts.filter(isInvestmentPlaidAccount).map(account => ({
      id: "plaid:" + item.itemId + ":" + account.id,
      name: item.institutionName + " " + (account.name || account.officialName || "Account"),
      kind: "invest" as SrcKind,
      instrument: plaidInstrumentForSubtype(account.subtype),
      principal: account.current ?? 0,
      rate: account.rate,
      synced: true,
    })),
  );
  const allSources: NormSource[] = [...normManual, ...plaidWorkSources, ...plaidInvestSources];

  const workAnnual    = allSources.filter(s => s.kind === "work").reduce((a, s) => a + sourceAnnual(s), 0);
  const passiveAnnual = allSources.filter(s => s.kind === "invest").reduce((a, s) => a + sourceAnnual(s), 0);
  const annual        = workAnnual + passiveAnnual;

  function computeStreak(): number {
    const activityDays = activities.map(a => a.dateCompleted).filter(Boolean);
    const set = new Set(activityDays.length > 0 ? activityDays : days);
    const d = new Date();
    if (!set.has(dstr(d))) { d.setDate(d.getDate() - 1); if (!set.has(dstr(d))) return 0; }
    let count = 0;
    while (set.has(dstr(d))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }

  const connectedCount = platforms.length + plaidItems.length;
  const pendingDetected = detectedActivities.filter(item => item.status === "pending").sort((a, b) => (b.eventDate || "").localeCompare(a.eventDate || "") || b.detectedAt - a.detectedAt);
  const pendingDetectedCount = pendingDetected.length;
  const dailyTasks      = tasks.filter(t => t.type === "daily");
  const goalTasks       = tasks.filter(t => t.type === "goal");
  const upcomingTasks   = tasks.filter(t => t.type === "upcoming").slice().sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));
  const activeTask     = tasks.find(t => t.id === activeId);
  const pendingActivity = activities.find(a => a.id === pendingActivityId) || null;
  const low            = phase === "running" && seconds <= 10;
  const phoneClean     = phone.replace(/[^\d+]/g, "");
  const smsHref        = "sms:" + phoneClean + "?&body=" + encodeURIComponent("Heading out.");
  const proj           = projId ? allSources.find(x => x.id === projId) : null;

  const namePH = srcType !== "invest" ? "e.g. Warehouse shift"
    : srcInstrument === "CD" ? "e.g. Navy Federal 12-mo CD"
    : srcInstrument === "Dividend" ? "e.g. VOO dividends"
    : srcInstrument === "Recurring" ? "e.g. Pension, annuity, rent, stipend" : "e.g. Navy Federal savings";

  const today = pacificTodayStr();
  const sortedActivities = [...activities].sort((a, b) => b.timestamp - a.timestamp);
  const dayCounts = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const date = dstr(d);
    return { date, count: activities.filter(a => a.dateCompleted === date).length };
  });
  const maxDayCount = Math.max(1, ...dayCounts.map(d => d.count));
  const incomeGrowthActions = activities.filter(a => momentumMeta(a.momentum).helpsIncome);
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weeklyIncomeGrowth = incomeGrowthActions.filter(a => a.timestamp >= weekStart.getTime()).length;
  const activityDates = Array.from(new Set(activities.map(a => a.dateCompleted))).sort();
  function longestActivityStreak(): number {
    let longest = 0, run = 0, prev = 0;
    activityDates.forEach(date => {
      const current = new Date(date + "T00:00:00").getTime();
      if (!prev || current - prev === 86400000) run += 1;
      else run = 1;
      longest = Math.max(longest, run);
      prev = current;
    });
    return longest;
  }
  function countBy<T extends string>(values: T[]): Record<T, number> {
    return values.reduce((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {} as Record<T, number>);
  }
  const categoryCounts = countBy(activities.map(a => a.category || "uncategorized"));
  const momentumCounts = countBy(activities.map(a => a.momentum));

  // ── Actions ───────────────────────────────────────────────────────────────

  function addTask() {
    const text = draft.trim();
    if (!text) return;
    const next = [...tasks, { id: uid(), text, done: false, type: "goal" as ActionType }];
    setTasks(next); save("pg_tasks", next); setDraft("");
  }
  function addDailyTask() {
    const text = draftDaily.trim();
    if (!text) return;
    const next = [...tasks, { id: uid(), text, done: false, type: "daily" as ActionType, completedDates: [] }];
    setTasks(next); save("pg_tasks", next); setDraftDaily("");
  }
  function toggleDailyDone(id: string) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const doneToday = (t.completedDates || []).includes(today);
    const nextDates = doneToday ? (t.completedDates || []).filter(d => d !== today) : [...(t.completedDates || []), today];
    const next = tasks.map(x => x.id === id ? { ...x, completedDates: nextDates } : x);
    setTasks(next); save("pg_tasks", next);
    if (!doneToday) {
      const nextDays = days.includes(today) ? days : [...days, today];
      setDays(nextDays); save("pg_days", nextDays);
    }
  }
  function addUpcomingTask() {
    const text = draftUpcoming.trim();
    if (!text) return;
    const scheduledAt = draftUpcomingDate ? draftUpcomingDate + (draftUpcomingTime ? "T" + draftUpcomingTime : "") : undefined;
    const next = [...tasks, { id: uid(), text, done: false, type: "upcoming" as ActionType, scheduledAt }];
    setTasks(next); save("pg_tasks", next); setDraftUpcoming(""); setDraftUpcomingDate(""); setDraftUpcomingTime("");
  }
  function toggleUpcomingDone(id: string) {
    const next = tasks.map(x => x.id === id ? { ...x, done: !x.done } : x);
    setTasks(next); save("pg_tasks", next);
  }
  function removeTask(id: string) {
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); save("pg_tasks", next);
  }
  function openCountdown(id: string) {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveId(id); setScreen("countdown");
  }
  function standDown() {
    if (timerRef.current) clearInterval(timerRef.current);
    setScreen("list"); setActiveId(null);
  }
  function imMoving() {
    if (timerRef.current) clearInterval(timerRef.current);
    const completedTask = tasks.find(t => t.id === activeId);
    const now = Date.now();
    const completedDate = dstr(new Date(now));
    const nextDays  = days.includes(completedDate) ? days : [...days, completedDate];
    const nextTasks = tasks.map(t => t.id === activeId ? { ...t, done: true, completedAt: completedDate } : t);
    const activity: Activity | null = completedTask ? {
      id: uid(),
      taskId: completedTask.id,
      title: completedTask.text,
      dateCompleted: completedDate,
      timestamp: now,
      category: completedTask.category,
      momentum: "not_sure",
    } : null;
    const nextActivities = activity ? [...activities, activity] : activities;
    setDays(nextDays); setTasks(nextTasks); setActivities(nextActivities);
    save("pg_days", nextDays); save("pg_tasks", nextTasks);
    save("pg_activities", nextActivities);
    setPendingActivityId(activity?.id || null);
    setScreen(activity ? "classify" : "list"); setActiveId(null);
  }
  function classifyActivity(momentum: MomentumClass) {
    if (!pendingActivityId) { setScreen("list"); return; }
    const next = activities.map(a => a.id === pendingActivityId ? { ...a, momentum } : a);
    setActivities(next); save("pg_activities", next);
    setPendingActivityId(null); setScreen("history");
  }
  function addSource() {
    const name = srcName.trim(); if (!name) return;
    let src: StoredSource;
    if (srcType === "work" && srcPayType === "W2" && srcW2PayMode === "hourly") {
      const hourlyRate = parseFloat(srcPay) || 0;
      const hours = parseFloat(srcHours) || 0;
      src = { id: uid(), name, kind: "work", payType: "W2", w2PayMode: "hourly", hourlyRate, hours, pay: hourlyRate * hours };
    } else if (srcType === "work" && srcPayType === "W2" && srcW2PayMode === "salary") {
      const salaryAmount = parseFloat(srcPay) || 0;
      const annualPay = salaryAmount * periodInfo(srcPayPeriod).annualMultiplier;
      src = { id: uid(), name, kind: "work", payType: "W2", w2PayMode: "salary", salaryAmount, salaryPeriod: srcPayPeriod, pay: annualPay / 52 };
    } else if (srcType === "work") {
      src = { id: uid(), name, kind: "work", payType: srcPayType, pay: parseFloat(srcPay) || 0, hours: parseFloat(srcHours) || 0 };
    } else if (srcInstrument === "Recurring") {
      const recurringAmount = parseFloat(srcValue) || 0;
      src = { id: uid(), name, kind: "invest", instrument: "Recurring", recurringAmount, recurringFrequency: srcPassiveFrequency };
    } else {
      src = { id: uid(), name, kind: "invest", instrument: srcInstrument, principal: parseFloat(srcValue) || 0, rate: parseFloat(srcRate) || 0 };
    }
    const next = [...sources, src];
    setSources(next); save("ii_sources", next);
    setSrcName(""); setSrcPay(""); setSrcHours(""); setSrcValue(""); setSrcRate(""); setSrcPassiveFrequency("monthly");
    setAddIncomeExpanded(false);
  }
  function removeSource(id: string) {
    const next = sources.filter(s => s.id !== id);
    setSources(next); save("ii_sources", next);
  }
  function addPlatform() {
    const name = platformDraft.trim();
    if (!name) return;
    const next = [...platforms, { id: uid(), name, addedAt: Date.now() }];
    setPlatforms(next); save("ig_connections", next);
    setPlatformDraft("");
  }
  function removePlatform(id: string) {
    const next = platforms.filter(p => p.id !== id);
    setPlatforms(next); save("ig_connections", next);
  }
  function saveDetected(next: DetectedActivity[]) {
    setDetectedActivities(next); save("pg_detected_activities", next);
  }
  function updateDetected(id: string, patch: Partial<DetectedActivity>) {
    const next = detectedActivities.map(item => item.id === id ? { ...item, ...patch } : item);
    saveDetected(next);
  }
  function logDetectedActivity(id: string) {
    const item = detectedActivities.find(x => x.id === id);
    if (!item) return;
    const activity: Activity = {
      id: uid(),
      taskId: "detected:" + item.id,
      title: item.title,
      dateCompleted: item.eventDate || todayStr(),
      timestamp: item.detectedAt,
      category: item.suggestedClassification.category,
      momentum: item.suggestedClassification.momentum,
    };
    const nextActivities = [...activities, activity];
    setActivities(nextActivities); save("pg_activities", nextActivities);
    updateDetected(id, { status: "logged", linkedActivityId: activity.id });
  }
  function ignoreDetectedActivity(id: string) {
    updateDetected(id, { status: "ignored" });
  }
  function linkDetectedOpportunity(id: string) {
    const item = detectedActivities.find(x => x.id === id);
    if (!item) return;
    const now = item.detectedAt;
    const stage: Opportunity["stage"] = item.suggestedType === "job_application" ? "applied"
      : item.suggestedType === "recruiter_reply" ? "replied"
      : item.suggestedType === "interview_request" ? "interview" : "lead";
    const opportunity: Opportunity = {
      id: uid(), title: item.title, source: item.source, stage, createdAt: now, updatedAt: now, detectedActivityIds: [item.id],
    };
    const next = [...opportunities, opportunity];
    setOpportunities(next); save("pg_opportunities", next);
    updateDetected(id, { status: "linked", linkedOpportunityId: opportunity.id });
  }
  function markDetectedIncomeEvent(id: string) {
    const item = detectedActivities.find(x => x.id === id);
    if (!item) return;
    const incomeEvent: IncomeEvent = { id: uid(), title: item.title, eventDate: item.eventDate || todayStr(), source: item.source, detectedActivityId: item.id };
    const next = [...incomeEvents, incomeEvent];
    setIncomeEvents(next); save("pg_income_events", next);
    updateDetected(id, { status: "linked", linkedIncomeEventId: incomeEvent.id });
  }
  function createDetectedFollowUp(id: string) {
    const item = detectedActivities.find(x => x.id === id);
    if (!item) return;
    const now = item.detectedAt;
    const followUp: FollowUp = { id: uid(), title: item.title, dueDate: item.eventDate, source: item.source, detectedActivityId: item.id, status: "open", createdAt: now };
    const next = [...followUps, followUp];
    setFollowUps(next); save("pg_followups", next);
    updateDetected(id, { status: "linked", linkedFollowUpId: followUp.id });
  }
  function resetDetectedExamples() {
    const seeded = buildMockDetectedActivities();
    saveDetected(seeded);
  }

  async function fetchPlaidIncome(sid?: string, itemsOverride?: PlaidBankItem[]) {
    const id = sid || syncId;
    const base = itemsOverride || plaidItems;
    if (!id || base.length === 0) return;
    try {
      const res = await fetch(`/api/plaid/income?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const { byItem } = await res.json() as { weeklyAvg: number; byItem: { itemId: string; weeklyAvg: number }[] };
      setPlaidItems(prev => {
        const currentBase = prev.length > 0 ? prev : base;
        const next = currentBase.map(item => {
          const match = byItem.find(b => b.itemId === item.itemId);
          return match ? { ...item, weeklyIncome: match.weeklyAvg } : item;
        });
        save("pg_plaid_items", next);
        return next;
      });
    } catch { /* offline */ }
  }

  function loadPlaidScript() {
    return new Promise<void>((resolve, reject) => {
      if (window.Plaid) { resolve(); return; }
      const src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      const existing = document.querySelector<HTMLScriptElement>('script[src="' + src + '"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Plaid Link failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Plaid Link failed to load."));
      document.body.appendChild(script);
    });
  }

  async function connectPlaid() {
    setPlaidStatus("loading"); setPlaidError(null);
    try {
      const tokenRes = await fetch("/api/plaid/link-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.link_token) throw new Error(tokenData.error || "Plaid link token failed.");
      await loadPlaidScript();
      if (!window.Plaid) throw new Error("Plaid Link is unavailable.");
      const handler = window.Plaid.create({
        token: tokenData.link_token,
        onSuccess: (publicToken, metadata) => {
          setPlaidStatus("loading");
          fetch("/api/plaid/exchange-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token: publicToken, sync_id: syncId, institution_name: metadata.institution?.name || "" }),
          })
            .then(async res => {
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Plaid account import failed.");
              const newItem: PlaidBankItem = {
                itemId: data.item_id,
                institutionName: data.institution_name || metadata.institution?.name || "Bank account",
                connectedAt: Date.now(),
                accounts: data.accounts || [],
                weeklyIncome: 0,
              };
              const next = [...plaidItems, newItem];
              setPlaidItems(next); save("pg_plaid_items", next);
              setPlaidStatus("connected");
              void fetchPlaidIncome(syncId, next);
            })
            .catch(err => {
              setPlaidError(err instanceof Error ? err.message : "Plaid account import failed.");
              setPlaidStatus("error");
            });
        },
        onExit: error => {
          if (error) {
            setPlaidError(error.error_message || "Plaid Link was closed with an error.");
            setPlaidStatus("error");
          } else {
            setPlaidStatus("idle");
          }
        },
      });
      setPlaidStatus("opening");
      handler.open();
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : "Plaid setup failed.");
      setPlaidStatus("error");
    }
  }

  async function disconnectPlaidItem(itemId: string) {
    const next = plaidItems.filter(i => i.itemId !== itemId);
    setPlaidItems(next); save("pg_plaid_items", next);
    try {
      await fetch("/api/plaid/item-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync_id: syncId, item_id: itemId }),
      });
    } catch { /* best-effort server-side cleanup */ }
  }

  function plaidItemIdFromSourceId(id: string): string {
    return id.replace(/^plaid:/, "").split(":")[0];
  }

  function plaidAccountIdFromSourceId(id: string): string | undefined {
    const parts = id.replace(/^plaid:/, "").split(":");
    return parts.length > 1 ? parts.slice(1).join(":") : undefined;
  }

  function updateSyncedInvestRate(sourceId: string, valueStr: string) {
    const itemId = plaidItemIdFromSourceId(sourceId);
    const accountId = plaidAccountIdFromSourceId(sourceId);
    if (!accountId) return;
    setSyncedRateDrafts(prev => ({ ...prev, [sourceId]: valueStr }));
    const trimmed = valueStr.trim();
    const parsed = trimmed === "" ? undefined : Number(trimmed);
    if (parsed !== undefined && !Number.isFinite(parsed)) return;
    const rateUpdatedAt = Date.now();
    setPlaidItems(prev => {
      const next = prev.map(item => item.itemId !== itemId ? item : {
        ...item,
        accounts: item.accounts.map(a => a.id === accountId ? { ...a, rate: parsed, rateUpdatedAt } : a),
      });
      save("pg_plaid_items", next);
      return next;
    });
  }

  async function handleLoadSyncCode(codeOverride?: string) {
    const code = (codeOverride || syncCodeInput).trim().toUpperCase();
    if (code.length < 4) return;
    try {
      const res = await fetch(`/api/sync?id=${encodeURIComponent(code)}`);
      if (!res.ok) return;
      const { data } = await res.json() as { data: string | null };
      if (!data) return;
      const d = typeof data === "string" ? JSON.parse(data) : data;
      if (d.pg_tasks)                  { const nt = normalizeTasks(d.pg_tasks);  setTasks(nt);                     save("pg_tasks", nt); }
      if (d.pg_days)                   { setDays(d.pg_days);                    save("pg_days", d.pg_days); }
      if (d.pg_phone !== undefined)    { setPhone(d.pg_phone);                  save("pg_phone", d.pg_phone); }
      if (d.ii_sources)                { setSources(d.ii_sources);               save("ii_sources", d.ii_sources); }
      if (d.ig_connections)            { const p = normalizePlatforms(d.ig_connections); setPlatforms(p); save("ig_connections", p); }
      if (d.pg_activities)             { setActivities(d.pg_activities);          save("pg_activities", d.pg_activities); }
      if (d.pg_detected_activities)    { setDetectedActivities(d.pg_detected_activities); save("pg_detected_activities", d.pg_detected_activities); }
      if (d.pg_opportunities)          { setOpportunities(d.pg_opportunities);   save("pg_opportunities", d.pg_opportunities); }
      if (d.pg_income_events)          { setIncomeEvents(d.pg_income_events);    save("pg_income_events", d.pg_income_events); }
      if (d.pg_followups)              { setFollowUps(d.pg_followups);           save("pg_followups", d.pg_followups); }
      if (d.pg_integration_connections){ setIntegrationConnections(d.pg_integration_connections); save("pg_integration_connections", d.pg_integration_connections); }
      if (d.pg_plaid_items)            { const pi = normalizePlaidItems(d.pg_plaid_items); setPlaidItems(pi); save("pg_plaid_items", pi); void fetchPlaidIncome(code, pi); }
      setSyncId(code); save("pg_sync_id", code);
      setSyncCodeInput("");
    } catch {}
  }

  function extractSyncCode(scanned: string): string {
    try {
      const url = new URL(scanned);
      const fromUrl = url.searchParams.get("sync");
      if (fromUrl) return fromUrl.trim().toUpperCase();
    } catch { /* not a URL, treat as a raw code */ }
    return scanned.trim().toUpperCase();
  }

  function stopScanner() {
    if (scanRafRef.current !== null) { cancelAnimationFrame(scanRafRef.current); scanRafRef.current = null; }
    if (scanStreamRef.current) { scanStreamRef.current.getTracks().forEach(t => t.stop()); scanStreamRef.current = null; }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
    setScannerOpen(false);
  }

  async function openScanner() {
    setScannerError(null);
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      scanStreamRef.current = stream;
      const video = scanVideoRef.current;
      if (!video) { stopScanner(); return; }
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const tick = () => {
        if (!scanVideoRef.current || !ctx) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(frame.data, frame.width, frame.height);
          if (result?.data) {
            const code = extractSyncCode(result.data);
            stopScanner();
            void handleLoadSyncCode(code);
            return;
          }
        }
        scanRafRef.current = requestAnimationFrame(tick);
      };
      scanRafRef.current = requestAnimationFrame(tick);
    } catch {
      setScannerError("Camera unavailable. Check permissions, or paste the code below instead.");
    }
  }

  useEffect(() => {
    return () => stopScanner();
  }, []);

  function resetAll() {
    if (!confirm("Reset all data? This clears your income sources, connections, actions, streak, and saved number.")) return;
    ["pg_tasks", "pg_days", "pg_phone", "ii_sources", "ig_connections", "pg_activities", "pg_detected_activities", "pg_opportunities", "pg_income_events", "pg_followups", "pg_integration_connections", "pg_plaid_items", "pg_sync_id"].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    const newSyncId = generateSyncCode(); setSyncId(newSyncId); save("pg_sync_id", newSyncId); setSyncStatus("idle"); setSyncCodeInput("");
    if (timerRef.current) clearInterval(timerRef.current);
    setTasks([]); setDays([]); setPhone(""); setSources([]); setPlatforms([]); setActivities([]); setDetectedActivities([]); setOpportunities([]); setIncomeEvents([]); setFollowUps([]); setIntegrationConnections(DEFAULT_INTEGRATION_CONNECTIONS); setPlaidItems([]);
    setDraft(""); setDraftDaily(""); setDraftUpcoming(""); setDraftUpcomingDate(""); setDraftUpcomingTime(""); setScreen("list"); setActiveId(null); setProjId(null); setPendingActivityId(null);
    setSrcType("work"); setSrcPayType("W2"); setSrcW2PayMode("hourly"); setSrcPayPeriod("monthly"); setSrcInstrument("CD");
    setSrcName(""); setSrcPay(""); setSrcHours(""); setSrcValue(""); setSrcRate(""); setSrcPassiveFrequency("monthly");
  }

  if (!hydrated) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  const NAV_ITEMS: { id: Screen; label: string; icon: string; badge: number }[] = [
    { id: "list", label: "DASHBOARD", icon: "D", badge: 0 },
    // TEMP DISABLED (2026-07-01): Detected nav item — uncomment to re-enable
    // { id: "detected", label: "DETECTED", icon: "!", badge: pendingDetectedCount },
    { id: "history", label: "ACTION HISTORY", icon: "M", badge: 0 },
    { id: "settings", label: "SETTINGS", icon: "S", badge: 0 },
  ];
  const isNavItemActive = (id: Screen) => screen === id || (id === "list" && (screen === "countdown" || screen === "classify" || screen === "projection"));
  const goToScreen = (id: Screen) => { if (timerRef.current) clearInterval(timerRef.current); setScreen(id); setMobileMenuOpen(false); };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", background: "var(--pg-bg)", ...FS }}>

      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────────── */}
      {isDesktop && (
        <aside style={{ width: leftSidebarCollapsed ? "64px" : "220px", flexShrink: 0, background: "var(--pg-panel)", borderRight: "1px solid var(--pg-line)", display: "flex", flexDirection: "column", minHeight: "100dvh", transition: "width 160ms ease" }}>
          <div style={{ padding: leftSidebarCollapsed ? "20px 10px" : "22px 16px 18px 14px", borderBottom: "1px solid var(--pg-line)", display: "flex", alignItems: "center", gap: "14px", justifyContent: leftSidebarCollapsed ? "center" : "space-between" }}>
            <button onClick={toggleLeftSidebar} aria-label={leftSidebarCollapsed ? "Expand left sidebar" : "Collapse left sidebar"} title={leftSidebarCollapsed ? "Expand left sidebar" : "Collapse left sidebar"}
              style={{ width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: leftSidebarCollapsed ? "var(--pg-card2)" : "none", border: "1px solid var(--pg-border2)", color: "var(--pg-accent)", ...FM, fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>
              ☰
            </button>
            {!leftSidebarCollapsed && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/income-growth-tracker-logo-transparent.png" alt="Income Growth Tracker" width={180} height={93} style={{ width: "120px", height: "auto", display: "block", flexShrink: 0 }} />
            )}
          </div>
          <nav style={{ display: "flex", flexDirection: "column", paddingTop: "8px" }}>
            {NAV_ITEMS.map(item => {
              const active = isNavItemActive(item.id);
              return (
                <button key={item.id}
                  title={leftSidebarCollapsed ? item.label : undefined}
                  onClick={() => goToScreen(item.id)}
                  style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: leftSidebarCollapsed ? "center" : "flex-start", width: "100%", minHeight: "43px", padding: leftSidebarCollapsed ? "12px 0" : "13px 16px", background: active ? "var(--pg-card2)" : "none", border: "none", borderLeft: "3px solid " + (active ? "var(--pg-accent)" : "transparent"), color: active ? "var(--pg-ink)" : "var(--pg-mut2)", ...FM, fontWeight: 700, fontSize: "11px", letterSpacing: "0.12em", cursor: "pointer", textAlign: "left", gap: "8px" }}>
                  {leftSidebarCollapsed ? item.icon : item.label}
                  {item.badge > 0 && (
                    <span style={leftSidebarCollapsed ? { position: "absolute", top: "7px", right: "8px", ...FM, fontSize: "8px", background: "var(--pg-accent)", color: "var(--pg-on-accent)", padding: "1px 4px" } : { ...FM, fontSize: "8px", background: "var(--pg-accent)", color: "var(--pg-on-accent)", padding: "2px 6px", marginLeft: "auto" }}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", background: "var(--pg-panel)", overflow: "hidden" }}>
        {isDesktop && screen === "list" && (
          <button onClick={toggleRightSidebar} aria-label={rightSidebarCollapsed ? "Expand right sidebar" : "Collapse right sidebar"} title={rightSidebarCollapsed ? "Expand right sidebar" : "Collapse right sidebar"}
            style={{ position: "absolute", top: "16px", right: "18px", zIndex: 4, display: "flex", alignItems: "center", gap: "7px", background: "var(--pg-card2)", border: "1px solid var(--pg-border2)", color: "var(--pg-accent)", ...FM, fontWeight: 800, fontSize: "9px", letterSpacing: "0.1em", padding: "9px 10px", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,0.18)" }}>
            {rightSidebarCollapsed ? "‹" : "›"} {rightSidebarCollapsed ? "SHOW PANEL" : "HIDE PANEL"}
          </button>
        )}

        {/* ── MOBILE HEADER ──────────────────────────────────────────────── */}
        {!isDesktop && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "20px 24px", borderBottom: "1px solid var(--pg-line)", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/income-growth-tracker-logo-transparent.png" alt="Income Growth Tracker" width={180} height={93} style={{ width: "100px", height: "auto", display: "block", flexShrink: 0 }} />

            <button onClick={() => setMobileMenuOpen(prev => !prev)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} aria-expanded={mobileMenuOpen}
              style={{ width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: mobileMenuOpen ? "var(--pg-card2)" : "none", border: "1px solid var(--pg-border2)", color: "var(--pg-accent)", ...FM, fontWeight: 800, fontSize: "16px", cursor: "pointer" }}>
              {mobileMenuOpen ? "✕" : "☰"}
            </button>

            {mobileMenuOpen && (
              <>
                <div onClick={() => setMobileMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 9, background: "rgba(0,0,0,0.35)" }} />
                <nav style={{ position: "absolute", top: "calc(100% - 1px)", right: "24px", zIndex: 10, display: "flex", flexDirection: "column", minWidth: "220px", background: "var(--pg-panel)", border: "1px solid var(--pg-line)", boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
                  {NAV_ITEMS.map(item => {
                    const active = isNavItemActive(item.id);
                    return (
                      <button key={item.id} onClick={() => goToScreen(item.id)}
                        style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", minHeight: "48px", padding: "13px 16px", background: active ? "var(--pg-card2)" : "none", border: "none", borderLeft: "3px solid " + (active ? "var(--pg-accent)" : "transparent"), color: active ? "var(--pg-ink)" : "var(--pg-mut2)", ...FM, fontWeight: 700, fontSize: "11px", letterSpacing: "0.12em", cursor: "pointer", textAlign: "left", gap: "8px" }}>
                        {item.label}
                        {item.badge > 0 && (
                          <span style={{ ...FM, fontSize: "8px", background: "var(--pg-accent)", color: "var(--pg-on-accent)", padding: "2px 6px", marginLeft: "auto" }}>{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </div>
        )}

        {/* ── DETECTED ACTIVITY INBOX ───────────────────────────────────── */}
        {/* TEMP DISABLED (2026-07-01): remove `false &&` below to re-enable this screen */}
        {false && screen === "detected" && (
          <div className="pg-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "22px", padding: "24px" }}>
            <button onClick={() => setScreen("list")}
              style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--pg-mut)", ...FM, fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>← BACK</button>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-accent)" }}>DETECTED ACTIVITY INBOX</span>
              <h1 style={{ margin: 0, ...FS, fontSize: "27px", lineHeight: 1.08, color: "var(--pg-ink)" }}>What happened in the real world?</h1>
              <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                Mock evidence stream for Gmail, Google Calendar, and Indeed-via-Gmail. Nothing is permanently logged until you confirm it.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)" }}>
              {[
                { label: "PENDING", value: pendingDetectedCount, accent: true },
                { label: "LOGGED", value: detectedActivities.filter(x => x.status === "logged").length, accent: false },
                { label: "LINKED / IGNORED", value: detectedActivities.filter(x => x.status === "linked" || x.status === "ignored").length, accent: false },
              ].map((stat, i, arr) => (
                <div key={stat.label} style={{ padding: "14px", borderRight: i < arr.length - 1 ? "1px solid var(--pg-border)" : undefined }}>
                  <div style={{ ...FM, fontWeight: 800, fontSize: "26px", color: stat.accent ? "var(--pg-accent)" : "var(--pg-ink)", fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
                  <div style={{ marginTop: "5px", ...FM, fontSize: "8px", letterSpacing: "0.12em", color: "var(--pg-mut)" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {integrationConnections.map(conn => (
                <div key={conn.id} style={{ border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ ...FS, fontWeight: 700, fontSize: "13px", color: "var(--pg-ink)" }}>{conn.label}</span>
                    <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.12em", color: conn.status === "mock" ? "var(--pg-accent)" : "var(--pg-ok)" }}>{conn.status.toUpperCase()} · READ ONLY</span>
                  </div>
                  <span style={{ ...FS, fontSize: "11px", lineHeight: 1.45, color: "var(--pg-mut2)" }}>{conn.privacySummary}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--pg-border2)", background: "var(--pg-panel)", padding: "14px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.18em", color: "var(--pg-mut)" }}>READ-ONLY PROTOTYPE</span>
              <span style={{ ...FS, fontSize: "12px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                No OAuth is connected yet. These examples store source IDs, domains, dates, titles, and short summaries only — no full email bodies, no sent email, no calendar edits, and no direct Indeed automation.
              </span>
              <button onClick={resetDetectedExamples}
                style={{ alignSelf: "flex-start", background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "8px 10px", cursor: "pointer" }}>
                RESET MOCK INBOX
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {pendingDetected.length > 0 ? pendingDetected.map(item => {
                const meta = momentumMeta(item.suggestedClassification.momentum);
                return (
                  <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "14px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                      <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.1em", color: "var(--pg-accent)", border: "1px solid var(--pg-ok-border)", padding: "3px 6px" }}>{SOURCE_LABELS[item.source].toUpperCase()}</span>
                      <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.1em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "3px 6px" }}>{TYPE_LABELS[item.suggestedType].toUpperCase()}</span>
                      <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.1em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "3px 6px" }}>STATUS: {item.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                      <span style={{ ...FS, fontWeight: 700, fontSize: "17px", color: "var(--pg-ink)" }}>{item.title}</span>
                      <span style={{ ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut)" }}>{item.summary}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.08em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "7px" }}>EVENT: {item.eventDate || "UNKNOWN"}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.08em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "7px" }}>DETECTED: {dstr(new Date(item.detectedAt))}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.08em", color: meta.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut)", border: "1px solid " + (meta.helpsIncome ? "var(--pg-ok-border)" : "var(--pg-border2)"), padding: "7px" }}>CLASS: {labelFor(ACTIVITY_CATEGORIES, item.suggestedClassification.category).toUpperCase()} · {meta.short.toUpperCase()}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.08em", color: item.confidence >= 0.85 ? "var(--pg-ok)" : "var(--pg-accent)", border: "1px solid var(--pg-border2)", padding: "7px" }}>CONFIDENCE: {confidenceLabel(item.confidence).toUpperCase()} {Math.round(item.confidence * 100)}%</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" }}>
                      <button onClick={() => logDetectedActivity(item.id)} style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em", padding: "10px", cursor: "pointer" }}>LOG IT</button>
                      <button onClick={() => ignoreDetectedActivity(item.id)} style={{ background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-mut)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "10px", cursor: "pointer" }}>IGNORE</button>
                      <button onClick={() => linkDetectedOpportunity(item.id)} style={{ background: "none", border: "1px solid var(--pg-ok-border)", color: "var(--pg-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "10px", cursor: "pointer" }}>LINK TO OPPORTUNITY</button>
                      <button onClick={() => markDetectedIncomeEvent(item.id)} style={{ background: "none", border: "1px solid var(--pg-ok-border)", color: "var(--pg-ok)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "10px", cursor: "pointer" }}>MARK AS INCOME</button>
                      <button onClick={() => createDetectedFollowUp(item.id)} style={{ gridColumn: "1 / -1", background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-ink)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "10px", cursor: "pointer" }}>REMIND ME TO FOLLOW UP</button>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ border: "1px dashed var(--pg-border2)", padding: "28px 18px", textAlign: "center" }}>
                  <span style={{ ...FS, fontSize: "14px", lineHeight: 1.6, color: "var(--pg-mut2)" }}>No pending detected activity.<br />Use reset mock inbox to reload examples.</span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
              <div style={{ border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px" }}><span style={{ ...FM, fontSize: "20px", fontWeight: 800, color: "var(--pg-ink)" }}>{opportunities.length}</span><br /><span style={{ ...FM, fontSize: "8px", letterSpacing: "0.12em", color: "var(--pg-mut)" }}>OPPORTUNITIES</span></div>
              <div style={{ border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px" }}><span style={{ ...FM, fontSize: "20px", fontWeight: 800, color: "var(--pg-ink)" }}>{incomeEvents.length}</span><br /><span style={{ ...FM, fontSize: "8px", letterSpacing: "0.12em", color: "var(--pg-mut)" }}>INCOME EVENTS</span></div>
              <div style={{ border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px" }}><span style={{ ...FM, fontSize: "20px", fontWeight: 800, color: "var(--pg-ink)" }}>{followUps.length}</span><br /><span style={{ ...FM, fontSize: "8px", letterSpacing: "0.12em", color: "var(--pg-mut)" }}>FOLLOW UPS</span></div>
            </div>
          </div>
        )}

        {/* ── LIST SCREEN ────────────────────────────────────────────────── */}
        {screen === "list" && (
          <div className="pg-scroll" style={isDesktop ? { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: rightSidebarCollapsed ? "minmax(0, 1fr)" : "minmax(0, 1.55fr) minmax(320px, 0.95fr)", alignContent: "start", gap: "18px", width: "100%", maxWidth: rightSidebarCollapsed ? "1120px" : "1280px", margin: "0 auto", padding: "58px clamp(24px, 4vw, 44px) 28px", transition: "max-width 160ms ease" } : { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "28px", padding: "24px" }}>

            {/* PROJECTED INCOME */}
            <div style={isDesktop ? { gridColumn: "1", gridRow: rightSidebarCollapsed ? undefined : "1 / span 3", display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } : { display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>PROJECTED INCOME</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {([
                    { label: "YEARLY",    value: annual       },
                    { label: "MONTHLY",   value: annual / 12  },
                    { label: "BI-WEEKLY", value: annual / 26  },
                    { label: "WEEKLY",    value: annual / 52  },
                  ] as const).map(({ label, value }) => (
                    <div key={label} style={{ background: "var(--pg-panel)", border: "1px solid var(--pg-border)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ ...FM, fontWeight: 800, fontSize: label === "YEARLY" ? "26px" : "20px", color: label === "YEARLY" ? "var(--pg-ink)" : "var(--pg-accent)", fontVariantNumeric: "tabular-nums" }}>${fmt(value)}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.14em", color: "var(--pg-mut)" }}>{label}</span>
                    </div>
                  ))}
                </div>
                <span style={{ ...FS, fontSize: "12px", color: "var(--pg-mut2)" }}>
                  {allSources.length === 0 ? "connect or add a source below" : "$" + fmt(workAnnual) + " work · $" + fmt(passiveAnnual) + " passive"}
                </span>
              </div>

              {/* DAILY ACTIONS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "14px" }}>
                <span style={{ ...FM, fontSize: "17px", fontWeight: 800, letterSpacing: "0.01em", color: "var(--pg-ink)" }}>DAILY ACTIONS</span>
                <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                  The small resistance action you do today, every day. Tap it to start the clock.
                </p>
                <div style={{ display: "flex", border: "1px solid var(--pg-border2)" }}>
                  <input value={draftDaily} onChange={e => setDraftDaily(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addDailyTask(); }}
                    placeholder="Add a daily action (e.g. deliver a meal on uber)"
                    style={{ flex: 1, minWidth: 0, background: "var(--pg-card2)", border: "none", color: "var(--pg-ink)", ...FS, fontSize: "15px", padding: "14px 16px" }} />
                  <button onClick={addDailyTask}
                    style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", padding: "0 20px", cursor: "pointer" }}>
                    ADD
                  </button>
                </div>
                {dailyTasks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {dailyTasks.map(t => {
                      const doneToday = (t.completedDates || []).includes(today);
                      return (
                      <div key={t.id} style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--pg-border)", background: "var(--pg-card)" }}>
                        <button onClick={() => toggleDailyDone(t.id)} aria-pressed={doneToday} aria-label={doneToday ? "Mark " + t.text + " not done today" : "Mark " + t.text + " done today"}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", flexShrink: 0, background: "none", border: "none", borderRight: "1px solid var(--pg-border)", cursor: "pointer" }}>
                          <span style={{ width: "17px", height: "17px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid " + (doneToday ? "var(--pg-done)" : "var(--pg-border2)"), background: doneToday ? "var(--pg-done)" : "transparent", ...FM, fontSize: "11px", fontWeight: 800, color: "var(--pg-on-accent)" }}>{doneToday ? "✓" : ""}</span>
                        </button>
                        <button onClick={() => openCountdown(t.id)}
                          style={{ flex: 1, display: "flex", alignItems: "center", gap: "14px", background: "none", border: "none", textAlign: "left", padding: "16px", cursor: "pointer", minWidth: 0 }}>
                          <span style={{ ...FS, fontSize: "15px", color: doneToday ? "var(--pg-mut2)" : "var(--pg-ink)", textDecoration: doneToday ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                          <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.1em", color: doneToday ? "var(--pg-done)" : "var(--pg-mut2)", border: "1px solid var(--pg-border2)", padding: "2px 5px", flexShrink: 0 }}>{labelFor(ACTIVITY_CATEGORIES, t.category).toUpperCase()}</span>
                          <span style={{ marginLeft: "auto", ...FM, fontSize: "10px", letterSpacing: "0.12em", color: doneToday ? "var(--pg-done)" : "var(--pg-mut)", flexShrink: 0 }}>{doneToday ? "DONE TODAY" : "START"}</span>
                        </button>
                        <button onClick={e => { e.stopPropagation(); removeTask(t.id); }}
                          style={{ background: "none", border: "none", borderLeft: "1px solid var(--pg-border)", color: "var(--pg-mut2)", fontSize: "16px", width: "44px", cursor: "pointer", flexShrink: 0 }}>×</button>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", border: "1px dashed var(--pg-border2)" }}>
                    <span style={{ ...FS, fontSize: "14px", color: "var(--pg-mut2)", textAlign: "center", lineHeight: 1.6 }}>No daily actions yet.<br />Add one above.</span>
                  </div>
                )}
              </div>

              {/* UPCOMING ACTIONS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "14px" }}>
                <span style={{ ...FM, fontSize: "17px", fontWeight: 800, letterSpacing: "0.01em", color: "var(--pg-ink)" }}>UPCOMING ACTIONS</span>
                <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                  Interviews, meetings, anything on the calendar that could turn into income.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input value={draftUpcoming} onChange={e => setDraftUpcoming(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addUpcomingTask(); }}
                    placeholder="Add an upcoming action (e.g. interview with Acme Corp)"
                    style={{ background: "var(--pg-card2)", border: "1px solid var(--pg-border2)", color: "var(--pg-ink)", ...FS, fontSize: "15px", padding: "14px 16px" }} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input type="date" value={draftUpcomingDate} onChange={e => setDraftUpcomingDate(e.target.value)}
                      style={{ flex: 1, minWidth: 0, background: "var(--pg-card2)", border: "1px solid var(--pg-border2)", color: "var(--pg-ink)", ...FM, fontSize: "13px", padding: "12px 10px" }} />
                    <input type="time" value={draftUpcomingTime} onChange={e => setDraftUpcomingTime(e.target.value)}
                      style={{ flex: 1, minWidth: 0, background: "var(--pg-card2)", border: "1px solid var(--pg-border2)", color: "var(--pg-ink)", ...FM, fontSize: "13px", padding: "12px 10px" }} />
                    <button onClick={addUpcomingTask}
                      style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", padding: "0 20px", cursor: "pointer", flexShrink: 0 }}>
                      ADD
                    </button>
                  </div>
                </div>
                {upcomingTasks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {upcomingTasks.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--pg-border)", background: "var(--pg-card)" }}>
                        <button onClick={() => toggleUpcomingDone(t.id)} aria-pressed={t.done} aria-label={t.done ? "Mark " + t.text + " not done" : "Mark " + t.text + " done"}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44px", flexShrink: 0, background: "none", border: "none", borderRight: "1px solid var(--pg-border)", cursor: "pointer" }}>
                          <span style={{ width: "17px", height: "17px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid " + (t.done ? "var(--pg-done)" : "var(--pg-border2)"), background: t.done ? "var(--pg-done)" : "transparent", ...FM, fontSize: "11px", fontWeight: 800, color: "var(--pg-on-accent)" }}>{t.done ? "✓" : ""}</span>
                        </button>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", padding: "12px 16px", minWidth: 0 }}>
                          <span style={{ ...FS, fontSize: "15px", color: t.done ? "var(--pg-mut2)" : "var(--pg-ink)", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                          {t.scheduledAt && (
                            <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.1em", color: t.done ? "var(--pg-mut2)" : "var(--pg-accent)" }}>{formatScheduled(t.scheduledAt)}</span>
                          )}
                        </div>
                        <button onClick={() => removeTask(t.id)}
                          style={{ background: "none", border: "none", borderLeft: "1px solid var(--pg-border)", color: "var(--pg-mut2)", fontSize: "16px", width: "44px", cursor: "pointer", flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", border: "1px dashed var(--pg-border2)" }}>
                    <span style={{ ...FS, fontSize: "14px", color: "var(--pg-mut2)", textAlign: "center", lineHeight: 1.6 }}>No upcoming actions yet.<br />Add an interview or meeting above.</span>
                  </div>
                )}
              </div>

              {/* Source rows */}
              {allSources.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>INCOME</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {allSources.map(x => {
                    const isInvest = x.kind === "invest";
                    const badge      = x.synced ? "SYNCED" : (isInvest ? (x.instrument === "Recurring" ? "PASSIVE" : (BADGE_MAP[x.instrument || "CD"] || "INV")) : (x.payType || "W2"));
                    const badgeColor = x.synced ? "var(--pg-ok)" : (isInvest ? "var(--pg-info)" : "var(--pg-mut)");
                    const badgeBorder= x.synced ? "var(--pg-ok-border)" : (isInvest ? "var(--pg-info-border)" : "var(--pg-border2)");
                    const detail     = sourceDetail(x);
                    const rate       = sourceRate(x);
                    return (
                      <div key={x.id} style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--pg-border)", background: "var(--pg-card)" }}>
                        <button onClick={() => { setProjId(x.id); setScreen("projection"); }}
                          style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "13px 16px", minWidth: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ ...FS, fontWeight: 600, fontSize: "15px", color: "var(--pg-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
                            <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.1em", color: badgeColor, border: "1px solid " + badgeBorder, padding: "2px 5px", flexShrink: 0 }}>{badge}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span style={{ ...FM, fontSize: "11px", color: "var(--pg-mut)" }}>{detail}</span>
                            <span style={{ ...FM, fontWeight: 700, fontSize: "12px", color: "var(--pg-accent)" }}>{rate}</span>
                            <span style={{ marginLeft: "auto", ...FM, fontSize: "9px", letterSpacing: "0.1em", color: "var(--pg-mut2)" }}>PROJECT ›</span>
                          </div>
                        </button>
                        <button onClick={() => x.synced ? disconnectPlaidItem(plaidItemIdFromSourceId(x.id)) : removeSource(x.id)}
                          style={{ background: "none", border: "none", borderLeft: "1px solid var(--pg-border)", color: "var(--pg-mut2)", fontSize: "16px", width: "42px", cursor: "pointer", flexShrink: 0 }}>×</button>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

            </div>

            <div style={isDesktop ? { display: rightSidebarCollapsed ? "none" : "flex", gridColumn: "2", gridRow: "1", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: addIncomeExpanded ? "14px" : "0", flexDirection: "column", gap: addIncomeExpanded ? "12px" : "0", alignSelf: "start" } : { border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: addIncomeExpanded ? "14px" : "0", display: "flex", flexDirection: "column", gap: addIncomeExpanded ? "12px" : "0" }}>
              {!addIncomeExpanded && (
                <button onClick={() => setAddIncomeExpanded(true)}
                  style={{ width: "100%", background: "none", border: "none", color: "var(--pg-accent)", ...FM, fontWeight: 800, fontSize: "10px", letterSpacing: "0.14em", padding: "16px 14px", cursor: "pointer", textAlign: "left" }}>
                  + ADD INCOME
                </button>
              )}
              {addIncomeExpanded && (
              <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>ADD INCOME</span>
                <button onClick={() => setAddIncomeExpanded(false)} aria-label="Collapse add income" title="Collapse add income"
                  style={{ background: "none", border: "none", color: "var(--pg-mut2)", ...FM, fontSize: "16px", lineHeight: 1, cursor: "pointer", padding: "4px" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setSrcType("work")} style={seg(srcType === "work")}>WORK</button>
                <button onClick={() => setSrcType("invest")} style={seg(srcType === "invest")}>INVESTMENT</button>
              </div>
              <input value={srcName} onChange={e => setSrcName(e.target.value)} placeholder={namePH}
                style={{ ...inputBase, ...FS }} />
              {srcType === "work" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setSrcPayType("W2")} style={seg(srcPayType === "W2")}>W-2</button>
                    <button onClick={() => setSrcPayType("1099")} style={seg(srcPayType === "1099")}>1099</button>
                  </div>
                  {srcPayType === "W2" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => setSrcW2PayMode("hourly")} style={seg(srcW2PayMode === "hourly")}>HOURLY</button>
                        <button onClick={() => setSrcW2PayMode("salary")} style={seg(srcW2PayMode === "salary")}>SALARY</button>
                      </div>
                      {srcW2PayMode === "hourly" && (
                        <div style={{ display: "flex", gap: "10px" }}>
                          <input value={srcPay} onChange={e => setSrcPay(e.target.value)} inputMode="decimal" placeholder="$ / hour"
                            style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                          <input value={srcHours} onChange={e => setSrcHours(e.target.value)} inputMode="decimal" placeholder="hrs / week"
                            style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                        </div>
                      )}
                      {srcW2PayMode === "salary" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <input value={srcPay} onChange={e => setSrcPay(e.target.value)} inputMode="decimal" placeholder="$ salary"
                            style={{ ...inputBase, ...FM }} />
                          <div style={{ display: "flex", gap: "8px" }}>
                            {PAY_PERIODS.map(period => (
                              <button key={period.id} onClick={() => setSrcPayPeriod(period.id)} style={seg(srcPayPeriod === period.id)}>{period.label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {srcPayType === "1099" && (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input value={srcPay} onChange={e => setSrcPay(e.target.value)} inputMode="decimal" placeholder="$ / week"
                        style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                      <input value={srcHours} onChange={e => setSrcHours(e.target.value)} inputMode="decimal" placeholder="hrs / week"
                        style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                    </div>
                  )}
                </div>
              )}
              {srcType === "invest" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => setSrcInstrument("CD")} style={seg(srcInstrument === "CD")}>CD</button>
                    <button onClick={() => setSrcInstrument("Dividend")} style={seg(srcInstrument === "Dividend")}>DIVIDEND</button>
                    <button onClick={() => setSrcInstrument("Interest")} style={seg(srcInstrument === "Interest")}>INTEREST</button>
                    <button onClick={() => setSrcInstrument("Recurring")} style={seg(srcInstrument === "Recurring")}>RECURRING</button>
                  </div>
                  {srcInstrument === "Recurring" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.12em", color: "var(--pg-mut)" }}>Passive recurring</span>
                      <input value={srcValue} onChange={e => setSrcValue(e.target.value)} inputMode="decimal" placeholder="$ recurring amount"
                        style={{ ...inputBase, ...FM }} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        {PASSIVE_FREQUENCIES.map(freq => (
                          <button key={freq.id} onClick={() => setSrcPassiveFrequency(freq.id)} style={seg(srcPassiveFrequency === freq.id)}>{freq.label}</button>
                        ))}
                      </div>
                      <span style={{ ...FM, fontSize: "8px", letterSpacing: "0.08em", color: "var(--pg-mut2)" }}>weekly × 52 · biweekly × 26 · monthly × 12 · annual × 1</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input value={srcValue} onChange={e => setSrcValue(e.target.value)} inputMode="decimal" placeholder="$ total value"
                        style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                      <input value={srcRate} onChange={e => setSrcRate(e.target.value)} inputMode="decimal" placeholder={srcInstrument === "CD" ? "APY %" : "% / yr"}
                        style={{ ...inputBase, ...FM, flex: 1, minWidth: 0 }} />
                    </div>
                  )}
                </div>
              )}
              <button onClick={addSource}
                style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", padding: "13px", cursor: "pointer" }}>
                ADD INCOME
              </button>
              </>
              )}
            </div>

            <div style={isDesktop ? { display: "none" } : { height: "1px", background: "var(--pg-border)" }} />

            {/* GOALS */}
            <div style={isDesktop ? { gridColumn: "2", display: rightSidebarCollapsed ? "none" : "flex", flexDirection: "column", gap: "14px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "14px", alignSelf: "start" } : { display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...FM, fontSize: "17px", fontWeight: 800, letterSpacing: "0.01em", color: "var(--pg-ink)" }}>GOALS</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ ...FM, fontWeight: 800, fontSize: "16px", color: "var(--pg-accent)", fontVariantNumeric: "tabular-nums" }}>{computeStreak()}</span>
                  <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.14em", color: "var(--pg-mut)" }}>DAY STREAK</span>
                </div>
              </div>
              <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                One concrete action that leads to income. One delivery. One application. Tap it to start the clock.
              </p>
              <div style={{ display: "flex", border: "1px solid var(--pg-border2)" }}>
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(); }}
                  placeholder="Add a goal (e.g. one job application)"
                  style={{ flex: 1, minWidth: 0, background: "var(--pg-card2)", border: "none", color: "var(--pg-ink)", ...FS, fontSize: "15px", padding: "14px 16px" }} />
                <button onClick={addTask}
                  style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", padding: "0 20px", cursor: "pointer" }}>
                  ADD
                </button>
              </div>
              {goalTasks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {goalTasks.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--pg-border)", background: "var(--pg-card)" }}>
                      <button onClick={() => openCountdown(t.id)}
                        style={{ flex: 1, display: "flex", alignItems: "center", gap: "14px", background: "none", border: "none", textAlign: "left", padding: "16px", cursor: "pointer", minWidth: 0 }}>
                        <span style={{ width: "8px", height: "8px", flexShrink: 0, background: t.done ? "var(--pg-done)" : "var(--pg-accent)" }} />
                        <span style={{ ...FS, fontSize: "15px", color: t.done ? "var(--pg-mut2)" : "var(--pg-ink)", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                        <span style={{ marginLeft: "auto", ...FM, fontSize: "10px", letterSpacing: "0.12em", color: t.done ? "var(--pg-done)" : "var(--pg-mut)", flexShrink: 0 }}>{t.done ? "DONE" : "START"}</span>
                      </button>
                      <button onClick={e => { e.stopPropagation(); removeTask(t.id); }}
                        style={{ background: "none", border: "none", borderLeft: "1px solid var(--pg-border)", color: "var(--pg-mut2)", fontSize: "16px", width: "44px", cursor: "pointer", flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px", border: "1px dashed var(--pg-border2)" }}>
                  <span style={{ ...FS, fontSize: "14px", color: "var(--pg-mut2)", textAlign: "center", lineHeight: 1.6 }}>No goals yet.<br />Add one above and get in the game.</span>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── PROJECTION SCREEN ──────────────────────────────────────────── */}
        {screen === "projection" && proj && (() => {
          const isInv     = proj.kind === "invest";
          const badge       = proj.synced ? "SYNCED" : (isInv ? (proj.instrument === "Recurring" ? "PASSIVE" : (BADGE_MAP[proj.instrument || "CD"] || "INV")) : (proj.payType || "W2"));
          const badgeColor  = proj.synced ? "var(--pg-ok)" : (isInv ? "var(--pg-info)" : "var(--pg-mut)");
          const badgeBorder = proj.synced ? "var(--pg-ok-border)" : (isInv ? "var(--pg-info-border)" : "var(--pg-border2)");

          let heroLabel = "", heroValue = "0", heroSub = "", title = "", note = "";
          let rows: { label: string; value: string; gain: string; pct: string }[] = [];

          if (isInv && proj.instrument === "Recurring") {
            const ann = sourceAnnual(proj);
            heroLabel = "CURRENT ANNUAL PASSIVE INCOME";
            heroValue = fmt(ann);
            heroSub   = "Passive · " + sourceDetail(proj) + " · " + sourceRate(proj);
            title     = "PROJECTED PASSIVE INCOME";
            const vals = HORIZONS.map(y => ann * y);
            const max  = vals[vals.length - 1] || 1;
            rows = HORIZONS.map((y, i) => ({
              label: y + (y === 1 ? " YEAR" : " YEARS"),
              value: "$" + fmt(vals[i]),
              gain:  "",
              pct:   (vals[i] / max * 100) + "%",
            }));
            note = "Fixed recurring passive income held steady. Use this for annuities, pensions, royalties, rental income, stipends, and similar payments.";
          } else if (isInv) {
            heroLabel = "CURRENT BALANCE";
            heroValue = fmt(proj.principal || 0);
            heroSub   = proj.rate === undefined
              ? "enter rate for projection"
              : proj.rate.toFixed(2) + "% annual " + (proj.instrument === "CD" ? "APY" : "yield");
            title     = "PROJECTED GROWTH";
            const vals = HORIZONS.map(y => (proj.principal || 0) * Math.pow(1 + (proj.rate || 0) / 100, y));
            const max  = vals[vals.length - 1] || 1;
            rows = HORIZONS.map((y, i) => ({
              label: y + (y === 1 ? " YEAR" : " YEARS"),
              value: "$" + fmt(vals[i]),
              gain:  "+$" + fmt(vals[i] - (proj.principal || 0)),
              pct:   (vals[i] / max * 100) + "%",
            }));
            note = "Compounded annually at the current rate, assuming you reinvest. CDs lock the rate for the term; dividend and interest rates can move.";
          } else {
            const ann   = sourceAnnual(proj);
            heroLabel   = "CURRENT ANNUAL EARNINGS";
            heroValue   = fmt(ann);
            heroSub     = sourceDetail(proj) + " · " + sourceRate(proj);
            title       = "PROJECTED EARNINGS";
            const vals  = HORIZONS.map(y => ann * y);
            const max   = vals[vals.length - 1] || 1;
            rows = HORIZONS.map((y, i) => ({
              label: y + (y === 1 ? " YEAR" : " YEARS"),
              value: "$" + fmt(vals[i]),
              gain:  "",
              pct:   (vals[i] / max * 100) + "%",
            }));
            const isGig = proj.synced || proj.payType === "1099" || proj.payType === "GIG";
            note = "Gross, pre-tax, at your current rate held steady. The fastest way to bend this curve up is raising the rate — a better-paying " + (isGig ? "gig" : "role") + " or more hours.";
          }
          return (
            <div className="pg-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px" }}>
              <button onClick={() => { setScreen("list"); setProjId(null); }}
                style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--pg-mut)", ...FM, fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>← BACK</button>

              <div style={{ marginTop: "26px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: badgeColor, border: "1px solid " + badgeBorder, padding: "3px 6px" }}>{badge}</span>
                <span style={{ ...FS, fontWeight: 700, fontSize: "19px", color: "var(--pg-ink)" }}>{proj.name}</span>
              </div>

              <div style={{ marginTop: "18px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.2em", color: "var(--pg-mut)" }}>{heroLabel}</span>
                <div style={{ display: "flex", alignItems: "baseline" }}>
                  <span style={{ ...FM, fontWeight: 500, fontSize: "22px", color: "var(--pg-mut)" }}>$</span>
                  <span style={{ ...FM, fontWeight: 800, fontSize: "46px", lineHeight: "0.9", color: "var(--pg-accent)", fontVariantNumeric: "tabular-nums" }}>{heroValue}</span>
                </div>
                <span style={{ ...FS, fontSize: "12px", color: "var(--pg-mut2)" }}>{heroSub}</span>
              </div>

              {isInv && proj.synced && (
                <div style={{ marginTop: "16px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.2em", color: "var(--pg-mut)" }}>ANNUAL RATE</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input value={syncedRateDrafts[proj.id] ?? (proj.rate ?? "")} onChange={e => updateSyncedInvestRate(proj.id, e.target.value)}
                        inputMode="decimal" placeholder="0.00"
                        style={{ ...inputBase, ...FM, width: "90px" }} />
                      <span style={{ ...FM, fontSize: "13px", color: "var(--pg-mut)" }}>%</span>
                    </div>
                    {proj.rate === undefined && (
                      <span style={{ ...FS, fontSize: "11px", color: "var(--pg-mut2)" }}>Plaid doesn&apos;t report this rate — enter it for an accurate projection.</span>
                    )}
                  </div>
                </div>
              )}

              <span style={{ marginTop: "28px", ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>{title}</span>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column" }}>
                {rows.map(r => (
                  <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: "9px", padding: "15px 0", borderBottom: "1px solid var(--pg-border)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ ...FM, fontSize: "11px", letterSpacing: "0.12em", color: "var(--pg-ink2)" }}>{r.label}</span>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                        <span style={{ ...FM, fontWeight: 800, fontSize: "16px", color: "var(--pg-ink)", fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
                        {r.gain && <span style={{ ...FM, fontSize: "11px", color: "var(--pg-ok)", minWidth: "64px", textAlign: "right" }}>{r.gain}</span>}
                      </div>
                    </div>
                    <div style={{ height: "6px", background: "var(--pg-border)" }}>
                      <div style={{ height: "100%", background: "var(--pg-accent)", width: r.pct }} />
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ margin: "22px 0 0", ...FS, fontSize: "12px", lineHeight: 1.6, color: "var(--pg-mut2)" }}>{note}</p>
            </div>
          );
        })()}

        {/* ── COUNTDOWN SCREEN ───────────────────────────────────────────── */}
        {screen === "countdown" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", background: "var(--pg-bg)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <span style={{ width: "9px", height: "9px", background: "var(--pg-accent)", animation: "pg-blink 1s steps(1) infinite" }} />
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.2em", color: "var(--pg-accent)" }}>PRE-GAME LIVE</span>
              </div>
              <button onClick={standDown}
                style={{ background: "none", border: "none", color: "var(--pg-mut2)", ...FM, fontSize: "10px", letterSpacing: "0.14em", cursor: "pointer" }}>
                STAND DOWN
              </button>
            </div>

            <div style={{ marginTop: "28px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>YOUR MOVE</div>
              <div style={{ marginTop: "10px", ...FS, fontWeight: 600, fontSize: "20px", color: "var(--pg-ink)" }}>{activeTask?.text || ""}</div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px" }}>
              {phase === "running" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "22px", width: "100%" }}>
                  <div style={{ ...FM, fontWeight: 800, fontSize: "150px", lineHeight: "0.8", letterSpacing: "-0.02em", color: low ? "var(--pg-accent-hot)" : "var(--pg-accent)", fontVariantNumeric: "tabular-nums" }}>
                    {String(seconds).padStart(2, "0")}
                  </div>
                  <div style={{ width: "100%", maxWidth: "340px", height: "4px", background: "var(--pg-border)" }}>
                    <div style={{ height: "100%", background: "var(--pg-accent)", width: (seconds / 60 * 100) + "%", transition: "width 1s linear" }} />
                  </div>
                  <div style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>SECONDS · STAND UP · MOVE</div>
                </div>
              )}
              {phase === "finished" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
                  <div style={{ ...FM, fontWeight: 800, fontSize: "64px", color: "var(--pg-accent)", letterSpacing: "0.04em" }}>GO</div>
                  <div style={{ ...FS, fontSize: "14px", color: "var(--pg-mut)" }}>time&apos;s up. you&apos;re already standing.</div>
                </div>
              )}
            </div>

            <p style={{ ...FS, fontSize: "15px", lineHeight: 1.65, color: "var(--pg-ink2)", textAlign: "center", margin: "0 0 22px", maxWidth: "380px", alignSelf: "center", flexShrink: 0 }}>
              This is the anxiety talking, not new information. Stand up. Grab keys. Walk to the door.
            </p>

            {phase === "running" && (
              <a href={smsHref} style={{ display: "block", textAlign: "center", textDecoration: "none", background: "none", border: "1px solid var(--pg-accent)", color: "var(--pg-accent)", ...FM, fontWeight: 700, fontSize: "14px", letterSpacing: "0.1em", padding: "18px", cursor: "pointer", flexShrink: 0 }}>
                SEND THE PING
              </a>
            )}
            {phase === "finished" && (
              <button onClick={imMoving}
                style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 800, fontSize: "18px", letterSpacing: "0.08em", padding: "24px", cursor: "pointer", animation: "pg-pulse 1.4s ease-in-out infinite", flexShrink: 0 }}>
                I&apos;M MOVING
              </button>
            )}
          </div>
        )}

        {/* ── CLASSIFICATION SCREEN ──────────────────────────────────────── */}
        {screen === "classify" && pendingActivity && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", background: "var(--pg-bg)", overflowY: "auto" }}>
            <button onClick={() => { setPendingActivityId(null); setScreen("history"); }}
              style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--pg-mut)", ...FM, fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>SKIP FOR NOW</button>

            <div style={{ marginTop: "44px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-accent)" }}>ACTIVITY SAVED</span>
              <h1 style={{ margin: 0, ...FS, fontSize: "28px", lineHeight: 1.08, color: "var(--pg-ink)" }}>Did this move income forward?</h1>
              <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.6, color: "var(--pg-mut)" }}>
                Logged permanently: <span style={{ color: "var(--pg-ink)" }}>{pendingActivity.title}</span>. Be honest. Momentum only works when the record is real.
              </p>
            </div>

            <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {MOMENTUM_CLASSES.map(option => (
                <button key={option.id} onClick={() => classifyActivity(option.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textAlign: "left", background: option.helpsIncome ? "var(--pg-card2)" : "var(--pg-panel)", border: "1px solid " + (option.helpsIncome ? "var(--pg-ok-border)" : "var(--pg-border2)"), color: "var(--pg-ink)", padding: "16px", cursor: "pointer" }}>
                  <span style={{ ...FS, fontWeight: 700, fontSize: "15px" }}>{option.label}</span>
                  <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.12em", color: option.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut2)" }}>{option.helpsIncome ? "MOMENTUM" : "HONEST LOG"}</span>
                </button>
              ))}
            </div>

            <p style={{ margin: "auto 0 0", paddingTop: "28px", ...FS, fontSize: "12px", lineHeight: 1.6, color: "var(--pg-mut2)" }}>
              Every action should create momentum, evidence, opportunity, or income. If it did not, this board still records it without pretending it helped.
            </p>
          </div>
        )}

        {/* ── MOMENTUM / HISTORY SCREEN ──────────────────────────────────── */}
        {screen === "history" && (
          <div className="pg-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px", padding: "24px" }}>
            <button onClick={() => setScreen("list")}
              style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--pg-mut)", ...FM, fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>← BACK</button>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-accent)" }}>ACTION HISTORY</span>
              <h1 style={{ margin: 0, ...FS, fontSize: "27px", lineHeight: 1.08, color: "var(--pg-ink)" }}>Are the actions compounding?</h1>
              <p style={{ margin: 0, ...FS, fontSize: "13px", lineHeight: 1.55, color: "var(--pg-mut2)" }}>
                Persistent history from completed Pre-Game tasks. Daily action resets do not erase this record.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)" }}>
              {[
                { label: "TOTAL LOGGED", value: activities.length },
                { label: "THIS WEEK", value: weeklyIncomeGrowth },
                { label: "CURRENT STREAK", value: computeStreak() },
                { label: "LONGEST STREAK", value: longestActivityStreak() },
              ].map((stat, i) => (
                <div key={stat.label} style={{ padding: "16px", borderRight: i % 2 === 0 ? "1px solid var(--pg-border)" : undefined, borderBottom: i < 2 ? "1px solid var(--pg-border)" : undefined }}>
                  <div style={{ ...FM, fontWeight: 800, fontSize: "30px", color: i === 1 ? "var(--pg-accent)" : "var(--pg-ink)", fontVariantNumeric: "tabular-nums" }}>{stat.value}</div>
                  <div style={{ marginTop: "5px", ...FM, fontSize: "9px", letterSpacing: "0.14em", color: "var(--pg-mut)" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>LAST 30 DAYS</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(30, 1fr)", gap: "3px", alignItems: "end", height: "82px", border: "1px solid var(--pg-border2)", background: "var(--pg-panel)", padding: "10px" }}>
                {dayCounts.map(d => (
                  <div key={d.date} title={d.date + ": " + d.count + " activities"}
                    style={{ height: Math.max(6, d.count / maxDayCount * 58) + "px", background: d.count > 0 ? (d.date === today ? "var(--pg-accent)" : "#b86418") : "var(--pg-border2)", opacity: d.count > 0 ? 1 : 0.55 }} />
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "18px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>INCOME MOMENTUM</span>
                {MOMENTUM_CLASSES.map(item => {
                  const count = momentumCounts[item.id] || 0;
                  const pct = activities.length ? count / activities.length * 100 : 0;
                  return (
                    <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                        <span style={{ ...FS, fontSize: "13px", color: "var(--pg-ink2)" }}>{item.label}</span>
                        <span style={{ ...FM, fontSize: "12px", color: item.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut)" }}>{count}</span>
                      </div>
                      <div style={{ height: "5px", background: "var(--pg-border)" }}><div style={{ height: "100%", width: pct + "%", background: item.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut2)" }} /></div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>CATEGORY BREAKDOWN</span>
                {[...ACTIVITY_CATEGORIES, { id: "uncategorized" as ActivityCategory, label: "Uncategorized" }].map(cat => {
                  const count = categoryCounts[cat.id] || 0;
                  if (count === 0 && cat.id !== "uncategorized") return null;
                  return (
                    <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "11px 13px" }}>
                      <span style={{ ...FS, fontSize: "13px", color: "var(--pg-ink2)" }}>{cat.label}</span>
                      <span style={{ ...FM, fontWeight: 800, fontSize: "14px", color: "var(--pg-ink)" }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>ACTIVITY HISTORY</span>
              {sortedActivities.length > 0 ? sortedActivities.map(activity => {
                const meta = momentumMeta(activity.momentum);
                return (
                  <div key={activity.id} style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "8px", height: "8px", background: meta.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut2)", flexShrink: 0 }} />
                      <span style={{ ...FS, fontWeight: 700, fontSize: "15px", color: "var(--pg-ink)", flex: 1 }}>{activity.title}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "3px 6px" }}>{activity.dateCompleted}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: "var(--pg-mut)", border: "1px solid var(--pg-border2)", padding: "3px 6px" }}>{labelFor(ACTIVITY_CATEGORIES, activity.category).toUpperCase()}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: meta.helpsIncome ? "var(--pg-accent)" : "var(--pg-mut)", border: "1px solid " + (meta.helpsIncome ? "var(--pg-ok-border)" : "var(--pg-border2)"), padding: "3px 6px" }}>{meta.short.toUpperCase()}</span>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ border: "1px dashed var(--pg-border2)", padding: "28px 18px", textAlign: "center" }}>
                  <span style={{ ...FS, fontSize: "14px", lineHeight: 1.6, color: "var(--pg-mut2)" }}>No permanent activities yet.<br />Complete a Pre-Game task to start the ledger.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS SCREEN ────────────────────────────────────────────── */}
        {screen === "settings" && (
          <div className="pg-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px" }}>
            <button onClick={() => setScreen("list")}
              style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--pg-mut)", ...FM, fontSize: "11px", letterSpacing: "0.14em", cursor: "pointer", padding: 0 }}>← BACK</button>

            <div style={{ marginTop: "28px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>SETTINGS</span>
            </div>

            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>SYNC CODE</span>
                <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: syncStatus === "saved" ? "var(--pg-ok)" : syncStatus === "error" ? "var(--pg-danger)" : syncStatus === "saving" ? "var(--pg-accent)" : "var(--pg-mut2)" }}>
                  {syncStatus === "saved" ? "● SYNCED" : syncStatus === "error" ? "● ERROR" : syncStatus === "saving" ? "● SAVING" : "● IDLE"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--pg-border2)" }}>
                <span style={{ ...FM, fontWeight: 800, fontSize: "16px", letterSpacing: "0.14em", color: "var(--pg-accent)", padding: "13px 16px", flex: 1, background: "var(--pg-card2)" }}>{syncId || "—"}</span>
                <button onClick={() => { if (syncId) navigator.clipboard.writeText(syncId); }}
                  style={{ background: "none", border: "none", borderLeft: "1px solid var(--pg-border2)", color: "var(--pg-mut)", ...FM, fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", padding: "0 14px", cursor: "pointer", flexShrink: 0 }}>COPY</button>
              </div>
              {syncQrDataUrl && (
                <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "auto minmax(0, 1fr)" : "1fr", gap: "14px", alignItems: "center", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "14px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={syncQrDataUrl} alt={"QR code for sync code " + syncId}
                    style={{ width: "148px", height: "148px", background: "#fff", padding: "8px", justifySelf: isDesktop ? "start" : "center" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ ...FS, fontWeight: 700, fontSize: "14px", color: "var(--pg-ink)" }}>Scan to sync this device</span>
                    <span style={{ ...FS, fontSize: "12px", color: "var(--pg-mut2)", lineHeight: 1.5 }}>Open the camera on another phone and scan this QR. It opens Pre-Game with this sync code ready to load.</span>
                    <button onClick={() => {
                      if (!syncId) return;
                      const shareUrl = new URL(window.location.href);
                      shareUrl.searchParams.set("sync", syncId);
                      navigator.clipboard.writeText(shareUrl.toString());
                    }}
                      style={{ alignSelf: "flex-start", background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-mut)", ...FM, fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", padding: "8px 10px", cursor: "pointer" }}>COPY QR LINK</button>
                  </div>
                </div>
              )}
              <p style={{ margin: 0, ...FS, fontSize: "12px", color: "var(--pg-mut2)", lineHeight: 1.5 }}>
                On this device, scan the QR shown on another device to pull its data here.
              </p>
              {!scannerOpen ? (
                <button onClick={() => { void openScanner(); }}
                  style={{ alignSelf: "flex-start", background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "10px 14px", cursor: "pointer" }}>
                  SCAN QR CODE
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", border: "1px solid var(--pg-border2)", background: "var(--pg-card2)", padding: "10px" }}>
                  {scannerError ? (
                    <span style={{ ...FS, fontSize: "13px", color: "var(--pg-danger)", lineHeight: 1.5 }}>{scannerError}</span>
                  ) : (
                    <video ref={scanVideoRef} playsInline muted
                      style={{ width: "100%", maxWidth: "260px", aspectRatio: "1 / 1", objectFit: "cover", background: "#000" }} />
                  )}
                  <button onClick={stopScanner}
                    style={{ alignSelf: "flex-start", background: "none", border: "1px solid var(--pg-border2)", color: "var(--pg-mut)", ...FM, fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", padding: "8px 10px", cursor: "pointer" }}>
                    CANCEL
                  </button>
                </div>
              )}
              <p style={{ margin: 0, ...FS, fontSize: "12px", color: "var(--pg-mut2)", lineHeight: 1.5 }}>
                Or paste the sync code below to see the same data everywhere.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={syncCodeInput} onChange={e => setSyncCodeInput(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  style={{ ...inputBase, ...FM, flex: 1, fontSize: "14px", letterSpacing: "0.1em" }} />
                <button onClick={() => { void handleLoadSyncCode(); }}
                  style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "0 16px", cursor: "pointer", flexShrink: 0 }}>LOAD</button>
              </div>
            </div>

            <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>PLAID BANK LINK</span>
                <button onClick={() => { void connectPlaid(); }} disabled={plaidStatus === "loading" || plaidStatus === "opening"}
                  style={{ background: "var(--pg-accent)", border: "1px solid var(--pg-accent)", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "8px 12px", cursor: plaidStatus === "loading" || plaidStatus === "opening" ? "wait" : "pointer", flexShrink: 0 }}>
                  {plaidStatus === "loading" ? "LOADING" : plaidStatus === "opening" ? "OPENING" : "+ ADD BANK"}
                </button>
              </div>

              {plaidError && (
                <div style={{ border: "1px solid var(--pg-danger-border)", background: "#1a1412", color: "var(--pg-danger)", ...FS, fontSize: "12px", lineHeight: 1.45, padding: "10px" }}>
                  {plaidError}
                </div>
              )}

              {plaidItems.length === 0 && (
                <span style={{ ...FS, fontSize: "12px", color: "var(--pg-mut2)" }}>No banks connected yet. Secure Plaid Link opens in a hosted flow.</span>
              )}

              {plaidItems.map(item => (
                <div key={item.itemId} style={{ border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "34px", height: "34px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#102337", ...FM, fontWeight: 800, fontSize: "13px", color: "var(--pg-info)" }}>P</div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ ...FS, fontWeight: 600, fontSize: "14px", color: "var(--pg-ink)" }}>{item.institutionName}</span>
                      <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.06em", color: "var(--pg-ok)" }}>{item.accounts.length} accounts imported</span>
                    </div>
                    <button onClick={() => { void disconnectPlaidItem(item.itemId); }} aria-label={"Disconnect " + item.institutionName}
                      style={{ background: "none", border: "none", color: "var(--pg-mut2)", fontSize: "16px", width: "24px", cursor: "pointer", flexShrink: 0 }}>×</button>
                  </div>

                  {item.accounts.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {item.accounts.map(account => (
                        <div key={account.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "8px", border: "1px solid var(--pg-border2)", background: "var(--pg-panel)", padding: "10px" }}>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: "3px" }}>
                            <span style={{ ...FS, fontWeight: 600, fontSize: "13px", color: "var(--pg-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</span>
                            <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.08em", color: "var(--pg-mut)" }}>{[account.subtype || account.type, account.mask ? "••" + account.mask : ""].filter(Boolean).join(" · ").toUpperCase()}</span>
                          </div>
                          <span style={{ ...FM, fontWeight: 800, fontSize: "13px", color: "var(--pg-accent)", fontVariantNumeric: "tabular-nums" }}>
                            {account.current === null ? "—" : "$" + fmt(account.current)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {plaidItems.length > 0 && (
                <span style={{ ...FS, fontSize: "11px", lineHeight: 1.5, color: "var(--pg-mut2)" }}>
                  Plaid tokens stay server-side during Link and are not written to localStorage. Pre-Game stores only account names, masks, types, and balance snapshots for dashboard context.
                </span>
              )}
            </div>

            <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>APPEARANCE</span>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["ember", "forest"] as Theme[]).map(t => (
                  <button key={t} onClick={() => chooseTheme(t)}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", cursor: "pointer", textAlign: "left",
                      background: theme === t ? "var(--pg-card2)" : "var(--pg-panel)",
                      border: "1px solid " + (theme === t ? "var(--pg-accent)" : "var(--pg-border2)") }}>
                    <span style={{ width: "14px", height: "14px", flexShrink: 0, background: t === "ember" ? "#ff8a1c" : "#34c98a" }} />
                    <span style={{ ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", color: theme === t ? "var(--pg-ink)" : "var(--pg-mut)" }}>{t.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.22em", color: "var(--pg-mut)" }}>PLATFORMS TRACKED</span>
                <span style={{ ...FM, fontSize: "10px", letterSpacing: "0.1em", color: "var(--pg-mut2)" }}>{connectedCount} LINKED</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {platforms.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", border: "1px solid var(--pg-border)", background: "var(--pg-card)", padding: "12px 14px" }}>
                    <div style={{ width: "34px", height: "34px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--pg-card2)", ...FM, fontWeight: 800, fontSize: "14px", color: "var(--pg-ink)" }}>{p.name.trim().charAt(0).toUpperCase() || "?"}</div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                      <span style={{ ...FS, fontWeight: 600, fontSize: "14px", color: "var(--pg-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ ...FM, fontSize: "9px", letterSpacing: "0.1em", color: "var(--pg-mut2)" }}>NOT SYNCED · MANUAL</span>
                    </div>
                    <button onClick={() => removePlatform(p.id)}
                      aria-label={"Remove " + p.name}
                      style={{ background: "none", border: "none", color: "var(--pg-mut2)", fontSize: "16px", width: "24px", cursor: "pointer", flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={platformDraft} onChange={e => setPlatformDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addPlatform(); }}
                  placeholder="Platform name (e.g. Uber, Fiverr, Indeed)"
                  style={{ ...inputBase, ...FM, flex: 1, minWidth: 0, fontSize: "13px" }} />
                <button onClick={addPlatform}
                  style={{ background: "var(--pg-accent)", border: "none", color: "var(--pg-on-accent)", ...FM, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", padding: "0 16px", cursor: "pointer", flexShrink: 0 }}>+ ADD PLATFORM</button>
              </div>
              <span style={{ ...FS, fontSize: "11px", lineHeight: 1.5, color: "var(--pg-mut2)" }}>
                This is just a list of platforms you&apos;re working — no accounts are linked and no data is pulled automatically.
              </span>
            </div>

            <div style={{ height: "32px" }} />

            <button onClick={resetAll}
              style={{ background: "none", border: "1px solid var(--pg-danger-border)", color: "var(--pg-danger)", ...FM, fontWeight: 700, fontSize: "12px", letterSpacing: "0.1em", padding: "16px", cursor: "pointer", marginTop: "auto" }}>
              RESET ALL DATA
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

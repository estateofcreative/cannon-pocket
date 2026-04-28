import { useState, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import {
  Home, DollarSign, Calendar, Bell, FileText, Info,
  Store, User, Shield, Menu, X, Moon, Sun, ExternalLink,
  MapPin, Clock, ChevronRight, Plus, Trash2, Edit2,
  AlertTriangle, CheckCircle, Search, Filter, Download,
  Send, Phone, Globe, Tag, Loader2, RefreshCw, Flag, CheckSquare
} from "lucide-react";
import type {
  Meeting, Alert, Document, Business, Subscriber,
  MeetingBody, AlertLabel, InsertMeeting, InsertAlert
} from "../../shared/schema";
import { BODY_LABELS } from "../../shared/schema";

// ── Theme ──────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark(d => !d) };
}

// ── Body pill ─────────────────────────────────────────────────
function BodyPill({ body }: { body: MeetingBody }) {
  const cls: Record<MeetingBody, string> = {
    county_commission: "pill-commission",
    budget_committee:  "pill-budget",
    school_board:      "pill-school",
    planning_commission: "pill-planning",
    other:             "pill-other",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls[body]}`}>
      {BODY_LABELS[body]}
    </span>
  );
}

// ── Alert badge ───────────────────────────────────────────────
function AlertBadge({ label }: { label: AlertLabel }) {
  const cfg: Record<AlertLabel, { cls: string; text: string }> = {
    fyi:           { cls: "badge-fyi",          text: "FYI" },
    important:     { cls: "badge-important",    text: "Important" },
    upcoming_vote: { cls: "badge-upcoming-vote",text: "Upcoming Vote" },
    action_needed: { cls: "badge-action-needed",text: "Action Needed" },
  };
  const c = cfg[label];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${c.cls}`}>
      {c.text}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded ${className}`} />;
}

// ── Format meeting time ───────────────────────────────────────
function fmtTime(t: string) {
  try {
    return format(new Date(`2000-01-01T${t}`), "h:mm a");
  } catch { return t; }
}

function fmtDate(d: string) {
  try {
    const dt = parseISO(d);
    if (isToday(dt)) return "Today";
    if (isTomorrow(dt)) return "Tomorrow";
    return format(dt, "EEE, MMM d");
  } catch { return d; }
}

// Shorten org names and strip prefixes in document titles
function cleanDocTitle(title: string): string {
  // Replace long org name with abbreviation first
  let t = title
    .replace(/the\s+cannon\s+county\s+board\s+of\s+education/gi, "CCBOE")
    .replace(/cannon\s+county\s+board\s+of\s+education/gi, "CCBOE")
    .replace(/cannon\s+county\s+commission/gi, "CC Commission")
    .replace(/cannon\s+county\s+planning\s+commission/gi, "CC Planning")
    .replace(/cannon\s+county\s+budget\s+committee/gi, "CC Budget Committee");
  // Strip leading "CCBOE —" style prefix if it's just the org name followed by a dash
  const stripped = t.replace(/^(CCBOE|CC\s+\w[^—–-]*)(\s*(—|–|-)\s*)/i, "").trim();
  return stripped.length > 4 ? stripped : t;
}

// ══════════════════════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════════════════════

// ── SHARED MEETING CARD (with I'm Going) ─────────────────────
function MeetingCard({ meeting: m }: { meeting: Meeting }) {
  const storageKey = `going-${m.id}`;
  const [going, setGoing] = useState(() => localStorage.getItem(storageKey) === "1");
  // Stable base count derived from numeric part of id
  const idNum = typeof m.id === "number" ? m.id : parseInt(String(m.id).replace(/\D/g, ""), 10) || 7;
  const baseCount = (idNum % 17) + 3;
  const count = baseCount + (going ? 1 : 0);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !going;
    setGoing(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  };

  const linkUrl = m.agenda_url || m.source_url || null;
  const linkLabel = m.agenda_url ? "Agenda" : "Source";

  return (
    <div className="flex gap-3 items-start p-4 rounded-xl border bg-card mb-2">
      <div className="flex-shrink-0 w-12 text-center rounded-lg py-1" style={{ background: "var(--color-forest)", color: "white" }}>
        <div className="text-xl font-bold leading-none">{format(parseISO(m.meeting_date), "d")}</div>
        <div className="text-xs uppercase opacity-80">{format(parseISO(m.meeting_date), "MMM")}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{m.title}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock size={11}/> {fmtTime(m.meeting_time)} · {m.location.split(",")[0]}
        </p>
        <div className="mt-1.5"><BodyPill body={m.body}/></div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {linkUrl && (
            <a href={linkUrl} target="_blank" rel="noreferrer"
              className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline">
              <ExternalLink size={11}/> {linkLabel}
            </a>
          )}
          <button onClick={toggle}
            className={`ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
              going
                ? "border-transparent text-white"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            }`}
            style={going ? { background: "var(--color-forest)" } : {}}>
            <CheckSquare size={11}/> {going ? "Going" : "I'm Going"} · {count}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SHARED ALERT CARD (clickable) ─────────────────────────────
function AlertCard({ alert: a }: { alert: Alert }) {
  const inner = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <AlertBadge label={a.label}/>
        {a.is_breaking && <span className="badge-breaking text-xs px-2 py-0.5 rounded font-semibold">Breaking</span>}
        {a.source_url && <ExternalLink size={11} className="ml-auto text-muted-foreground"/>}
      </div>
      <p className="text-sm font-semibold">{a.title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.summary}</p>
    </>
  );

  if (a.source_url) {
    return (
      <a href={a.source_url} target="_blank" rel="noreferrer"
        className="block p-4 rounded-xl border bg-card mb-2 hover:border-primary/50 transition-colors group cursor-pointer">
        {inner}
      </a>
    );
  }
  return <div className="p-4 rounded-xl border bg-card mb-2">{inner}</div>;
}

// ── DUMP HOURS POPUP ──────────────────────────────────────────
function getDumpStatus(): { open: boolean; message: string; note?: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const hour = now.getHours() + now.getMinutes() / 60;

  // Federal holidays (MM-DD) — approximate for CDT
  const mmdd = `${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const holidays = ["01-01","07-04","11-11","12-25","12-24"];
  const isHoliday = holidays.includes(mmdd);
  // Memorial Day = last Monday of May, Labor Day = first Monday of Sept
  const isMemorialDay = now.getMonth() === 4 && day === 1 && now.getDate() > 24;
  const isLaborDay    = now.getMonth() === 8 && day === 1 && now.getDate() <= 7;

  if (isHoliday || isMemorialDay || isLaborDay) {
    const names: Record<string, string> = {
      "01-01": "New Year's Day", "07-04": "Independence Day",
      "11-11": "Veterans Day",   "12-25": "Christmas", "12-24": "Christmas Eve",
    };
    const holidayName = isMemorialDay ? "Memorial Day" : isLaborDay ? "Labor Day" : (names[mmdd] ?? "a holiday");
    return { open: false, message: `The Dump is CLOSED today`, note: `Closed for ${holidayName}` };
  }
  if (day === 0 || day === 3) { // Sunday or Wednesday
    return { open: false, message: `The Dump is CLOSED today`, note: day === 3 ? "Closed every Wednesday" : "Closed every Sunday" };
  }
  // Open days: Mon, Tue, Thu, Fri, Sat — 8am to 5pm
  const isOpen = hour >= 8 && hour < 17;
  if (isOpen) {
    return { open: true, message: `The Dump is OPEN today until 5:00 PM` };
  }
  if (hour < 8) {
    return { open: false, message: `The Dump opens at 8:00 AM`, note: "Opens Mon, Tue, Thu, Fri & Sat" };
  }
  return { open: false, message: `The Dump is CLOSED for today`, note: "Closed after 5:00 PM" };
}

function DumpHoursPopup({ onClose }: { onClose: () => void }) {
  const status = getDumpStatus();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: status.open ? "var(--color-forest)" : "var(--color-brick)" }}>
            <Info size={20} color="white"/>
          </div>
          <div>
            <p className="font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>
              {status.message}
            </p>
            {status.note && <p className="text-xs text-muted-foreground mt-0.5">{status.note}</p>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p className="font-semibold text-foreground text-sm mb-1">Main Convenience Center Hours</p>
          <p>Mon, Tue, Thu, Fri, Sat — 8:00 AM to 5:00 PM</p>
          <p>Wednesday, Sunday &amp; Holidays — <span className="font-semibold">CLOSED</span></p>
          <a href="https://cannoncountytn.gov/cannon-county-convenience-center/" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 mt-2 text-primary font-semibold hover:underline">
            <ExternalLink size={11}/> Dump Details
          </a>
        </div>
        <button onClick={onClose}
          className="mt-4 w-full py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
          Close
        </button>
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────────
function HomeScreen({ onNav, onDump }: { onNav: (s: string) => void; onDump: () => void }) {
  const { data: meetings, isLoading: mldr } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: alerts, isLoading: aldr }   = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });
  const { data: subCount } = useQuery<{ count: number }>({ queryKey: ["/api/subscribers/count"] });

  const breaking = alerts?.filter(a => a.is_breaking) ?? [];
  const next = meetings?.[0];

  return (
    <div className="screen-enter space-y-6 pb-8">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: "var(--color-forest)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)"
        }} />
        <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Cannon County, Tennessee</p>
        <h1 className="text-3xl mb-1" style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
          Cannon County, in your pocket.
        </h1>
        <p className="text-sm opacity-70 mb-4 max-w-sm">
          Meetings, alerts, documents, and local businesses — all in one place, plain and simple.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Is the Dump Open?", action: "dump",                                  icon: <Info size={14}/> },
            { label: "Next Meetings",     screen: "meetings",                              icon: <Calendar size={14}/> },
            { label: "Find a Doc",        screen: "documents",                             icon: <FileText size={14}/> },
            { label: "FY2026 Budget",     href: "https://cannoncountytn.gov/budget/",     icon: <DollarSign size={14}/> },
          ].map(b => (
            b.href
              ? <a key={b.label} href={b.href} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/30 bg-white/10 hover:bg-white/20 transition-colors">
                  {b.icon}{b.label}
                </a>
              : b.action === "dump"
              ? <button key={b.label} onClick={onDump}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/30 bg-white/10 hover:bg-white/20 transition-colors">
                  {b.icon}{b.label}
                </button>
              : <button key={b.screen} onClick={() => onNav(b.screen!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/30 bg-white/10 hover:bg-white/20 transition-colors">
                  {b.icon}{b.label}
                </button>
          ))}
        </div>
      </div>

      {/* Breaking alert */}
      {breaking.length > 0 && (
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-0.5">Breaking Alert</p>
              <p className="text-sm font-semibold text-foreground">{breaking[0].title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{breaking[0].summary.slice(0, 100)}…</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { val: "$45.4M", label: "FY25–26 Budget", sub: "Approved Oct 2025", color: "var(--color-forest)" },
          { val: next ? fmtDate(next.meeting_date) : (mldr ? "—" : "None"), label: "Next Meeting", sub: next?.title.split("—")[0].trim() ?? "", color: "var(--color-bronze)" },
          { val: String(alerts?.filter(a=>a.label==="action_needed").length ?? 0), label: "Action Items", sub: "Needs attention", color: "var(--color-brick)" },
          { val: String(subCount?.count ?? 0), label: "Subscribers", sub: "Civic alert list", color: "var(--color-forest)" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            {mldr || aldr ? (
              <><Skeleton className="h-7 w-24 mb-2"/><Skeleton className="h-3 w-20"/></>
            ) : (
              <>
                <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: "var(--font-display)", color: k.color }}>{k.val}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{k.sub}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Upcoming meetings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Upcoming Meetings</h2>
          <button onClick={() => onNav("meetings")} className="text-xs text-primary font-semibold flex items-center gap-1">
            See all <ChevronRight size={14}/>
          </button>
        </div>
        {mldr ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full"/>)}</div>
        ) : meetings?.slice(0, 3).map(m => (
          <MeetingCard key={m.id} meeting={m} />
        ))}
      </div>

      {/* Recent alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Recent Alerts</h2>
          <button onClick={() => onNav("alerts")} className="text-xs text-primary font-semibold flex items-center gap-1">
            See all <ChevronRight size={14}/>
          </button>
        </div>
        {aldr ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full"/>)}</div>
        ) : alerts?.slice(0, 3).map(a => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>
    </div>
  );
}

// ── MEETINGS ──────────────────────────────────────────────────
function MeetingsScreen() {
  const [filter, setFilter] = useState<"all" | MeetingBody>("all");
  const [showPast, setShowPast] = useState(false);

  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: showPast ? ["/api/meetings/all"] : ["/api/meetings"],
  });

  const filtered = filter === "all" ? meetings : meetings?.filter(m => m.body === filter);

  const filters: { key: "all" | MeetingBody; label: string }[] = [
    { key: "all", label: "All" },
    { key: "county_commission", label: "Commission" },
    { key: "budget_committee", label: "Budget" },
    { key: "school_board", label: "School Board" },
    { key: "planning_commission", label: "Planning" },
  ];

  return (
    <div className="screen-enter space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Meetings Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Public meetings for all Cannon County governing bodies. Agendas posted 72 hours before each meeting.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full"/>)}</div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar size={32} className="mx-auto mb-3 opacity-40"/>
          <p className="text-sm">No upcoming meetings found.</p>
        </div>
      ) : filtered?.map(m => (
        <div key={m.id} data-testid={`meeting-${m.id}`} className="rounded-xl border bg-card p-4">
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-14 text-center rounded-xl py-2" style={{ background: "var(--color-forest)", color: "white" }}>
              <div className="text-2xl font-bold leading-none">{format(parseISO(m.meeting_date), "d")}</div>
              <div className="text-xs uppercase opacity-80 mt-0.5">{format(parseISO(m.meeting_date), "MMM")}</div>
              <div className="text-xs opacity-60">{format(parseISO(m.meeting_date), "yyyy")}</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base mb-1">{m.title}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1">
                <Clock size={13}/> {fmtTime(m.meeting_time)} CDT
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                <MapPin size={13}/> {m.location}
              </p>
              <div className="mb-2"><BodyPill body={m.body}/></div>
              {m.notes && <p className="text-xs text-muted-foreground italic">{m.notes}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {m.agenda_url && (
                  <a href={m.agenda_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                    <FileText size={12}/> Agenda
                  </a>
                )}
                {m.directions_url && (
                  <a href={m.directions_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                    <MapPin size={12}/> Directions
                  </a>
                )}
                {(m.livestream_url || m.body === "county_commission" || m.body === "school_board") && (
                  <a href={
                    m.livestream_url ||
                    (m.body === "school_board" ? "https://www.youtube.com/@ccboeschoolvideo4892/featured" : "https://www.youtube.com/@ccgovvideo")
                  } target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                    <ExternalLink size={12}/> {m.livestream_url ? "Watch Live" : "Watch on YouTube"}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ── PAST MEETINGS ARCHIVE ── */}
      <div className="mt-2">
        <button onClick={() => setShowPast(p => !p)}
          className="w-full text-center text-xs text-muted-foreground py-3 border border-dashed rounded-xl hover:border-primary hover:text-primary transition-colors">
          {showPast ? "Hide past meetings" : "View past meeting archive"}
        </button>
      </div>

      {showPast && (() => {
        const today = new Date().toISOString().split("T")[0];
        const past = meetings?.filter(m => m.meeting_date < today) ?? [];
        const grouped: Record<string, typeof past> = {};
        past.forEach(m => {
          const yr = m.meeting_date.slice(0, 4);
          if (!grouped[yr]) grouped[yr] = [];
          grouped[yr].push(m);
        });
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Past Meetings</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Agendas, minutes, and recordings from previous meetings.</p>
            </div>
            {Object.keys(grouped).sort((a,b) => Number(b)-Number(a)).map(yr => (
              <div key={yr}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{yr}</p>
                <div className="space-y-3">
                  {grouped[yr].sort((a,b) => b.meeting_date.localeCompare(a.meeting_date)).map(m => (
                    <div key={m.id} className="rounded-xl border bg-card p-4">
                      <div className="flex gap-3 items-start">
                        <div className="flex-shrink-0 w-12 text-center rounded-lg py-1.5" style={{ background: "var(--color-forest)", color: "white" }}>
                          <div className="text-lg font-bold leading-none">{format(parseISO(m.meeting_date), "d")}</div>
                          <div className="text-xs uppercase opacity-80">{format(parseISO(m.meeting_date), "MMM")}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{m.title}</p>
                          <p className="text-xs text-muted-foreground mb-2">{format(parseISO(m.meeting_date), "MMMM d, yyyy")}</p>
                          <BodyPill body={m.body}/>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {m.agenda_url && (
                              <a href={m.agenda_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                                <FileText size={11}/> Agenda
                              </a>
                            )}
                            {m.notes && m.notes.includes("minutes") && (
                              <a href={m.notes} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                                <FileText size={11}/> Minutes
                              </a>
                            )}
                            {m.livestream_url && (
                              <a href={m.livestream_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:border-brick hover:text-brick transition-colors"
                                style={{ "--color-brick": "var(--color-brick)" } as any}>
                                <ExternalLink size={11}/> Recording
                              </a>
                            )}
                            {!m.agenda_url && !m.livestream_url && (
                              <span className="text-xs text-muted-foreground italic">No documents available</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {past.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No past meetings in the archive yet.</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────────
function AlertsScreen() {
  const [filter, setFilter] = useState<"all" | AlertLabel>("all");
  const { data: alerts, isLoading } = useQuery<Alert[]>({ queryKey: ["/api/alerts"] });

  const filtered = filter === "all" ? alerts : alerts?.filter(a => a.label === filter);

  const filters: { key: "all" | AlertLabel; label: string }[] = [
    { key: "all",           label: "All" },
    { key: "action_needed", label: "Action Needed" },
    { key: "upcoming_vote", label: "Upcoming Vote" },
    { key: "important",     label: "Important" },
    { key: "fyi",           label: "FYI" },
  ];

  return (
    <div className="screen-enter space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Civic Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Important motions, votes, and county actions — explained in plain English.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full"/>)}</div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-3 opacity-40"/>
          <p className="text-sm">No alerts in this category.</p>
        </div>
      ) : filtered?.map(a => (
        <div key={a.id} data-testid={`alert-${a.id}`}
          className={`rounded-xl border bg-card p-4 ${a.is_breaking ? "border-red-400 dark:border-red-600" : ""}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertBadge label={a.label}/>
            {a.is_breaking && <span className="badge-breaking text-xs px-2 py-0.5 rounded font-semibold">Breaking</span>}
            <BodyPill body={a.body}/>
          </div>
          <p className="font-semibold text-sm mb-1">{a.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{a.summary}</p>
          {a.source_url && (
            <a href={a.source_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary font-semibold mt-2 hover:underline">
              Source <ExternalLink size={11}/>
            </a>
          )}
          <p className="text-xs text-muted-foreground mt-2">{format(parseISO(a.created_at), "MMM d, yyyy")}</p>
        </div>
      ))}
    </div>
  );
}

// ── DOCUMENTS ─────────────────────────────────────────────────
function DocumentsScreen() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const { data: docs, isLoading } = useQuery<Document[]>({ queryKey: ["/api/documents"] });

  const filtered = docs?.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.category === catFilter;
    return matchSearch && matchCat;
  });

  const cats = ["all", "agenda", "minutes", "budget", "recording", "resolution"];

  return (
    <div className="screen-enter space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Documents Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">Budgets, agendas, minutes, and official records — all in one place.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-colors ${
              catFilter === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}>
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full"/>)}</div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-3 opacity-40"/>
          <p className="text-sm">No documents found.</p>
        </div>
      ) : filtered?.map(d => (
        <a key={d.id} href={d.document_url} target="_blank" rel="noreferrer"
          data-testid={`doc-${d.id}`}
          className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors group">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--color-cream-deep)" }}>
            <FileText size={18} style={{ color: "var(--color-forest)" }}/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{cleanDocTitle(d.title)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <BodyPill body={d.body}/>
              <span className="text-xs text-muted-foreground capitalize">{d.category}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{format(parseISO(d.document_date), "MMM d, yyyy")}</span>
            </div>
          </div>
          <ExternalLink size={14} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors"/>
        </a>
      ))}
    </div>
  );
}

// ── COUNTY INFO ───────────────────────────────────────────────
function CountyScreen({ scrollTo }: { scrollTo?: "corruption" }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const corruptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollTo === "corruption" && corruptionRef.current) {
      setTimeout(() => {
        corruptionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [scrollTo]);

  const conveniences = [
    { name: "Main Convenience Center", address: "1165 McMinnville Hwy, Woodbury, TN", hours: "Mon–Tue & Thu–Sat 8:00 AM – 5:00 PM · Wed, Sun & Federal Holidays CLOSED", phone: "(615) 563-5693" },
    { name: "Liberty Convenience Center", address: "Liberty Community, Cannon County, TN", hours: "Sat–Sun 7:00 AM – 5:00 PM · Wed & Holidays CLOSED" },
  ];

  const contacts = [
    { name: "County Mayor's Office", phone: "(615) 563-4231", address: "200 W. Main St., Woodbury, TN 37190" },
    { name: "County Clerk", phone: "(615) 563-4278", address: "200 W. Main St., Woodbury, TN 37190" },
    { name: "Property Assessor", phone: "(615) 563-2009", address: "200 W. Main St., Woodbury, TN 37190" },
    { name: "Trustee (Property Tax)", phone: "(615) 563-4986", address: "200 W. Main St., Woodbury, TN 37190" },
    { name: "Road Department", phone: "(615) 563-5693", address: "1165 McMinnville Hwy, Woodbury, TN" },
    { name: "Schools (CCSTN)", phone: "(615) 563-5752", address: "301 W. Main St., Woodbury, TN 37190" },
  ];

  const faqs = [
    { q: "When is property tax due?", a: "Cannon County property taxes are due by February 28 each year without penalty. Payments can be made at the Trustee's office at 200 W. Main St., Woodbury, or online at cannoncountytn.gov." },
    { q: "How do I get a copy of a deed or property record?", a: "Deed and property records are maintained by the County Register of Deeds at 200 W. Main St., Woodbury. Call (615) 563-4257. Many older records are also available online through the Tennessee Secretary of State." },
    { q: "Where do I vote in Cannon County?", a: "Cannon County has a single voting location for most elections: the Cannon County Complex at 301 Lehman St., Woodbury. Check the Cannon County Election Commission at (615) 563-4277 for current precinct assignments." },
    { q: "How do I renew my vehicle registration?", a: "Visit the County Clerk's office at 200 W. Main St., Woodbury, or renew online at tnvehicleregistration.com. You'll need your current registration, proof of insurance, and payment." },
    { q: "What can I take to the convenience centers?", a: "Household garbage, recycling (cardboard, paper, plastics #1–#7, glass, cans), used motor oil, and tires (limit 4). Hazardous waste, construction debris, and large appliances require special disposal — call the Road Department." },
    { q: "How do I attend a public meeting?", a: "All County Commission, Budget Committee, School Board, and Planning Commission meetings are open to the public. Agendas are posted 72 hours in advance on cannoncountytn.gov. Public comment is generally allowed at the beginning of each meeting." },
  ];

  return (
    <div className="screen-enter space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>County Info</h1>
        <p className="text-sm text-muted-foreground mt-1">Services, contacts, and practical information for Cannon County residents.</p>
      </div>

      {/* Convenience Centers */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-display)" }}>Convenience Centers / Dump Sites</h2>
        {conveniences.map((c, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 mb-3">
            <p className="font-semibold text-sm mb-1">{c.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><MapPin size={11}/>{c.address}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Clock size={11}/>{c.hours}</p>
            {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={11}/>{c.phone}</p>}
          </div>
        ))}
      </div>

      {/* Contacts */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-display)" }}>County Contacts</h2>
        <div className="grid gap-2">
          {contacts.map((c, i) => (
            <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-card">
              <div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.address}</p>
              </div>
              <a href={`tel:${c.phone}`} className="text-xs font-semibold text-primary flex-shrink-0 flex items-center gap-1 mt-0.5">
                <Phone size={12}/>{c.phone}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-bold mb-3" style={{ fontFamily: "var(--font-display)" }}>Frequently Asked Questions</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors">
                <span className="text-sm font-semibold pr-2">{f.q}</span>
                <ChevronRight size={16} className={`flex-shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-90" : ""}`}/>
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Report Corruption */}
      <div ref={corruptionRef} className="rounded-xl border-2 p-5 space-y-3" style={{ borderColor: "var(--color-brick)", background: "hsl(var(--card))" }}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--color-brick)", color: "white" }}>
            <AlertTriangle size={18}/>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Report Corruption or Misconduct</p>
            <p className="text-xs text-muted-foreground mt-1">
              If you witness or suspect fraud, waste, abuse, or misconduct by a Cannon County official or employee, you have multiple ways to report it — including anonymously.
            </p>
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <a href="https://patriotpunknetwork.com" target="_blank" rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border-2 bg-background transition-colors group"
            style={{ borderColor: "var(--color-bronze)" }}>
            <div>
              <p className="text-sm font-semibold">Patriot Punk Network — TN Journalists</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Report corruption to the Patriot Punk Network via{" "}
                <span className="underline" style={{ color: "var(--color-bronze)" }}>tips@patriotpunknetwork.com</span>
              </p>
              <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--color-bronze)" }}>Confidential citizen tip line</p>
            </div>
            <ExternalLink size={14} className="flex-shrink-0" style={{ color: "var(--color-bronze)" }}/>
          </a>
          <a href="https://www.tn.gov/comptroller/section/hotline.html" target="_blank" rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-brick/60 transition-colors group">
            <div>
              <p className="text-sm font-semibold">TN Comptroller Hotline</p>
              <p className="text-xs text-muted-foreground">Anonymous fraud reporting — state-level investigation</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground flex-shrink-0"/>
          </a>
          <a href="tel:18004774557"
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-brick/60 transition-colors group">
            <div>
              <p className="text-sm font-semibold">TN Comptroller: 1-800-477-4557</p>
              <p className="text-xs text-muted-foreground">Toll-free anonymous hotline, Mon–Fri 8am–4:30pm CT</p>
            </div>
            <Phone size={14} className="text-muted-foreground flex-shrink-0"/>
          </a>
          <a href="https://www.fbi.gov/contact-us" target="_blank" rel="noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-brick/60 transition-colors group">
            <div>
              <p className="text-sm font-semibold">FBI — Public Corruption</p>
              <p className="text-xs text-muted-foreground">Federal reporting for serious criminal misconduct</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground flex-shrink-0"/>
          </a>
          <a href="mailto:info@cannoncountytn.gov"
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:border-brick/60 transition-colors group">
            <div>
              <p className="text-sm font-semibold">County Administrator</p>
              <p className="text-xs text-muted-foreground">info@cannoncountytn.gov — for non-criminal concerns</p>
            </div>
            <ExternalLink size={14} className="text-muted-foreground flex-shrink-0"/>
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          All reports to the TN Comptroller Hotline are confidential. You are never required to give your name.
        </p>
      </div>

      {/* Official links */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Official Links</p>
        <div className="space-y-2">
          {[
            { label: "Cannon County Official Site", url: "https://www.cannoncountytn.gov" },
            { label: "Cannon County Schools (CCSTN)", url: "https://www.ccstn.net" },
            { label: "Inmate Lookup — Cannon County Jail", url: "https://www.vinelink.com/vinelink/siteInfoAction.do?siteId=43001" },
            { label: "TN Property Tax Lookup", url: "https://assessment.cot.tn.gov" },
            { label: "Vehicle Registration Renewal", url: "https://tnvehicleregistration.com" },
          ].map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Globe size={13}/>{l.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DIRECTORY ─────────────────────────────────────────────────
const TIER_PRICING = {
  free: {
    in: 0, out: 0, label: "Free",
    desc: "Basic listing — name, category, phone & address",
    features: [
      "Business name & category",
      "Phone number",
      "Physical address",
      "Listed alphabetically within category",
    ],
  },
  enhanced: {
    in: 29, out: 39, label: "Enhanced",
    desc: "Full details, deals banner, website & priority placement",
    features: [
      "Everything in Free",
      "Short business description",
      "Website URL",
      "Business hours",
      "Deals & offers banner",
      "Social media links",
      "Listed above Free tier",
    ],
  },
  featured: {
    in: 59, out: 69, label: "Featured",
    desc: "Top placement, bold card, logo & homepage spotlight",
    features: [
      "Everything in Enhanced",
      "Business logo or photo",
      "Pinned to top of category",
      "Bold Featured card styling",
      "Homepage Shop Local spotlight",
      "Extended description (300 chars)",
      "Owner highlight badge (e.g. Women-Owned, Veteran-Owned)",
    ],
  },
} as const;

type ListingTier = keyof typeof TIER_PRICING;

function GetListedModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"tier" | "info" | "done">("tier");
  const [tier, setTier] = useState<ListingTier>("free");
  const [inCounty, setInCounty] = useState(true);
  const [form, setForm] = useState({
    name: "", category: "retail", description: "",
    address: "", phone: "", website_url: "", hours: "", offer: "",
    contact_name: "", contact_email: "", contact_phone: "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const pricing = TIER_PRICING[tier];
  const price = inCounty ? pricing.in : pricing.out;

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/businesses/apply", {
        ...form, tier, is_in_county: inCounty,
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json();
    },
    onSuccess: () => setStep("done"),
    onError: () => toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" }),
  });

  const inputCls = "w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  const cats = ["retail","food","services","health","automotive","entertainment","real estate","other"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-card z-10">
          <div>
            <p className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {step === "tier" ? "Choose Your Listing Tier" : step === "info" ? "Business Information" : "Application Received"}
            </p>
            {step !== "done" && (
              <p className="text-xs text-muted-foreground mt-0.5">Step {step === "tier" ? "1" : "2"} of 2</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── STEP 1: Tier ── */}
          {step === "tier" && (
            <>
              {/* In/Out county toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Is your business located in Cannon County?</p>
                  <p className="text-xs text-muted-foreground">In-county businesses get a discounted rate.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={inCounty}
                  onClick={() => setInCounty(p => !p)}
                  className="relative flex-shrink-0 focus:outline-none"
                  style={{ width: 44, height: 26 }}>
                  <span
                    className="block w-full h-full rounded-full transition-colors duration-200"
                    style={{ background: inCounty ? "var(--color-forest)" : "#cbd5e1" }}/>
                  <span
                    className="block absolute top-1 rounded-full bg-white shadow transition-all duration-200"
                    style={{ width: 18, height: 18, left: inCounty ? 22 : 4 }}/>
                </button>
              </div>

              {/* Tier cards */}
              <div className="space-y-3">
                {(Object.entries(TIER_PRICING) as [ListingTier, typeof TIER_PRICING[ListingTier]][]).map(([key, p]) => (
                  <button key={key} onClick={() => setTier(key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      tier === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{p.label}</span>
                          {key === "featured" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">Most Visible</span>
                          )}
                          {key === "enhanced" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">Popular</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {key === "free" ? (
                          <span className="text-lg font-bold">Free</span>
                        ) : (
                          <>
                            <span className="text-lg font-bold">${inCounty ? p.in : p.out}</span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                          </>
                        )}
                        {key !== "free" && (
                          <p className="text-xs text-muted-foreground">{inCounty ? "in-county" : "standard"}</p>
                        )}
                      </div>
                    </div>
                    {tier === key && (
                      <div className="mt-2 pt-2 border-t border-primary/20 space-y-1">
                        {p.features.map((f, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <CheckCircle size={11} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-forest)" }}/>
                            {f}
                          </p>
                        ))}
                        {key !== "free" && (
                          <p className="text-xs text-muted-foreground pt-1 border-t border-primary/10">Billed monthly — cancel anytime.</p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button onClick={() => setStep("info")}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--color-forest)" }}>
                Continue →
              </button>
            </>
          )}

          {/* ── STEP 2: Business Info ── */}
          {step === "info" && (
            <>
              {/* Tier summary */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-sm">
                <span className="font-semibold">{TIER_PRICING[tier].label} listing</span>
                <span className="text-muted-foreground">
                  {tier === "free" ? "Free" : `$${price}/mo · ${inCounty ? "in-county rate" : "standard rate"}`}
                </span>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business Details</p>
              <div className="space-y-3">
                <input placeholder="Business name *" value={form.name} onChange={e => set("name", e.target.value)} className={inputCls}/>
                <select value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>
                  {cats.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                </select>
                <textarea placeholder="Short description of your business" value={form.description}
                  onChange={e => set("description", e.target.value)} rows={2} className={inputCls}/>
                <input placeholder="Address" value={form.address} onChange={e => set("address", e.target.value)} className={inputCls}/>
                <input placeholder="Phone number" value={form.phone} onChange={e => set("phone", e.target.value)} className={inputCls}/>
                <input placeholder="Website URL (optional)" value={form.website_url} onChange={e => set("website_url", e.target.value)} className={inputCls}/>
                <input placeholder="Business hours (e.g. Mon–Sat 9am–5pm)" value={form.hours} onChange={e => set("hours", e.target.value)} className={inputCls}/>
                {tier !== "free" && (
                  <input placeholder="Special offer or deal (optional — appears as a banner)" value={form.offer}
                    onChange={e => set("offer", e.target.value)} className={inputCls}/>
                )}
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Your Contact Info</p>
              <p className="text-xs text-muted-foreground -mt-2">Not displayed publicly — used to follow up on your application.</p>
              <div className="space-y-3">
                <input placeholder="Your name *" value={form.contact_name} onChange={e => set("contact_name", e.target.value)} className={inputCls}/>
                <input placeholder="Your email *" type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} className={inputCls}/>
                <input placeholder="Your phone (optional)" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} className={inputCls}/>
              </div>

              {tier !== "free" && (
                <div className="rounded-lg p-3 border text-xs text-muted-foreground" style={{ borderColor: "var(--color-bronze)" }}>
                  <p className="font-semibold text-foreground mb-1">Payment note</p>
                  After reviewing your application, we’ll reach out to ${price}/mo billing. Listings go live once payment is confirmed. Cancel anytime by contacting us.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep("tier")}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border hover:bg-muted transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => submit.mutate()}
                  disabled={!form.name || !form.contact_email || !form.contact_name || submit.isPending}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--color-forest)" }}>
                  {submit.isPending ? <Loader2 size={15} className="animate-spin"/> : null}
                  {submit.isPending ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </>
          )}

          {/* ── DONE ── */}
          {step === "done" && (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "var(--color-forest)", color: "white" }}>
                <CheckCircle size={32}/>
              </div>
              <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Application received!</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                We’ll review your listing and reach out to {form.contact_email} within 1–2 business days.
                {tier !== "free" && " Payment details will be included in that email."}
              </p>
              <button onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--color-forest)" }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectoryScreen() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showGetListed, setShowGetListed] = useState(false);
  const { data: businesses, isLoading } = useQuery<Business[]>({ queryKey: ["/api/businesses"] });

  const cats = ["all", "retail", "food", "health", "services", "recreation"];

  const filtered = businesses?.filter(b => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || b.category === catFilter;
    return matchSearch && matchCat;
  });

  const tierOrder: Record<string, number> = { featured: 0, enhanced: 1, free: 2 };

  const sorted = [...(filtered ?? [])].sort((a, b) =>
    (tierOrder[a.tier] ?? 2) - (tierOrder[b.tier] ?? 2)
  );

  return (
    <div className="screen-enter space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Shop Local</h1>
        <p className="text-sm text-muted-foreground mt-1">Support Cannon County businesses. Find hours, deals, and local offers.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search businesses…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-colors ${
              catFilter === c
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}>
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full"/>)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Store size={32} className="mx-auto mb-3 opacity-40"/>
          <p className="text-sm">No businesses found.</p>
        </div>
      ) : sorted.map(b => (
        <div key={b.id} data-testid={`biz-${b.id}`}
          className={`rounded-xl border bg-card overflow-hidden ${
            b.tier === "featured"
              ? "border-2 border-amber-400 dark:border-amber-600 shadow-md"
              : b.tier === "enhanced"
              ? "border-border"
              : "border-border"
          }`}>

          {/* Featured: colored header bar */}
          {b.tier === "featured" && (
            <div className="px-4 py-2 flex items-center justify-between"
              style={{ background: "var(--color-forest)", color: "white" }}>
              <span className="text-xs font-bold uppercase tracking-widest">Featured Business</span>
              <span className="text-xs opacity-80">Sponsored</span>
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start gap-3 mb-2">
              {/* Logo slot for Featured */}
              {b.tier === "featured" && (
                <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center border"
                  style={{ background: "var(--color-cream)", borderColor: "var(--color-bronze)" }}>
                  <Store size={22} style={{ color: "var(--color-forest)" }}/>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-semibold ${b.tier === "featured" ? "text-lg" : "text-base"}`}>{b.name}</p>
                  {b.tier === "enhanced" && (
                    <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-wide">
                      Promoted
                    </span>
                  )}
                  {b.is_in_county && (
                    <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      In-County
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize">{b.category}</span>
              </div>
            </div>

            {/* Description — hidden for free tier */}
            {b.tier !== "free" && b.description && (
              <p className="text-sm text-muted-foreground mb-3">{b.description}</p>
            )}

            {/* Offer banner — Enhanced & Featured only */}
            {b.offer && b.tier !== "free" && (
              <div className="rounded-lg p-3 mb-3 text-sm font-medium flex items-start gap-2"
                style={{ background: "var(--color-cream-deep)", borderLeft: "3px solid var(--color-forest)" }}>
                <Tag size={14} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-forest)" }}/>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide block mb-0.5" style={{ color: "var(--color-forest)" }}>Special Offer</span>
                  <span className="text-foreground">{b.offer}</span>
                </div>
              </div>
            )}

            <div className="space-y-1 text-xs text-muted-foreground">
              {b.address && <p className="flex items-center gap-1"><MapPin size={11}/>{b.address}</p>}
              {b.tier !== "free" && b.hours && <p className="flex items-center gap-1"><Clock size={11}/>{b.hours}</p>}
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              {b.phone && (
                <a href={`tel:${b.phone}`} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                  <Phone size={12}/> Call
                </a>
              )}
              {b.tier !== "free" && b.website_url && (
                <a href={b.website_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors">
                  <Globe size={12}/> Website
                </a>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* List your business CTA */}
      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
        <Store size={24} className="mx-auto mb-2 text-muted-foreground"/>
        <p className="font-semibold text-sm mb-1">List Your Cannon County Business</p>
        <p className="text-xs text-muted-foreground mb-3">Free basic listings · Enhanced from $29/mo · In-county discount applies</p>
        <button
          onClick={() => setShowGetListed(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-primary-foreground"
          style={{ background: "var(--color-forest)" }}>
          <Plus size={13}/> Get Listed
        </button>
      </div>

      {showGetListed && <GetListedModal onClose={() => setShowGetListed(false)}/>}
    </div>
  );
}

// ── MY ALERTS ─────────────────────────────────────────────────
function MyAlertsScreen() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [topics, setTopics] = useState({
    topic_meetings: true, topic_budget: true, topic_school: true,
    topic_services: true, topic_alerts: true, topic_deals: true,
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscribers", { email, name, ...topics });
      if (!res.ok) throw new Error("Signup failed");
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Subscribed!", description: "Check your email for confirmation." });
    },
    onError: () => toast({ title: "Error", description: "Could not subscribe. Please try again.", variant: "destructive" }),
  });

  const topicList = [
    { key: "topic_meetings",  label: "County Meetings",     sub: "Commission, Budget, School Board, Planning" },
    { key: "topic_budget",    label: "Budget Updates",      sub: "Finance news, spending changes, tax items" },
    { key: "topic_school",    label: "School Board",        sub: "Education policy, budget, staff updates" },
    { key: "topic_services",  label: "County Services",     sub: "Convenience center, road work, utility notices" },
    { key: "topic_alerts",    label: "Breaking Civic Alerts", sub: "Urgent public interest items" },
    { key: "topic_deals",     label: "Cannon County Deals from Local Business",  sub: "Offers and promotions from in-county businesses" },
  ] as const;

  if (submitted) {
    return (
      <div className="screen-enter flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--color-forest)", color: "white" }}>
          <CheckCircle size={32}/>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>You're subscribed!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Check your inbox for a confirmation. You'll get push notifications when you install this app, and email reminders as backup.
        </p>
        <button onClick={() => setSubmitted(false)} className="mt-6 text-xs text-primary underline">
          Update preferences
        </button>
      </div>
    );
  }

  return (
    <div className="screen-enter max-w-lg mx-auto space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>My Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign up for free civic notifications. Install this app to get push notifications directly to your phone.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email Address</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            placeholder="your@email.com" data-testid="input-email"
            className="w-full mt-1.5 px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name <span className="text-brick">*</span></label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" required
            className="w-full mt-1.5 px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"/>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Alert Topics</p>
          <div className="space-y-2">
            {topicList.map(t => (
              <label key={t.key} className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={topics[t.key]}
                  onChange={e => setTopics(prev => ({ ...prev, [t.key]: e.target.checked }))}
                  className="mt-0.5 accent-primary"/>
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          We never sell your email. You can unsubscribe at any time from any email we send. Push notifications require installing this app to your home screen.
        </p>

        <button onClick={() => mutation.mutate()} disabled={!email || !name.trim() || mutation.isPending}
          data-testid="button-subscribe"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          style={{ background: "var(--color-forest)" }}>
          {mutation.isPending ? <Loader2 size={16} className="animate-spin"/> : <Bell size={16}/>}
          Subscribe — It's Free
        </button>
      </div>

      <div className="rounded-xl border-l-4 p-4 text-sm" style={{ borderColor: "var(--color-forest)", background: "var(--color-cream-deep)" }}>
        <p className="font-semibold mb-1" style={{ color: "var(--color-forest)" }}>📱 Install for Push Notifications</p>
        <p className="text-muted-foreground text-xs">Tap the share button in your browser and select "Add to Home Screen" to install this app. Once installed, you'll get day-of meeting reminders directly to your phone — no inbox required.</p>
      </div>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────
function AdminScreen() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"meetings" | "alerts" | "businesses" | "subscribers" | "scraper">("meetings");

  // ── Meetings admin ─────────────────────────────────────────
  const { data: meetings, isLoading: mldr, refetch: refetchMeetings } =
    useQuery<Meeting[]>({ queryKey: ["/api/meetings/all"] });
  const [newMeeting, setNewMeeting] = useState<Partial<InsertMeeting>>({
    body: "county_commission", is_published: true
  });
  const createMeeting = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/meetings", newMeeting);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Meeting created" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/all"] });
      setNewMeeting({ body: "county_commission", is_published: true });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/meetings/${id}`);
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Meeting deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/all"] });
    },
  });

  // ── Alerts admin ───────────────────────────────────────────
  const { data: alerts, isLoading: aldr } =
    useQuery<Alert[]>({ queryKey: ["/api/alerts/all"] });
  const [newAlert, setNewAlert] = useState<Partial<InsertAlert>>({
    label: "fyi", body: "county_commission", is_published: true, is_breaking: false
  });
  const createAlert = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/alerts", newAlert);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Alert created" + (newAlert.is_breaking ? " — push notification sent!" : "") });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/all"] });
      setNewAlert({ label: "fyi", body: "county_commission", is_published: true, is_breaking: false });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/alerts/${id}`);
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Alert deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/all"] });
    },
  });

  // ── Businesses admin ───────────────────────────────────────
  const { data: allBusinesses, refetch: refetchBusinesses } =
    useQuery<Business[]>({ queryKey: ["/api/businesses/all"] });
  const pendingBusinesses = allBusinesses?.filter(b => (b as any).status === "pending") ?? [];
  const activeBusinesses  = allBusinesses?.filter(b => (b as any).status === "active")  ?? [];

  const reviewBusiness = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const res = await apiRequest("PATCH", `/api/businesses/${id}/review`, { action });
      if (!res.ok) throw new Error("Review failed");
      return res.json();
    },
    onSuccess: (_d, vars) => {
      toast({ title: vars.action === "approve" ? "Listing approved — now live" : "Listing rejected" });
      refetchBusinesses();
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  // ── Subscribers ────────────────────────────────────────────
  const { data: subs } = useQuery<any[]>({ queryKey: ["/api/subscribers/all"] });
  const { data: subCount } = useQuery<{ count: number }>({ queryKey: ["/api/subscribers/count"] });

  // ── Scraper ──────────────────────────────────────────────
  const { data: scraperStatus, refetch: refetchScraperStatus } =
    useQuery<{ last_run: string | null; last_status: string; scraped_meetings: number; scraped_documents: number }>(
      { queryKey: ["/api/scraper/status"], staleTime: 10_000 }
    );
  const { data: scraperLogs } = useQuery<any[]>({ queryKey: ["/api/scraper/logs"] });
  const runScraper = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/run-scraper");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Scraper started", description: "Running in background — check back in ~60 seconds" });
      setTimeout(() => {
        refetchScraperStatus();
        queryClient.invalidateQueries({ queryKey: ["/api/meetings/all"] });
        queryClient.invalidateQueries({ queryKey: ["/api/scraper/logs"] });
      }, 65_000);
    },
    onError: () => toast({ title: "Scraper failed to start", variant: "destructive" }),
  });

  // ── Reminder trigger ───────────────────────────────────────
  const sendReminders = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/send-meeting-reminders");
      return res.json();
    },
    onSuccess: (d: any) => toast({ title: `Reminders sent`, description: `${d.sent} notifications dispatched` }),
    onError: () => toast({ title: "Error sending reminders", variant: "destructive" }),
  });

  const inputCls = "w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  const bodies: MeetingBody[] = ["county_commission","budget_committee","school_board","planning_commission","other"];
  const labels: AlertLabel[]  = ["fyi","important","upcoming_vote","action_needed"];

  return (
    <div className="screen-enter space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Admin Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Staff only · Cannon Pocket</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full font-semibold border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Staff Only
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { val: String(subCount?.count ?? "—"), label: "Subscribers", color: "var(--color-forest)" },
          { val: String(alerts?.filter(a=>a.is_published).length ?? "—"), label: "Live Alerts", color: "var(--color-bronze)" },
          { val: String(meetings?.filter(m=>m.is_published).length ?? "—"), label: "Upcoming Meetings", color: "var(--color-forest)" },
          { val: String(activeBusinesses.length || "—"), label: "Active Listings", color: "var(--color-brick)" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: k.color }}>{k.val}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Send reminders */}
      <div className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Send Meeting Reminders</p>
          <p className="text-xs text-muted-foreground">Push + email all subscribers about tomorrow's meetings</p>
        </div>
        <button onClick={() => sendReminders.mutate()} disabled={sendReminders.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white flex-shrink-0 disabled:opacity-50"
          style={{ background: "var(--color-forest)" }}>
          {sendReminders.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
          Send Now
        </button>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 border-b border-border pb-0">
        {(["meetings","alerts","businesses","subscribers","scraper"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 transition-colors -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── MEETINGS TAB ── */}
      {tab === "meetings" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-bold">Add Meeting</p>
            <input placeholder="Title *" value={newMeeting.title ?? ""} onChange={e => setNewMeeting(p=>({...p,title:e.target.value}))} className={inputCls}/>
            <select value={newMeeting.body} onChange={e => setNewMeeting(p=>({...p,body:e.target.value as MeetingBody}))} className={inputCls}>
              {bodies.map(b => <option key={b} value={b}>{BODY_LABELS[b]}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={newMeeting.meeting_date ?? ""} onChange={e => setNewMeeting(p=>({...p,meeting_date:e.target.value}))} className={inputCls}/>
              <input type="time" value={newMeeting.meeting_time ?? ""} onChange={e => setNewMeeting(p=>({...p,meeting_time:e.target.value}))} className={inputCls}/>
            </div>
            <input placeholder="Location *" value={newMeeting.location ?? ""} onChange={e => setNewMeeting(p=>({...p,location:e.target.value}))} className={inputCls}/>
            <input placeholder="Agenda URL" value={newMeeting.agenda_url ?? ""} onChange={e => setNewMeeting(p=>({...p,agenda_url:e.target.value}))} className={inputCls}/>
            <input placeholder="Notes (optional)" value={newMeeting.notes ?? ""} onChange={e => setNewMeeting(p=>({...p,notes:e.target.value}))} className={inputCls}/>
            <button onClick={() => createMeeting.mutate()}
              disabled={!newMeeting.title || !newMeeting.meeting_date || !newMeeting.meeting_time || !newMeeting.location || createMeeting.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--color-forest)" }}>
              {createMeeting.isPending ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
              Add Meeting
            </button>
          </div>
          <div className="space-y-2">
            {mldr ? <Skeleton className="h-16 w-full"/> : meetings?.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(m.meeting_date)} · {fmtTime(m.meeting_time)}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <BodyPill body={m.body}/>
                    {!m.is_published && <span className="text-xs text-muted-foreground">(draft)</span>}
                  </div>
                </div>
                <button onClick={() => { if(confirm("Delete this meeting?")) deleteMeeting.mutate(m.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ALERTS TAB ── */}
      {tab === "alerts" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-bold">New Alert</p>
            <input placeholder="Title *" value={newAlert.title ?? ""} onChange={e => setNewAlert(p=>({...p,title:e.target.value}))} className={inputCls}/>
            <textarea placeholder="Plain-English summary *" value={newAlert.summary ?? ""} onChange={e => setNewAlert(p=>({...p,summary:e.target.value}))} rows={3} className={inputCls}/>
            <div className="grid grid-cols-2 gap-2">
              <select value={newAlert.label} onChange={e => setNewAlert(p=>({...p,label:e.target.value as AlertLabel}))} className={inputCls}>
                {labels.map(l => <option key={l} value={l}>{l.replace("_"," ")}</option>)}
              </select>
              <select value={newAlert.body} onChange={e => setNewAlert(p=>({...p,body:e.target.value as MeetingBody}))} className={inputCls}>
                {bodies.map(b => <option key={b} value={b}>{BODY_LABELS[b]}</option>)}
              </select>
            </div>
            <input placeholder="Source URL" value={newAlert.source_url ?? ""} onChange={e => setNewAlert(p=>({...p,source_url:e.target.value}))} className={inputCls}/>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={newAlert.is_breaking ?? false}
                onChange={e => setNewAlert(p=>({...p,is_breaking:e.target.checked}))}
                className="accent-red-600"/>
              <span>Breaking alert — send push notification immediately</span>
            </label>
            <button onClick={() => createAlert.mutate()}
              disabled={!newAlert.title || !newAlert.summary || createAlert.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--color-forest)" }}>
              {createAlert.isPending ? <Loader2 size={14} className="animate-spin"/> : <Bell size={14}/>}
              Publish Alert
            </button>
          </div>
          <div className="space-y-2">
            {aldr ? <Skeleton className="h-16 w-full"/> : alerts?.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <AlertBadge label={a.label}/>
                    <BodyPill body={a.body}/>
                    {a.is_breaking && <span className="text-xs text-red-600 font-semibold">Breaking</span>}
                    {!a.is_published && <span className="text-xs text-muted-foreground">(draft)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(a.created_at), "MMM d, yyyy")}</p>
                </div>
                <button onClick={() => { if(confirm("Delete this alert?")) deleteAlert.mutate(a.id); }}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BUSINESSES TAB ── */}
      {tab === "businesses" && (
        <div className="space-y-4">

          {/* Pending applications */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>Pending Applications</p>
              {pendingBusinesses.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                  {pendingBusinesses.length} new
                </span>
              )}
            </div>

            {pendingBusinesses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No pending applications.</p>
            ) : pendingBusinesses.map((b: any) => (
              <div key={b.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.category} · {b.tier} tier · {b.is_in_county ? "In-county" : "Out-of-county"}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 flex-shrink-0">Pending</span>
                </div>
                {b.description && <p className="text-xs text-muted-foreground">{b.description}</p>}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {b.address && <p className="flex items-center gap-1"><MapPin size={10}/>{b.address}</p>}
                  {b.phone && <p className="flex items-center gap-1"><Phone size={10}/>{b.phone}</p>}
                </div>
                <div className="rounded-lg p-2.5 border text-xs space-y-0.5" style={{ borderColor: "var(--color-bronze)", background: "var(--color-cream-deep)" }}>
                  <p className="font-semibold text-foreground">Contact (private)</p>
                  <p>{b.contact_name} · {b.contact_email}{b.contact_phone ? ` · ${b.contact_phone}` : ""}</p>
                  {b.tier !== "free" && (
                    <p className="text-muted-foreground">Rate: ${b.is_in_county ? TIER_PRICING[b.tier as ListingTier]?.in : TIER_PRICING[b.tier as ListingTier]?.out}/mo</p>
                  )}
                </div>
                {b.applied_at && (
                  <p className="text-xs text-muted-foreground">Applied {format(parseISO(b.applied_at), "MMM d, yyyy 'at' h:mm a")}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => reviewBusiness.mutate({ id: b.id, action: "approve" })}
                    disabled={reviewBusiness.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--color-forest)" }}>
                    <CheckCircle size={13}/> Approve
                  </button>
                  <button
                    onClick={() => { if (confirm(`Reject ${b.name}'s application?`)) reviewBusiness.mutate({ id: b.id, action: "reject" }); }}
                    disabled={reviewBusiness.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                    <X size={13}/> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Active listings */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>Active Listings ({activeBusinesses.length})</p>
            {activeBusinesses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No active listings yet.</p>
            ) : activeBusinesses.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{b.category} · {b.tier}{b.tier !== "free" ? ` · $${b.is_in_county ? TIER_PRICING[b.tier as ListingTier]?.in : TIER_PRICING[b.tier as ListingTier]?.out}/mo` : ""}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 flex-shrink-0">Live</span>
              </div>
            ))}
          </div>

          {/* Supabase link */}
          <div className="text-center">
            <a href="https://supabase.com/dashboard/project/waevompeqreneittxfle/editor" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
              Open Supabase Editor <ExternalLink size={11}/>
            </a>
          </div>
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ── */}
      {tab === "subscribers" && (
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-forest)" }}>
              {subCount?.count ?? "—"}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Active Subscribers</p>
          </div>
          <div className="space-y-2">
            {subs?.slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border bg-card">
                <div>
                  <p className="text-sm font-medium">{s.email}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(s.created_at), "MMM d, yyyy")}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${s.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                  {s.is_active ? "Active" : "Unsub"}
                </span>
              </div>
            ))}
            {(subs?.length ?? 0) === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">No subscribers yet. Share the app!</p>
            )}
          </div>
        </div>
      )}

      {/* ─── SCRAPER TAB ─── */}
      {tab === "scraper" && (
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>Auto-Scraper</p>
                <p className="text-xs text-muted-foreground">Pulls meetings & docs from cannoncountytn.gov every 6 hours</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                scraperStatus?.last_status === "success" ? "bg-emerald-100 text-emerald-800" :
                scraperStatus?.last_status === "partial" ? "bg-amber-100 text-amber-800" :
                scraperStatus?.last_status === "never" ? "bg-gray-100 text-gray-600" :
                "bg-gray-100 text-gray-600"
              }`}>{scraperStatus?.last_status ?? "—"}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold" style={{ color: "var(--color-forest)" }}>{scraperStatus?.scraped_meetings ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Scraped Meetings</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold" style={{ color: "var(--color-bronze)" }}>{scraperStatus?.scraped_documents ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Scraped Documents</p>
              </div>
            </div>

            {scraperStatus?.last_run && (
              <p className="text-xs text-muted-foreground">
                Last run: {format(parseISO(scraperStatus.last_run), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}

            <button
              onClick={() => runScraper.mutate()}
              disabled={runScraper.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "var(--color-forest)" }}
            >
              {runScraper.isPending ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>}
              {runScraper.isPending ? "Starting..." : "Run Scraper Now"}
            </button>
          </div>

          {/* Draft meetings from scraper */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Scraped Meetings (pending review)</p>
            <p className="text-xs text-muted-foreground">Review and publish scraped meetings. They’re hidden from the public until you publish them.</p>
            {meetings?.filter(m => !m.is_published && m.source_url).slice(0, 15).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.meeting_date} · {m.location?.split(",")[0]}</p>
                </div>
                <button
                  onClick={async () => {
                    await apiRequest("PATCH", `/api/meetings/${m.id}`, { is_published: true });
                    queryClient.invalidateQueries({ queryKey: ["/api/meetings/all"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
                    toast({ title: "Meeting published" });
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "var(--color-forest)" }}
                >Publish</button>
              </div>
            ))}
            {(meetings?.filter(m => !m.is_published && m.source_url).length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No draft meetings. Run the scraper to fetch new ones.</p>
            )}
          </div>

          {/* Scraper logs */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Recent Activity</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {scraperLogs?.slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    log.status === "success" ? "bg-emerald-400" : "bg-amber-400"
                  }`}/>
                  <span className="text-muted-foreground flex-shrink-0 w-16">{log.content_type}</span>
                  <span className="truncate text-foreground/80">{log.url?.split("/").slice(-2).join("/")}</span>
                  <span className="flex-shrink-0 text-muted-foreground ml-auto">
                    {log.scraped_at ? format(parseISO(log.scraped_at), "h:mm a") : "—"}
                  </span>
                </div>
              ))}
              {(scraperLogs?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No logs yet. Run the scraper first.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { id: "home",      label: "Home",       icon: Home },
  { id: "meetings",  label: "Meetings",   icon: Calendar },
  { id: "directory", label: "Shop Local",  icon: Store },
  { id: "alerts",    label: "Alerts",     icon: Bell },
  { id: "documents", label: "Docs",       icon: FileText },
  { id: "county",    label: "County",     icon: Info },
  { id: "my-alerts", label: "My Alerts",  icon: User },
  { id: "admin",     label: "Admin",      icon: Shield },
] as const;

type Screen = (typeof NAV_ITEMS)[number]["id"];

function AdminPasswordModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "cannonpocket-admin";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--color-forest)" }}>
            <Shield size={20} color="white"/>
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Admin Access</h2>
            <p className="text-xs text-muted-foreground">Enter your admin password to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Password"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl border text-sm bg-background outline-none transition-colors ${
              error ? "border-red-500 placeholder-red-400" : "border-border focus:border-primary"
            }`}
          />
          {error && <p className="text-xs text-red-500">Incorrect password. Try again.</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: "var(--color-forest)" }}>
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppInner() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [countyScrollTo, setCountyScrollTo] = useState<"corruption" | undefined>(undefined);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showDumpPopup, setShowDumpPopup] = useState(false);
  const { dark, toggle } = useTheme();

  const SCREEN_TITLES: Record<Screen, string> = {
    home: "Cannon County", meetings: "Meetings", alerts: "Alerts",
    documents: "Documents", county: "County Info", directory: "Shop Local",
    "my-alerts": "My Alerts", admin: "Admin",
  };

  const nav = (s: string) => {
    if (s === "admin" && !adminUnlocked) {
      setShowAdminModal(true);
      setSidebarOpen(false);
      return;
    }
    setScreen(s as Screen);
    setSidebarOpen(false);
    setCountyScrollTo(undefined);
  };

  const navToCorruption = () => {
    setScreen("county");
    setSidebarOpen(false);
    setCountyScrollTo("corruption");
  };

  const bottomNav: Screen[] = ["home", "meetings", "directory", "alerts", "county"];

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-screen overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted transition-colors lg:hidden" aria-label="Menu">
            <Menu size={20}/>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-forest)" }}>
              <svg viewBox="0 0 32 32" width="18" height="18" fill="none" aria-label="Cannon County">
                <circle cx="16" cy="16" r="12" stroke="white" strokeWidth="2"/>
                <path d="M10 22 L16 10 L22 22" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 18 L20 18" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>Cannon Pocket</p>
              <p className="text-xs text-muted-foreground leading-none mt-0.5">CANNON COUNTY, TN</p>
            </div>
            <p className="text-sm font-bold sm:hidden" style={{ fontFamily: "var(--font-display)" }}>{SCREEN_TITLES[screen]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Toggle theme">
            {dark ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          <button onClick={() => nav("my-alerts")} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Alerts">
            <Bell size={18}/>
          </button>
          <button onClick={() => { if (typeof (window as any).triggerInstall === 'function') (window as any).triggerInstall(); else alert('Open in Safari/Chrome and tap Share → Add to Home Screen'); }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--color-forest)" }}>
            <Download size={13}/> Add to Home
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar (desktop always visible, mobile overlay) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)}/>
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r shadow-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <p className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>Navigation</p>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-muted"><X size={16}/></button>
              </div>
              <SidebarContent screen={screen} nav={nav} navToCorruption={navToCorruption}/>
            </aside>
          </div>
        )}
        <aside className="hidden lg:flex flex-col w-56 border-r bg-card p-4 min-h-0 overflow-y-auto flex-shrink-0">
          <SidebarContent screen={screen} nav={nav} navToCorruption={navToCorruption}/>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          <div className="max-w-2xl mx-auto">
            {screen === "home"      && <HomeScreen onNav={nav} onDump={() => setShowDumpPopup(true)}/>}
            {screen === "meetings"  && <MeetingsScreen/>}
            {screen === "alerts"    && <AlertsScreen/>}
            {screen === "documents" && <DocumentsScreen/>}
            {screen === "county"    && <CountyScreen scrollTo={countyScrollTo}/>}
            {screen === "directory" && <DirectoryScreen/>}
            {screen === "my-alerts" && <MyAlertsScreen/>}
            {screen === "admin"     && adminUnlocked && <AdminScreen/>}
            {showAdminModal && (
              <AdminPasswordModal
                onSuccess={() => { setAdminUnlocked(true); setShowAdminModal(false); setScreen("admin"); }}
                onCancel={() => setShowAdminModal(false)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur px-2 pb-safe">
        <div className="flex justify-around py-1">
          {bottomNav.map(id => {
            const item = NAV_ITEMS.find(n => n.id === id)!;
            const Icon = item.icon;
            const active = screen === id;
            return (
              <button key={id} onClick={() => nav(id)} data-testid={`nav-${id}`}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8}/>
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          {/* Report Corruption — always visible, brick-colored */}
          <button onClick={navToCorruption}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors"
            style={{ color: "var(--color-brick)" }}>
            <Flag size={20} strokeWidth={1.8}/>
            <span className="text-xs font-semibold">Corruption?</span>
          </button>
        </div>
      </nav>

      <Toaster/>
      {showDumpPopup && <DumpHoursPopup onClose={() => setShowDumpPopup(false)}/>}
    </div>
  );
}

function SidebarContent({ screen, nav, navToCorruption }: { screen: Screen; nav: (s: string) => void; navToCorruption: () => void }) {
  const publicItems = NAV_ITEMS.slice(0, 7);
  const adminItems  = NAV_ITEMS.slice(7);
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">Public</p>
      {publicItems.map(item => {
        const Icon = item.icon;
        const active = screen === item.id;
        return (
          <button key={item.id} onClick={() => nav(item.id)} data-testid={`sidebar-${item.id}`}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "font-semibold text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            style={active ? { background: "var(--color-forest)" } : {}}>
            <Icon size={16} strokeWidth={active ? 2.5 : 1.8}/>
            {item.label}
          </button>
        );
      })}

      {/* Report Corruption — prominent brick button */}
      <button onClick={navToCorruption}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors hover:opacity-90"
        style={{ color: "var(--color-brick)" }}>
        <Flag size={16}/>
        Report Corruption
      </button>

      <div className="pt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">Admin</p>
        {adminItems.map(item => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => nav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "font-semibold text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={active ? { background: "var(--color-brick)" } : {}}>
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8}/>
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner/>
    </QueryClientProvider>
  );
}

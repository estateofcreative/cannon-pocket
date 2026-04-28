// Cannon County Dashboard — Shared Types
// These mirror the Supabase schema exactly

export type MeetingBody =
  | "county_commission"
  | "budget_committee"
  | "school_board"
  | "planning_commission"
  | "other";

export type AlertLabel = "fyi" | "important" | "upcoming_vote" | "action_needed";

export type DocumentCategory = "agenda" | "minutes" | "budget" | "recording" | "resolution" | "other";

export type BusinessTier = "free" | "enhanced" | "featured";

export interface Meeting {
  id: string;
  title: string;
  body: MeetingBody;
  meeting_date: string;
  meeting_time: string;
  location: string;
  agenda_url: string | null;
  livestream_url: string | null;
  directions_url: string | null;
  notes: string | null;
  source_url: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  title: string;
  summary: string;
  label: AlertLabel;
  body: MeetingBody;
  source_url: string | null;
  is_published: boolean;
  is_breaking: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  category: string;
  body: string | null;
  document_url: string;
  document_date: string;
  file_type: string;
  source_url: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  push_token: string | null;
  is_active: boolean;
  topic_meetings: boolean;
  topic_budget: boolean;
  topic_school: boolean;
  topic_services: boolean;
  topic_alerts: boolean;
  topic_deals: boolean;
  unsubscribe_token: string;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string | null;
  phone: string | null;
  website_url: string | null;
  hours: string | null;
  offer: string | null;
  tier: BusinessTier;
  is_in_county: boolean;
  is_active: boolean;
  logo_url: string | null;
  created_at: string;
}

export interface InsertMeeting {
  title: string;
  body: MeetingBody;
  meeting_date: string;
  meeting_time: string;
  location: string;
  agenda_url?: string;
  livestream_url?: string;
  directions_url?: string;
  notes?: string;
  is_published?: boolean;
}

export interface InsertAlert {
  title: string;
  summary: string;
  label: AlertLabel;
  body: MeetingBody;
  source_url?: string;
  is_published?: boolean;
  is_breaking?: boolean;
}

export interface InsertSubscriber {
  email: string;
  name?: string;
  topic_meetings?: boolean;
  topic_budget?: boolean;
  topic_school?: boolean;
  topic_services?: boolean;
  topic_alerts?: boolean;
  topic_deals?: boolean;
}

export const BODY_LABELS: Record<MeetingBody, string> = {
  county_commission: "County Commission",
  budget_committee: "Budget Committee",
  school_board: "School Board",
  planning_commission: "Planning Commission",
  other: "Other",
};

export const LABEL_CONFIG: Record<AlertLabel, { label: string; color: string }> = {
  fyi: { label: "FYI", color: "bg-slate-100 text-slate-700" },
  important: { label: "Important", color: "bg-amber-100 text-amber-800" },
  upcoming_vote: { label: "Upcoming Vote", color: "bg-blue-100 text-blue-800" },
  action_needed: { label: "Action Needed", color: "bg-red-100 text-red-800" },
};

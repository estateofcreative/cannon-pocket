import type { Express } from "express";
import type { Server } from "http";
import supabase from "./supabase";
import type { InsertMeeting, InsertAlert, InsertSubscriber } from "../shared/schema";
import { runScraper } from "./scraper";

export function registerRoutes(httpServer: Server, app: Express) {

  // ── HEALTH ─────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok", app: "cannon-pocket" }));

  // ── MEETINGS ──────────────────────────────────────────────────
  app.get("/api/meetings", async (_req, res) => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("is_published", true)
      .gte("meeting_date", new Date().toISOString().split("T")[0])
      .order("meeting_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/meetings/all", async (_req, res) => {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/meetings", async (req, res) => {
    const body: InsertMeeting = req.body;
    if (!body.title || !body.meeting_date || !body.meeting_time || !body.location) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const { data, error } = await supabase.from("meetings").insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("meetings")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ── ALERTS ────────────────────────────────────────────────────
  app.get("/api/alerts", async (_req, res) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_published", true)
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/alerts/all", async (_req, res) => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/alerts", async (req, res) => {
    const body: InsertAlert = req.body;
    if (!body.title || !body.summary) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const { data, error } = await supabase.from("alerts").insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Push notification via OneSignal for breaking alerts
    if (body.is_breaking && process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
      try {
        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: process.env.ONESIGNAL_APP_ID,
            included_segments: ["All"],
            headings: { en: "⚠️ Cannon County Alert" },
            contents: { en: body.title },
            url: "https://www.perplexity.ai/computer/a/cannon-county-citizen-dashboar-rqLX2WtiS8akwjdcgUUriw",
          }),
        });
      } catch (e) {
        console.warn("OneSignal push failed:", e);
      }
    }

    res.json(data);
  });

  app.patch("/api/alerts/:id", async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("alerts")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ── DOCUMENTS ─────────────────────────────────────────────────
  app.get("/api/documents", async (_req, res) => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("is_published", true)
      .order("document_date", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/documents", async (req, res) => {
    const { data, error } = await supabase.from("documents").insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/documents/:id", async (req, res) => {
    const { error } = await supabase.from("documents").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ── BUSINESSES ────────────────────────────────────────────────
  app.get("/api/businesses", async (_req, res) => {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("is_active", true)
      .order("tier", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/businesses/all", async (_req, res) => {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/businesses", async (req, res) => {
    const { data, error } = await supabase.from("businesses").insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.patch("/api/businesses/:id", async (req, res) => {
    const { data, error } = await supabase
      .from("businesses")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ── SUBSCRIBERS ───────────────────────────────────────────────
  app.post("/api/subscribers", async (req, res) => {
    const body: InsertSubscriber = req.body;
    if (!body.email) return res.status(400).json({ error: "Email required" });

    // Upsert: update prefs if email already exists
    const { data, error } = await supabase
      .from("subscribers")
      .upsert(
        { ...body, is_active: true },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    // Send welcome email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Cannon County Dashboard <alerts@cannoncountydashboard.com>",
            to: body.email,
            subject: "You're subscribed to Cannon County Civic Alerts",
            html: `
              <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#FAF7F2;border-radius:8px;">
                <h1 style="font-size:24px;color:#1E1C17;margin-bottom:8px;">Welcome to Cannon County Dashboard</h1>
                <p style="color:#6B6659;font-size:16px;line-height:1.6;">You're now subscribed to civic alerts for Cannon County, Tennessee. We'll notify you about upcoming meetings, budget updates, and important civic actions.</p>
                <p style="color:#6B6659;font-size:14px;margin-top:24px;">To unsubscribe at any time, <a href="https://www.perplexity.ai/computer/a/cannon-county-citizen-dashboar-rqLX2WtiS8akwjdcgUUriw" style="color:#2D5016;">manage your preferences here</a>.</p>
                <p style="color:#A8A49B;font-size:12px;margin-top:32px;">Cannon County Citizen Dashboard · Woodbury, Tennessee</p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.warn("Resend welcome email failed:", e);
      }
    }

    res.json(data);
  });

  app.get("/api/subscribers/count", async (_req, res) => {
    const { count, error } = await supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count });
  });

  app.get("/api/subscribers/all", async (_req, res) => {
    const { data, error } = await supabase
      .from("subscribers")
      .select("id, email, name, is_active, topic_meetings, topic_budget, topic_school, topic_alerts, topic_deals, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ── MEETING REMINDERS (manual trigger + daily cron) ───────────
  app.post("/api/send-meeting-reminders", async (_req, res) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: meetings } = await supabase
      .from("meetings")
      .select("*")
      .eq("is_published", true)
      .eq("meeting_date", tomorrowStr);

    if (!meetings || meetings.length === 0) {
      return res.json({ sent: 0, message: "No meetings tomorrow" });
    }

    const { data: subscribers } = await supabase
      .from("subscribers")
      .select("*")
      .eq("is_active", true)
      .eq("topic_meetings", true);

    if (!subscribers || subscribers.length === 0) {
      return res.json({ sent: 0, message: "No subscribers for meetings" });
    }

    let sent = 0;

    // OneSignal push to all subscribers
    if (process.env.ONESIGNAL_APP_ID) {
      for (const meeting of meetings) {
        try {
          const timeStr = new Date(`2000-01-01T${meeting.meeting_time}`).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true
          });
          await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify({
              app_id: process.env.ONESIGNAL_APP_ID,
              included_segments: ["All"],
              headings: { en: "📅 Meeting Tomorrow" },
              contents: { en: `${meeting.title} — ${timeStr} at ${meeting.location.split(",")[0]}` },
              url: "https://www.perplexity.ai/computer/a/cannon-county-citizen-dashboar-rqLX2WtiS8akwjdcgUUriw",
            }),
          });
          sent++;
        } catch (e) {
          console.warn("OneSignal reminder failed:", e);
        }
      }
    }

    // Resend email fallback for email subscribers
    if (process.env.RESEND_API_KEY) {
      for (const meeting of meetings) {
        const timeStr = new Date(`2000-01-01T${meeting.meeting_time}`).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
        });
        for (const sub of subscribers) {
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Cannon County Dashboard <alerts@cannoncountydashboard.com>",
                to: sub.email,
                subject: `📅 Tomorrow: ${meeting.title}`,
                html: `
                  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#FAF7F2;border-radius:8px;">
                    <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#A8A49B;margin-bottom:8px;">Meeting Tomorrow</p>
                    <h1 style="font-size:22px;color:#1E1C17;margin-bottom:16px;">${meeting.title}</h1>
                    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                      <tr><td style="padding:8px 0;color:#6B6659;font-size:14px;width:80px;">When</td><td style="padding:8px 0;color:#1E1C17;font-size:14px;">${timeStr} CDT</td></tr>
                      <tr><td style="padding:8px 0;color:#6B6659;font-size:14px;">Where</td><td style="padding:8px 0;color:#1E1C17;font-size:14px;">${meeting.location}</td></tr>
                      ${meeting.notes ? `<tr><td style="padding:8px 0;color:#6B6659;font-size:14px;">Notes</td><td style="padding:8px 0;color:#1E1C17;font-size:14px;">${meeting.notes}</td></tr>` : ""}
                    </table>
                    ${meeting.agenda_url ? `<a href="${meeting.agenda_url}" style="display:inline-block;padding:10px 20px;background:#2D5016;color:white;border-radius:6px;text-decoration:none;font-size:14px;">View Agenda →</a>` : ""}
                    <p style="color:#A8A49B;font-size:12px;margin-top:32px;">Cannon County Citizen Dashboard · <a href="https://www.perplexity.ai/computer/a/cannon-county-citizen-dashboar-rqLX2WtiS8akwjdcgUUriw" style="color:#A8A49B;">Manage preferences</a></p>
                  </div>
                `,
              }),
            });
            sent++;
          } catch (e) {
            console.warn("Resend reminder failed:", e);
          }
        }
      }
    }

    res.json({ sent, meetings: meetings.length, subscribers: subscribers.length });
  });

  // ── BUSINESS LISTING APPLICATION ────────────────────────────────
  app.post("/api/businesses/apply", async (req, res) => {
    const {
      name, category, description, address, phone, website_url,
      hours, offer, tier, is_in_county,
      contact_name, contact_email, contact_phone,
    } = req.body;

    if (!name || !category || !contact_email) {
      return res.status(400).json({ error: "name, category, and contact_email are required" });
    }

    const { data, error } = await supabase.from("businesses").insert({
      name, category, description, address, phone, website_url,
      hours, offer,
      tier: tier || "free",
      is_in_county: !!is_in_county,
      is_active: false,          // hidden from public until approved
      status: "pending",
      contact_name, contact_email, contact_phone,
      applied_at: new Date().toISOString(),
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    // Send notification email to admin via Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Cannon County Dashboard <onboarding@resend.dev>",
        to: [process.env.ADMIN_EMAIL || "estateofcreative@gmail.com"],
        subject: `New Business Listing Application: ${name} (${tier || "free"})`,
        html: `
          <h2>New Listing Application</h2>
          <p><strong>Business:</strong> ${name}</p>
          <p><strong>Tier:</strong> ${tier || "free"} ${is_in_county ? "(In-County)" : "(Out-of-County)"}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Contact:</strong> ${contact_name} &lt;${contact_email}&gt; ${contact_phone || ""}</p>
          <p><strong>Address:</strong> ${address || "—"}</p>
          <p><strong>Description:</strong> ${description || "—"}</p>
          <p><strong>Offer:</strong> ${offer || "—"}</p>
          <hr/>
          <p>Log into the Admin panel → Businesses tab to approve or reject this application.</p>
        `,
      });
    } catch (e) {
      console.warn("[apply] Email notification failed:", e);
    }

    res.json({ success: true, id: data.id });
  });

  // Approve or reject a pending business
  app.patch("/api/businesses/:id/review", async (req, res) => {
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve','reject'].includes(action)) {
      return res.status(400).json({ error: "action must be approve or reject" });
    }
    const { data, error } = await supabase
      .from("businesses")
      .update({
        status: action === "approve" ? "active" : "rejected",
        is_active: action === "approve",
      })
      .eq("id", req.params.id)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ── SCRAPER ───────────────────────────────────────────────────
  app.post("/api/run-scraper", async (_req, res) => {
    try {
      // Run scraper in background and return immediately
      const promise = runScraper();
      res.json({ status: "started", message: "Scraper running in background" });
      const result = await promise;
      console.log("[scraper] Completed:", result);
    } catch (err) {
      console.error("[scraper] Failed:", err);
    }
  });

  app.get("/api/scraper/logs", async (_req, res) => {
    const { data, error } = await supabase
      .from("scraper_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/scraper/status", async (_req, res) => {
    // Last successful run
    const { data: lastRun } = await supabase
      .from("scraper_log")
      .select("scraped_at, status")
      .eq("content_type", "run_summary")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Counts
    const { count: meetingCount } = await supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .not("source_url", "is", null);

    const { count: docCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("source_url", "is", null);

    res.json({
      last_run: lastRun?.scraped_at ?? null,
      last_status: lastRun?.status ?? "never",
      scraped_meetings: meetingCount ?? 0,
      scraped_documents: docCount ?? 0,
    });
  });

  return httpServer;
}

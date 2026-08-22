"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  is_active?: boolean;
}

interface AttendeePreview {
  id: string;
  full_name: string;
  email: string;
}

export function EventManageList() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<EventItem | null>(null);
  const [attendees, setAttendees] = useState<AttendeePreview[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const cleanDate = dateStr.split("T")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      return `${parts[0]}. ${parts[1]}. ${parts[2]}.`;
    }
    return cleanDate;
  };

  const formatTimeDisplay = (start?: string, end?: string) => {
    if (!start && !end) return "";
    const s = start ? start.slice(0, 5) : "";
    const e = end ? end.slice(0, 5) : "";
    return `${s}–${e}`;
  };

  const handleOpenCancelModal = async (event: EventItem) => {
    setCancelTarget(event);
    setLoadingAttendees(true);

    const formattedDate = formatDateDisplay(event.event_date);
    setEmailSubject(`[ImiDance] Táncóra elmarad - ${formattedDate}`);
    setEmailBody(
      `Kedves {{nev}}!\n\nTájékoztatunk, hogy a(z) ${formattedDate} napra meghirdetett "${event.title}" táncóra elmarad.\n\nElnézést kérünk az esetleges kellemetlenségekért!\n\nÜdvözlettel,\nImiDance`
    );

    try {
      const res = await fetch(`/api/notify-event-cancelled?eventId=${event.id}`);
      const data = await res.json();
      if (data.recipients) {
        setAttendees(
          data.recipients.map((p: any) => ({
            id: p.id,
            full_name: p.full_name || "Táncos",
            email: p.email || "Nincs e-mail",
          }))
        );
      } else {
        setAttendees([]);
      }
    } catch {
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleConfirmInactivation = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/notify-event-cancelled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: cancelTarget.id,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Hiba történt az inaktiválás során.");
      }

      setEvents((prev) =>
        prev.map((e) => (e.id === cancelTarget.id ? { ...e, is_active: false } : e))
      );

      const sentCount = result.sent?.length || 0;
      const failCount = result.failed?.length || 0;

      alert(
        `Az esemény sikeresen inaktiválva lett.\nÉrtesítő elküldve: ${sentCount} fő${
          failCount > 0 ? `\nSikertelen: ${failCount} fő` : ""
        }`
      );
      setCancelTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ismeretlen hiba";
      alert(`Inaktiválni próbált eseménynél hiba lépett fel: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500">Események betöltése...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
        Hiba az események betöltésekor: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {events.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">Nincs megjeleníthető esemény.</p>
      ) : (
        events.map((event) => {
          const isCancelled = event.is_active === false;
          const formattedDate = formatDateDisplay(event.event_date);
          const timeRange = formatTimeDisplay(event.start_time, event.end_time);
          const locationName = event.location || "Roxy";

          if (isCancelled) {
            return (
              <div
                key={event.id}
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="bg-red-600 px-4 py-1.5 text-white font-bold text-xs tracking-wider uppercase">
                  TÖRÖLVE
                </div>
                <div className="p-4 text-zinc-400 line-through space-y-1">
                  <div className="text-base font-bold text-zinc-400">
                    {formattedDate}
                  </div>
                  <div className="text-sm">
                    {timeRange} · {locationName}
                  </div>
                  <div className="text-xs text-zinc-400">{event.title}</div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={event.id}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="text-lg font-bold text-zinc-900">
                  {formattedDate}
                </div>
                <div className="text-sm text-zinc-600">
                  {timeRange} · {locationName}
                </div>
                <div className="text-xs text-zinc-400">{event.title}</div>
              </div>
              <button
                onClick={() => handleOpenCancelModal(event)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Inaktiválás
              </button>
            </div>
          );
        })
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="border-b border-zinc-100 pb-3">
              <h3 className="text-xl font-bold text-zinc-900">
                Esemény inaktiválása & Értesítő kiküldése
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {formatDateDisplay(cancelTarget.event_date)} — {cancelTarget.title}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Értesítendő jelentkezettek ({attendees.length} fő)
              </label>
              {loadingAttendees ? (
                <div className="text-xs text-zinc-500 py-2">Jelentkezők betöltése...</div>
              ) : attendees.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Nincs egyetlen regisztrált jelentkező sem erre az alkalomra.
                </div>
              ) : (
                <div className="max-h-28 overflow-y-auto border border-zinc-200 rounded-lg p-2 divide-y divide-zinc-100 text-xs bg-zinc-50">
                  {attendees.map((a) => (
                    <div key={a.id} className="py-1 flex justify-between">
                      <span className="font-medium text-zinc-800">{a.full_name}</span>
                      <span className="text-zinc-500">{a.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                E-mail tárgya
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                E-mail sablon (szerkeszthető, használható: <code className="text-indigo-600">{"{{nev}}"}</code>)
              </label>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full border border-zinc-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-900 font-sans"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-100">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={submitting}
                className="px-4 py-2 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={handleConfirmInactivation}
                disabled={submitting}
                className="px-5 py-2 text-white bg-red-600 hover:bg-red-700 text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? "Inaktiválás és Küldés..." : "Jóváhagyás & Kiküldés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
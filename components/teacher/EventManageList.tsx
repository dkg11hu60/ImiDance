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
  location_id?: string;
  locations?: {
    id: string;
    name: string;
    address?: string;
    maps_url?: string;
  };
  is_active?: boolean;
  attendee_count?: number;
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
    const [eventsRes, attendancesRes] = await Promise.all([
      supabase
        .from("events")
        .select("*, locations(*)")
        .order("event_date", { ascending: true }),
      supabase
        .from("attendances")
        .select("id, event_id, status")
    ]);

    if (eventsRes.error) {
      setError(eventsRes.error.message);
    } else {
      const now = new Date();
      const allAtts = attendancesRes.data || [];

      // Számoljuk meg az egyes eseményekhez tartozó aktív (nem lemondott) jelentkezőket
      const attCountMap = new Map<string, number>();
      allAtts.forEach((a: any) => {
        const isActive = (a.status ?? "") !== "cancelled";
        if (isActive && a.event_id) {
          attCountMap.set(a.event_id, (attCountMap.get(a.event_id) || 0) + 1);
        }
      });

      // Csak azokat az eseményeket tartjuk meg, amelyeknek a vége KÉSŐBB van, mint a now()
      const validEvents = (eventsRes.data || [])
        .filter((event) => {
          const datePart = event.event_date ? event.event_date.split("T")[0] : "";
          const timePart = event.end_time || event.start_time || "23:59:59";
          const eventEnd = new Date(`${datePart}T${timePart}`);

          if (isNaN(eventEnd.getTime())) return true;

          // Látható marad, ameddig a now() pillanat nem jött el az esemény vége után
          return eventEnd > now;
        })
        .map((event) => ({
          ...event,
          attendee_count: attCountMap.get(event.id) || 0,
        }));

      setEvents(validEvents);
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
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    }
    return cleanDate;
  };

  const formatTimeDisplay = (start?: string, end?: string) => {
    const s = start ? start.slice(0, 5) : "";
    const e = end ? end.slice(0, 5) : "";
    if (s && e) return `${s} – ${e}`;
    if (s) return `${s}-tól`;
    return "Időpont nincs megadva";
  };

  const handleOpenCancelModal = async (event: EventItem) => {
    setCancelTarget(event);
    setLoadingAttendees(true);

    const formattedDate = formatDateDisplay(event.event_date);
    setEmailSubject(`[ImiDance] Táncóra elmarad - ${formattedDate}`);
    setEmailBody(
      `Kedves {{nev}}!\n\nTájékoztatunk, hogy a(z) ${formattedDate} napra meghirdetett "${event.title || 'Táncóra'}" táncóra elmarad.\n\nElnézést kérünk az esetleges kellemetlenségekért!\n\nÜdvözlettel,\nImiDance`
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

      // Helyben frissítjük inaktívvá, így azonnal átvált a TÖRÖLVE nézetre, de látható marad az idő lejártáig
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
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Alkalmak kezelése</h2>
          <p className="text-xs text-zinc-500">
            Közelgő táncórák részletes adatai, helyszíne, időpontja és létszáma.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full border border-zinc-200">
          Összesen {events.length} alkalom
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">Nincs megjeleníthető esemény.</p>
      ) : (
        events.map((event) => {
          const isCancelled = event.is_active === false;
          const formattedDate = formatDateDisplay(event.event_date);
          const timeRange = formatTimeDisplay(event.start_time, event.end_time);
          const locationName = event.locations?.name || event.location || "Roxy Stúdió";
          const locationAddress = event.locations?.address || "";
          const mapsUrl = event.locations?.maps_url || "";
          const attendeeCount = event.attendee_count || 0;

          return (
            <div
              key={event.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all overflow-hidden ${
                isCancelled ? "border-red-300 bg-red-50/20" : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              {isCancelled && (
                <div className="mb-4 -mx-5 -mt-5 bg-red-600 px-5 py-2 text-white font-extrabold text-xs tracking-wider uppercase flex items-center justify-between shadow-sm">
                  <span className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>TÖRÖLVE – AZ ÓRA ELMARAD</span>
                  </span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">Inaktív</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className={`space-y-2 min-w-0 flex-1 ${isCancelled ? "opacity-60" : ""}`}>
                  {/* Dátum & Cím */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`text-base sm:text-lg font-bold capitalize ${isCancelled ? "text-zinc-500 line-through" : "text-zinc-900"}`}>
                      {formattedDate}
                    </h3>
                    {event.title && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${isCancelled ? "bg-zinc-100 text-zinc-400 line-through" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                        {event.title}
                      </span>
                    )}
                  </div>

                  {/* Időpont és Helyszín részletesen */}
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm ${isCancelled ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      <span>🕒</span>
                      <span>Időpont: {timeRange}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-medium text-zinc-800 bg-zinc-50 px-2.5 py-1 rounded-lg border border-zinc-200">
                      <span>📍</span>
                      <span>Helyszín:</span>
                      {mapsUrl && !isCancelled ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-indigo-600 hover:underline"
                        >
                          {locationName}
                        </a>
                      ) : (
                        <strong className="font-bold text-zinc-900">{locationName}</strong>
                      )}
                      {locationAddress && (
                        <span className="text-zinc-400 text-xs font-normal">({locationAddress})</span>
                      )}
                    </div>
                  </div>

                  {/* Eddig jelentkezettek száma */}
                  <div className="pt-0.5 flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border ${
                        isCancelled
                          ? "bg-zinc-100 text-zinc-500 border-zinc-200"
                          : attendeeCount > 0
                          ? "bg-indigo-50 text-indigo-900 border-indigo-200 shadow-xs"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      <span className="text-sm">👥</span>
                      <span>
                        {isCancelled ? "Korábbi jelentkezők:" : "Eddig jelentkezett:"}{" "}
                        <strong className="text-base font-extrabold text-indigo-700">{attendeeCount} fő</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Műveleti gomb */}
                {!isCancelled ? (
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCancelModal(event)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Inaktiválás</span>
                    </button>
                  </div>
                ) : (
                  <div className="shrink-0">
                    <span className="px-3.5 py-1.5 bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl uppercase tracking-wider">
                      ✕ Törölve
                    </span>
                  </div>
                )}
              </div>
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
              <p className="text-sm text-zinc-600 mt-1">
                {formatDateDisplay(cancelTarget.event_date)} ({formatTimeDisplay(cancelTarget.start_time, cancelTarget.end_time)}) — {cancelTarget.locations?.name || cancelTarget.location || "Roxy Stúdió"}
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
                <div className="max-h-40 overflow-y-auto border border-zinc-200 rounded-xl p-3 bg-zinc-50 space-y-1.5">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="text-xs flex items-center justify-between text-zinc-700 py-0.5 border-b border-zinc-100 last:border-b-0"
                    >
                      <span className="font-medium text-zinc-900">{attendee.full_name}</span>
                      <span className="text-zinc-400 font-mono text-[11px]">{attendee.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Értesítő E-mail Tárgya
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Értesítő E-mail Szövege
              </label>
              <textarea
                rows={5}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
              <span className="text-[11px] text-zinc-400 block">
                A <code>{"{{nev}}"}</code> helyére a táncos neve kerül beillesztésre.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={submitting}
                className="px-4 py-2 border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={handleConfirmInactivation}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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

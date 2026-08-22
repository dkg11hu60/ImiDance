"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  description?: string;
  location_id?: string;
  is_active?: boolean;
}

export function EventAdmin() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, event_date, description, location_id, is_active")
      .order("event_date", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      // Csak az INAKTÍV eseményeket szűrjük ki (ahol az is_active hamis vagy nem aktív)
      const inactiveEvents = (data || []).filter((e) => e.is_active === false);
      setEvents(inactiveEvents);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

const handleDeleteEvent = async (id: string) => {
    if (!confirm("Biztosan véglegesen ki akarod takarítani ezt az inaktív eseményt az adatbázisból?")) {
      return;
    }

    try {
      const response = await fetch("/api/delete-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Hiba történt a törlés során.");
      }

      setEvents((prev) => prev.filter((e) => e.id !== id));
      alert("Az esemény sikeresen kitakarítva az adatbázisból!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ismeretlen hiba";
      alert(`Törlési hiba: ${msg}`);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500">Események betöltése...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">Hiba: {error}</div>;
  }

  return (
    <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 text-lg">Inaktív események takarítása</h3>
          <p className="text-sm text-zinc-500">Csak a már inaktivált események láthatók itt (az aktívak védve vannak).</p>
        </div>
      </div>

      <div className="border border-zinc-100 rounded-lg overflow-hidden divide-y divide-zinc-100">
        {events.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic">Nincs inaktív, törölhető esemény.</div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
              <div>
                <h4 className="font-medium text-zinc-800">{event.title}</h4>
                <p className="text-xs text-zinc-500">
                  {new Date(event.event_date).toLocaleString()} &bull; {event.description || "Nincs leírás"}
                </p>
              </div>
              <button
                onClick={() => handleDeleteEvent(event.id)}
                className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
              >
                Végleges törlés
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
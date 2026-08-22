"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EventItem {
  id: string;
  title: string;
  event_date: string;
  description?: string;
  location_id?: string;
}

export function EventAdmin() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, event_date, description, location_id")
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

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Biztosan törölni szeretnéd ezt az eseményt?")) return;

    // 1. Lépés: Kapcsolódó attendances rekordok törlése
    const { error: attendancesError } = await supabase
      .from("attendances")
      .delete()
      .eq("event_id", id);

    if (attendancesError) {
      alert(`Hiba az attendances törlésekor: ${attendancesError.message}`);
      return;
    }
    alert("1. Lépés: Kapcsolódó jelenlétek (attendances) sikeresen törölve.");

    // 2. Lépés: Kapcsolódó activity_logs rekordok törlése
    const { error: logsError } = await supabase
      .from("activity_logs")
      .delete()
      .eq("event_id", id);

    if (logsError) {
      alert(`Hiba az activity_logs törlésekor: ${logsError.message}`);
      return;
    }
    alert("2. Lépés: Kapcsolódó tevékenységnaplók (activity_logs) sikeresen törölve.");

    // 3. Lépés: Maga az esemény törlése az events táblából
    const { error: eventError } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (eventError) {
      alert(`Hiba az esemény törlésekor: ${eventError.message}`);
    } else {
      alert("3. Lépés: Az esemény sikeresen törölve az adatbázisból.");
      setEvents(events.filter((e) => e.id !== id));
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
          <h3 className="font-semibold text-zinc-900 text-lg">Események kezelése</h3>
          <p className="text-sm text-zinc-500">A rendszerben található események listája.</p>
        </div>
      </div>

      <div className="border border-zinc-100 rounded-lg overflow-hidden divide-y divide-zinc-100">
        {events.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic">Nincs rögzített esemény.</div>
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
                Törlés
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
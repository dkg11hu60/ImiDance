"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  capacity: number;
}

export function EventAdmin() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, title, date, location, capacity")
      .order("date", { ascending: true });

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

    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      alert(`Hiba törléskor: ${error.message}`);
    } else {
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
                  {new Date(event.date).toLocaleString()} &bull; {event.location || "Helyszín nélkül"} (Férőhely: {event.capacity})
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
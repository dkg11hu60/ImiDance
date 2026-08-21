"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserAdmin } from "./UserAdmin";
import { RoleAdmin } from "./RoleAdmin";
import { EmailTester } from "./EmailTester";

export function AdminPanel() {
  const [section, setSection] = useState<
    "users" | "roles" | "email" | "maintenance"
  >("users");
  const [status, setStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [testItems, setTestItems] = useState<
    { id: string; name: string; table: string }[]
  >([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadTestItems = async () => {
    const { data: events } = await supabase
      .from("events")
      .select("id, title")
      .ilike("title", "%teszt%");
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or("full_name.ilike.%teszt%,email.ilike.%teszt%");

    const combined: { id: string; name: string; table: string }[] = [];

    if (events) {
      combined.push(
        ...events.map((e) => ({ id: e.id, name: e.title, table: "events" })),
      );
    }

    if (profs) {
      combined.push(
        ...profs.map((p) => ({
          id: p.id,
          name: `${p.full_name || "Névtelen"} (${p.email})`,
          table: "profiles",
        })),
      );
    }

    setTestItems(combined);
  };

  const handleDeleteSelected = async () => {
    setStatus({ message: "Törlés folyamatban...", isError: false });

    const itemsToDelete = testItems.filter((i) => selectedIds.has(i.id));

    try {
      const res = await fetch("/api/delete-test-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToDelete }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({
          message: data.error || "Hiba történt a törlés során.",
          isError: true,
        });
      } else {
        setStatus({ message: "Sikeresen törölve!", isError: false });
        setSelectedIds(new Set());
        await loadTestItems();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Hálózati hiba.";
      setStatus({ message: msg, isError: true });
    }

    setTimeout(() => setStatus(null), 4000);
  };

  return (
    <div className="space-y-6">
      {status && (
        <div
          className={`p-4 rounded-lg font-medium text-sm ${status.isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
        >
          {status.message}
        </div>
      )}

      <div className="flex gap-2 sticky top-32 bg-zinc-50 py-2 z-10">
        <button
          onClick={() => setSection("users")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === "users" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          Felhasználók
        </button>
        <button
          onClick={() => setSection("roles")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === "roles" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          Szerepek
        </button>
        <button
          onClick={() => setSection("email")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === "email" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          E-mail teszt
        </button>
        <button
          onClick={() => {
            setSection("maintenance");
            loadTestItems();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${section === "maintenance" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          Karbantartás
        </button>
      </div>

      {section === "users" && <UserAdmin />}
      {section === "roles" && <RoleAdmin />}
      {section === "email" && <EmailTester />}

      {section === "maintenance" && (
        <div className="p-6 bg-white border border-zinc-200 rounded-xl space-y-4">
          <h3 className="font-semibold text-zinc-900">
            Teszt adatok kijelölése törlésre
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {testItems.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">
                Nincs törölhető teszt adat.
              </p>
            ) : (
              testItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      e.target.checked
                        ? next.add(item.id)
                        : next.delete(item.id);
                      setSelectedIds(next);
                    }}
                    className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-700">
                    {item.name}{" "}
                    <span className="text-zinc-400">({item.table})</span>
                  </span>
                </label>
              ))
            )}
          </div>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-opacity"
          >
            Kijelöltek törlése ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}

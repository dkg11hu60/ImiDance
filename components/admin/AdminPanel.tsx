"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserAdmin } from "./UserAdmin";
import { RoleAdmin } from "./RoleAdmin";
import { EmailTester } from "./EmailTester";
import { EventAdmin } from "./EventAdmin";

export function AdminPanel() {
  const [activeSection, setActiveSection] = useState<
    "users" | "roles" | "email" | "events" | "maintenance"
  >("users");
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const [testEvents, setTestEvents] = useState<{ id: string; title: string }[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  const [testUsers, setTestUsers] = useState<{ id: string; email: string; fullName: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const loadMaintenanceData = async () => {
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title")
      .ilike("title", "%teszt%");
    if (eventsData) setTestEvents(eventsData);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .or("full_name.ilike.%teszt%,email.ilike.%teszt%");
    if (profilesData) {
      setTestUsers(
        profilesData.map((p) => ({
          id: p.id,
          email: p.email || "",
          fullName: p.full_name || "Névtelen",
        }))
      );
    }
  };

  const handleSilentlyDeleteEvents = async () => {
    setStatusMessage({ text: "Silently deleting selected events...", isError: false });
    try {
      const itemsToDelete = testEvents.filter((e) => selectedEventIds.has(e.id));
      const response = await fetch("/api/delete-test-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToDelete.map((i) => ({ id: i.id, table: "events" })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStatusMessage({ text: result.error || "Failed to delete events.", isError: true });
      } else {
        setStatusMessage({ text: "Selected events successfully deleted.", isError: false });
        setSelectedEventIds(new Set());
        await loadMaintenanceData();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Network error.";
      setStatusMessage({ text: errorMessage, isError: true });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSilentlyDeleteUsers = async () => {
    setStatusMessage({ text: "Silently deleting selected users...", isError: false });
    try {
      const itemsToDelete = testUsers.filter((u) => selectedUserIds.has(u.id));
      const response = await fetch("/api/delete-test-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToDelete.map((i) => ({ id: i.id, table: "profiles" })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setStatusMessage({ text: result.error || "Failed to delete users.", isError: true });
      } else {
        setStatusMessage({ text: "Selected users successfully deleted.", isError: false });
        setSelectedUserIds(new Set());
        await loadMaintenanceData();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Network error.";
      setStatusMessage({ text: errorMessage, isError: true });
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div
          className={`p-4 rounded-lg font-medium text-sm ${
            statusMessage.isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Navigation Menu */}
      <div className="flex gap-2 sticky top-32 bg-zinc-50 py-2 z-10 overflow-x-auto">
        <button
          onClick={() => setActiveSection("users")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            activeSection === "users" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          Felhasználók
        </button>
        <button
          onClick={() => setActiveSection("roles")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            activeSection === "roles" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          Szerepek
        </button>
        <button
          onClick={() => setActiveSection("email")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            activeSection === "email" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          E-mail teszt
        </button>
        <button
          onClick={() => setActiveSection("events")}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            activeSection === "events" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          Események
        </button>
        <button
          onClick={() => {
            setActiveSection("maintenance");
            loadMaintenanceData();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
            activeSection === "maintenance" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          Karbantartás
        </button>
      </div>

      {/* Section Renders */}
      {activeSection === "users" && <UserAdmin />}
      {activeSection === "roles" && <RoleAdmin />}
      {activeSection === "email" && <EmailTester />}
      {activeSection === "events" && <EventAdmin />}

      {activeSection === "maintenance" && (
        <div className="space-y-6">
          {/* Card 1: Silently delete selected events */}
          <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
            <div>
              <h3 className="font-semibold text-zinc-900 text-lg">
                Silently delete selected events
              </h3>
              <p className="text-sm text-zinc-500">
                Select test events to delete silently.
              </p>
            </div>

            <div className="border border-zinc-100 rounded-lg overflow-hidden divide-y divide-zinc-100 max-h-48 overflow-y-auto">
              {testEvents.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500 italic">
                  No test events found.
                </div>
              ) : (
                testEvents.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventIds.has(event.id)}
                      onChange={(e) => {
                        const next = new Set(selectedEventIds);
                        e.target.checked ? next.add(event.id) : next.delete(event.id);
                        setSelectedEventIds(next);
                      }}
                      className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-zinc-800">{event.title}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSilentlyDeleteEvents}
                disabled={selectedEventIds.size === 0}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-opacity shadow-sm"
              >
                Silently delete selected events ({selectedEventIds.size})
              </button>
            </div>
          </div>

          {/* Card 2: Silently delete selected users */}
          <div className="p-6 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-4">
            <div>
              <h3 className="font-semibold text-zinc-900 text-lg">
                Silently delete selected users
              </h3>
              <p className="text-sm text-zinc-500">
                Select test users to delete silently.
              </p>
            </div>

            <div className="border border-zinc-100 rounded-lg overflow-hidden divide-y divide-zinc-100 max-h-48 overflow-y-auto">
              {testUsers.length === 0 ? (
                <div className="p-4 text-sm text-zinc-500 italic">
                  No test users found.
                </div>
              ) : (
                testUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={(e) => {
                        const next = new Set(selectedUserIds);
                        e.target.checked ? next.add(user.id) : next.delete(user.id);
                        setSelectedUserIds(next);
                      }}
                      className="w-4 h-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-zinc-800">
                      {user.fullName} <span className="text-zinc-400 font-normal">({user.email})</span>
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSilentlyDeleteUsers}
                disabled={selectedUserIds.size === 0}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-opacity shadow-sm"
              >
                Silently delete selected users ({selectedUserIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
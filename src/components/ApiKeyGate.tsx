import { useState } from "react";
import { listFolders, setApiKey } from "../api/client";

/**
 * The UI authenticates with the same bearer key the agent uses. It is pasted
 * once, kept in localStorage, and attached to every API request.
 */
export function ApiKeyGate({ onUnlocked }: { onUnlocked: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = key.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setError(null);
    setApiKey(trimmed);
    try {
      await listFolders(); // any authed call verifies the key
      onUnlocked(trimmed);
    } catch {
      setApiKey(null);
      setError("That key was rejected by the server.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-cream-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-ink-900">Agent Notes</h1>
        <p className="mt-2 text-sm text-ink-500">
          Paste the API key this app shares with your research agent. It is
          stored only in this browser.
        </p>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="API key"
            autoFocus
            className="rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-sm outline-none focus:border-ink-500"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={checking || !key.trim()}
            className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-cream-50 hover:bg-ink-700 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

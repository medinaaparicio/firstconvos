import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

/** Shared shell so every placeholder looks the same. Delete as you build real screens. */
function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold text-indigo-600">{title}</h1>
      <div className="mt-4 space-y-2 text-slate-700">{children}</div>
    </main>
  );
}

export function LearnPage() {
  return <Page title="Learn">Fingerspelling lessons go here.</Page>;
}

export function PlayPage() {
  return <Page title="Play">The charades game goes here.</Page>;
}

export function JoinPage() {
  const { code } = useParams<{ code: string }>();
  return <Page title="Join a game">Joining room code: {code}</Page>;
}

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <Link to="/" className="underline">
        Go home
      </Link>
    </Page>
  );
}

/**
 * TEMPORARY stand-in for Sofia's HandTrackerSpike.
 *
 * That component does not exist in the repo yet (checked the working tree, all
 * branches, and the git history). Once she pushes it, delete this component and
 * follow the TODO in AppRoutes.tsx to point /spike at the real one.
 */
export function SpikePlaceholder() {
  return (
    <Page title="Hand tracker spike">
      <p>
        Sofia's <code>HandTrackerSpike</code> component hasn't landed yet. This
        route is already wired up and unprotected, so it will work as soon as
        the file exists -- see the TODO in <code>src/app/AppRoutes.tsx</code>.
      </p>
    </Page>
  );
}

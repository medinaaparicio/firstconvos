import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  HomePage,
  JoinPage,
  LearnPage,
  LoginPage,
  NotFoundPage,
  PlayPage,
  SpikePlaceholder,
} from "./pages/Placeholders";

/*
 * TODO(Sofia's spike): HandTrackerSpike does not exist in the repo yet.
 * When she pushes it, make these two changes and nothing else:
 *   1. import HandTrackerSpike from "../recognition/HandTrackerSpike";
 *      (adjust the path to wherever the file actually lands)
 *   2. In the /spike route below, swap <SpikePlaceholder /> for
 *      <HandTrackerSpike />, and drop SpikePlaceholder from the import above.
 * Keep /spike outside <ProtectedRoute> so her work stays reachable logged out.
 */

export function AppRoutes() {
  return (
    <Routes>
      {/* --- Public: no login needed --- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/spike" element={<SpikePlaceholder />} />

      {/* --- Protected: logged-out visitors get sent to /login --- */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <LearnPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <PlayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/join/:code"
        element={
          <ProtectedRoute>
            <JoinPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

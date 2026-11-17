import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  JoinPage,
  LearnPage,
  NotFoundPage,
  PlayPage,
} from "./pages/Placeholders";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage } from "../features/home/HomePage";
import HandTrackerSpike from "../recognition/HandTrackerSpike";

// /spike stays outside <ProtectedRoute> so the recognition dev page is
// reachable while logged out.

export function AppRoutes() {
  return (
    <Routes>
      {/* --- Public: no login needed --- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/spike" element={<HandTrackerSpike />} />

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

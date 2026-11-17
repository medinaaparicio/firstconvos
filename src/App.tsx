import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./app/AuthProvider";
import { AppRoutes } from "./app/AppRoutes";

/*
 * Order matters here:
 *   BrowserRouter  -- turns the URL bar into something React can read
 *     AuthProvider -- needs to be inside the router so ProtectedRoute can
 *                     redirect, and outside the routes so every screen can
 *                     call useAuth()
 *       AppRoutes  -- the actual URL -> screen table
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

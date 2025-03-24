import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/home";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import UserDetails from "@/pages/user-details";
import ChatDetails from "@/pages/chat-details";
import NotFound from "@/pages/not-found";

// 路由保护组件
function ProtectedRoute({ component: Component, adminOnly = false, ...rest }: any) {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    return <Redirect to="/login" />;
  }

  const user = JSON.parse(userStr);
  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  if (!adminOnly && user.role === "admin") {
    return <Redirect to="/admin" />;
  }

  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" exact>
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/admin" exact>
        <ProtectedRoute component={AdminDashboard} adminOnly />
      </Route>
      <Route path="/admin/users/:id">
        <ProtectedRoute component={UserDetails} adminOnly />
      </Route>
      <Route path="/admin/chats/:id">
        <ProtectedRoute component={ChatDetails} adminOnly />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
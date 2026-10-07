import { Route, Switch } from "wouter";
import Admin from "./pages/Admin";
import Home from "./pages/Home";

export default function App() {
  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route component={Home} />
    </Switch>
  );
}

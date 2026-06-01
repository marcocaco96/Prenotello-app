import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/agenda" });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-3 shadow-sm">
            <Scissors className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Prenotello</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione prenotazioni per professionisti</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Accedi</CardTitle>
            <CardDescription>Entra nel tuo account per gestire l'agenda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Accesso in corso..." : "Accedi"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Non hai un account?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Registrati
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

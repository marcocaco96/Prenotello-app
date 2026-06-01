import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/agenda` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registrazione completata! Controlla la tua email per confermare.");
    navigate({ to: "/login" });
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
            <CardTitle>Crea account</CardTitle>
            <CardDescription>Inizia gratis a gestire le tue prenotazioni</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">Minimo 6 caratteri</p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creazione in corso..." : "Crea account"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-6">
              Hai già un account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Accedi
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

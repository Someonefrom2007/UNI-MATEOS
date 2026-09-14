import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import ClosingCTA from "@/components/landing/ClosingCTA";

export default function Landing() {
  const { user, isLoadingAuth } = useAuth();
  const authed = !isLoadingAuth && !!user;

  return (
    <div className="min-h-screen space-bg text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <Link to="/">
            <Logo size={34} />
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Button asChild size="sm"><Link to="/dashboard">Go to dashboard</Link></Button>
            ) : (
              <Button asChild size="sm"><Link to="/register">Start free</Link></Button>
            )}
          </div>
        </div>
      </header>

      <Hero authed={authed} />
      <Features />
      <ClosingCTA authed={authed} />

      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={22} showText={false} />
            <span className="text-sm text-muted-foreground">UNI·MATE — the academic OS for university life.</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
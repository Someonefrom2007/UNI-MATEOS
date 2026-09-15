import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { navSections } from "@/components/landing/sections";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import Manifesto from "@/components/landing/Manifesto";
import Product from "@/components/landing/Product";
import Intelligence from "@/components/landing/Intelligence";
import Planning from "@/components/landing/Planning";
import FocusLanding from "@/components/landing/FocusLanding";
import CommunityLanding from "@/components/landing/CommunityLanding";
import Privacy from "@/components/landing/Privacy";
import Future from "@/components/landing/Future";
import ClosingCTA from "@/components/landing/ClosingCTA";

export default function Landing() {
  const { user, isLoadingAuth } = useAuth();
  const authed = !isLoadingAuth && !!user;
  const nav = navSections();

  return (
    <div className="min-h-screen space-bg text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-40 h-16 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <Logo size={34} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Landing">
            {nav.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="transition-colors hover:text-foreground">
                {s.nav}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Button asChild size="sm">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/register">Start free</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Hero authed={authed} />
        <Problem />
        <Manifesto />
        <Product />
        <Intelligence />
        <Planning />
        <FocusLanding />
        <CommunityLanding />
        <Privacy />
        <Future />
        <ClosingCTA authed={authed} />
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={22} showText={false} />
            <span className="text-sm text-muted-foreground">UNI·MATE — the academic OS for university life.</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/login" className="transition-colors hover:text-foreground">Sign in</Link>
            <Link to="/register" className="transition-colors hover:text-foreground">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
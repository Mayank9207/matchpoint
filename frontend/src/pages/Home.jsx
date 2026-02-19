import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { MapPin, Users, Trophy, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_-10%,oklch(0.7_0.18_50/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.7_0.18_50/0.08),transparent_40%,oklch(0_0_0))]" />
        <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-160px] right-[-120px] h-[420px] w-[420px] rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10 container mx-auto px-6 pt-28 pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
                Matchpoint • Local Sports Network
              </div>
              <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
                <span className="text-balance">Find Your</span>
                <br />
                <span className="text-primary">Perfect Match</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
                Discover nearby games, connect with teammates, and keep your competitive edge sharp with a community built for athletes.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg shadow-[0_0_25px_oklch(0.7_0.18_50/0.3)]"
                >
                  <Link to="/register">
                    Get Started
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 bg-transparent border-border hover:bg-secondary text-foreground font-semibold text-lg"
                >
                  <Link to="/login">Sign In</Link>
                </Button>
              </div>
            </div>

            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard value="50K+" label="Active Players" />
              <StatCard value="120+" label="Cities" />
              <StatCard value="15+" label="Sports" />
              <StatCard value="10K+" label="Weekly Matches" />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything you need to <span className="text-primary">play</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">
              From finding games to tracking your progress, we have got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<MapPin className="w-6 h-6" />}
              title="Local Matches"
              description="Discover pickup games, tournaments, and casual matches happening right in your neighborhood."
            />
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="Build Your Squad"
              description="Connect with players at your skill level and build a reliable team for regular games."
            />
            <FeatureCard
              icon={<Trophy className="w-6 h-6" />}
              title="Track Progress"
              description="Monitor your stats, climb the leaderboards, and celebrate your achievements."
            />
          </div>
        </div>
      </section>

      {/* Experience Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Built for athletes
              </div>
              <h2 className="mt-6 text-3xl md:text-4xl font-bold">
                One place to manage your <span className="text-primary">entire game week</span>
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl">
                Create match listings, organize availability, and keep the post-game highlights together so you never lose momentum.
              </p>
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card/80 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Smart matching</p>
                  <p className="mt-3 text-lg font-semibold">Find players that fit your level and schedule.</p>
                </div>
                <div className="rounded-xl border border-border bg-card/80 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Team momentum</p>
                  <p className="mt-3 text-lg font-semibold">Build lineups that stick week after week.</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-2xl" />
              <div className="relative rounded-3xl border border-border bg-card/80 p-8 backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Live sessions</p>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Now</span>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground">Tonight • 7:30 PM</p>
                    <p className="mt-2 text-lg font-semibold">Downtown Arena • 5v5 Run</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground">Wednesday • 6:00 PM</p>
                    <p className="mt-2 text-lg font-semibold">Riverside Park • Tennis Ladder</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <p className="text-sm text-muted-foreground">Saturday • 9:00 AM</p>
                    <p className="mt-2 text-lg font-semibold">City Gym • HIIT Circuit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="bg-card rounded-2xl border border-border p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Ready to find your <span className="text-primary">game</span>?
              </h2>
              <p className="mt-4 text-muted-foreground max-w-md mx-auto">
                Join thousands of players already using Matchpoint to find their next match.
              </p>
              <Button asChild size="lg" className="mt-8 h-14 px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg">
                <Link to="/register">
                  Create Free Account
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}) {
  return (
    <div className="bg-card/80 rounded-2xl border border-border p-8 hover:border-primary/50 transition-colors backdrop-blur">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-3">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5 text-center backdrop-blur">
      <p className="text-3xl md:text-4xl font-bold text-primary">{value}</p>
      <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    </div>
  );
}

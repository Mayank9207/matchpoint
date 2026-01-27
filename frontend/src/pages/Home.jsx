import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { MapPin, Users, Trophy, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 container mx-auto px-6 pt-32 pb-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight">
              <span className="text-balance">Find Your</span>
              <br />
              <span className="text-primary">Perfect Match</span>
            </h1>
            <p className="mt-6 text-xl text-muted-foreground max-w-xl mx-auto">
              Join the ultimate sports community. Discover local games, connect with players, and never miss a match.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg">
                <Link to="/register">
                  Get Started
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 bg-transparent border-border hover:bg-secondary text-foreground font-semibold text-lg">
                <Link to="/login">
                  Sign In
                </Link>
              </Button>
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

      {/* Stats Section */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard value="50K+" label="Active Players" />
            <StatCard value="120+" label="Cities" />
            <StatCard value="15+" label="Sports" />
            <StatCard value="10K+" label="Weekly Matches" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-6">
          <div className="bg-card rounded-2xl border border-border p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
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
    <div className="bg-card rounded-xl border border-border p-8 hover:border-primary/50 transition-colors">
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
    <div className="text-center">
      <p className="text-4xl md:text-5xl font-bold text-primary">{value}</p>
      <p className="mt-2 text-muted-foreground">{label}</p>
    </div>
  );
}
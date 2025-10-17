import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ExternalLink } from "lucide-react";
import LogoHorizontal from "@/assets/Logo Horizontal.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="container flex items-center justify-between py-6 overflow-hidden">
        <div className="flex items-center">
          <img src={LogoHorizontal} alt="Promptrix" className="h-8 w-auto max-w-[180px] object-contain" />
        </div>
        <nav className="flex items-center gap-3">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View Public Prompts
          </a>
          <a href="/signin">
            <Button className="font-semibold" variant="default">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="container grid gap-6 py-16 md:grid-cols-2">
        <div className="flex flex-col justify-center">
          <h1 className="font-title text-4xl md:text-5xl">
            One‑stop portal to manage & share prompts & workflows
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Design, iterate, and publish prompts that your team can trust.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/signin">
              <Button size="lg" className="font-semibold">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
            <a href="#features">
              <Button size="lg" variant="outline" className="font-semibold">
                Explore examples
                <ExternalLink className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="relative rounded-2xl bg-transparent p-16 border shadow-glow">
            <img src="/promptrix_logo.svg" alt="Promptrix logo large" className="h-32 w-32 md:h-40 md:w-40" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-12">
        <div className="mb-6">
          <h2 className="font-title text-3xl">Core Features</h2>
          <p className="mt-2 text-muted-foreground">Organize, publish, and iterate quickly.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Organize your prompts</CardTitle>
              <CardDescription>Curate versions, tags, and ownership — all in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>Version history and publishing</li>
                <li>Tags and quick search</li>
                <li>Ownership and roles</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Publish with one link</CardTitle>
              <CardDescription>Share read‑only prompts publicly; let others copy or save.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>Public link with live or fixed version</li>
                <li>Optional expiry and copy control</li>
                <li>Invite users with view or edit</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Test in chat</CardTitle>
              <CardDescription>Run prompts in a chat interface and iterate fast.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>Rapid iteration loop</li>
                <li>Conversation history</li>
                <li>Easy handoff to your team</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Upcoming */}
      <section className="container py-12">
        <div className="mb-6">
          <h2 className="font-title text-3xl">Upcoming Features</h2>
          <p className="mt-2 text-muted-foreground">What we're building next.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <ul className="grid gap-2 text-sm">
                <li>Evaluate prompt performance</li>
                <li>Create prompt chaining / workflows</li>
                <li>Manage & collect prompts as a team</li>
                <li>Bring Your Own Key (BYOK)</li>
                <li>Integrate with n8n or other automation platforms</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16">
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <h3 className="font-title text-2xl">Build a reliable prompt practice</h3>
          <p className="mt-2 text-muted-foreground">Start organizing, sharing, and iterating today.</p>
          <div className="mt-6">
            <a href="/signin">
              <Button size="lg" className="font-semibold">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container border-t py-8 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>© PROMPTRIX</span>
          <nav className="flex items-center gap-4">
            <a href="/docs" className="hover:text-foreground">Docs</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="https://github.com" className="hover:text-foreground">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Index;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <header className="container py-8">
        <h1 className="font-title text-3xl">Terms & Conditions</h1>
        <p className="mt-2 text-muted-foreground">Last updated: October 17, 2025</p>
      </header>

      <main className="container max-w-3xl pb-16">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Agreement to Terms</CardTitle>
            <CardDescription>
              This is a placeholder terms page. Replace with your actual terms when ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Use of Service</h2>
              <p>
                You agree to use the service in compliance with applicable laws and not to
                misuse the platform, attempt to disrupt operations, or infringe on others’ rights.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials
                and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Intellectual Property</h2>
              <p>
                Content and materials provided by the service remain the property of their respective
                owners. You retain rights to your own content.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Changes to Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of the service after
                changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Contact</h2>
              <p>
                Questions? Reach us at <a className="underline" href="mailto:support@example.com">support@example.com</a>.
              </p>
            </section>

            <div className="pt-4">
              <a href="/">
                <Button variant="outline">Return to Home</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Terms;
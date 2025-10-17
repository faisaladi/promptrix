import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <header className="container py-8">
        <h1 className="font-title text-3xl">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">Last updated: October 17, 2025</p>
      </header>

      <main className="container max-w-3xl pb-16">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Your privacy matters</CardTitle>
            <CardDescription>
              This is a placeholder privacy policy. Replace this content with your actual policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h2 className="font-semibold text-foreground">Information we collect</h2>
              <p>
                We may collect account information (such as email), usage data, and content you upload or
                create while using the service.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">How we use information</h2>
              <p>
                Information is used to provide and improve the service, authenticate users, and ensure the
                security and reliability of the platform.
              </p>
            </section>

            <section>
              <h2 className="font-semibold text-foreground">Data retention</h2>
              <p>
                We retain data for as long as necessary to provide the service and comply with legal
                obligations. You can request deletion of your account and associated data.
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

export default Privacy;
import { requireRole } from "@/lib/session";
import { AIChat } from "@/components/ai/ai-chat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Zap, History } from "lucide-react";

export const metadata = {
  title: "AI Assistant | WD Logistics",
  description: "AI-powered assistant for logistics operations",
};

export default async function AIPage() {
  const session = await requireRole(["admin", "supervisor", "staff"]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Get instant answers about your logistics operations
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 overflow-hidden">
          <AIChat organizationId={session.organizationId} />
        </div>

        {/* Sidebar with quick actions */}
        <div className="hidden w-80 border-l bg-muted/30 p-4 lg:block">
          <Tabs defaultValue="actions" className="h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="actions">
                <Zap className="mr-1 h-4 w-4" />
                Actions
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="mr-1 h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="actions" className="mt-4 space-y-4">
              <QuickActionCard
                title="Fleet Overview"
                description="Check truck availability and status"
                prompts={[
                  "Show all active trucks",
                  "Which trucks are in repair?",
                  "Check truck performance this month",
                ]}
              />
              <QuickActionCard
                title="Trip Management"
                description="View and manage trips"
                prompts={[
                  "What trips are scheduled today?",
                  "Show upcoming trips for this week",
                  "Trip summary for last month",
                ]}
              />
              <QuickActionCard
                title="Financial Insights"
                description="Revenue and expense analysis"
                prompts={[
                  "Show overdue invoices",
                  "Revenue summary this month",
                  "Which customers have outstanding balances?",
                ]}
              />
              <QuickActionCard
                title="Driver Info"
                description="Driver availability and alerts"
                prompts={[
                  "Which drivers are available today?",
                  "Check expiring licenses",
                  "Driver performance stats",
                ]}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    Recent conversations will appear here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  prompts: string[];
}

function QuickActionCard({ title, description, prompts }: QuickActionCardProps) {
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="space-y-1">
          {prompts.map((prompt, i) => (
            <button
              key={i}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

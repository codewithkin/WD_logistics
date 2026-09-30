import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Clock, Globe } from "lucide-react";

/**
 * What the system does about money and time.
 *
 * This used to be two dropdowns — Currency and Timezone — with a Save button
 * that reported "Settings updated successfully". Neither value was ever read
 * again. Every figure in the app, on every invoice, in every report and in
 * every email is formatted as USD by `formatCurrency`, and every date is
 * rendered in whatever timezone the person's own browser is in. So an admin
 * could set the currency to Kenyan Shilling, be told it had worked, and watch
 * nothing change — the worst kind of setting, because it is believed.
 *
 * The list did not even offer the country the business is in: Africa/Harare
 * was missing while Africa/Nairobi and the Kenyan Shilling were both there,
 * left over from the demo data this was built against.
 *
 * Rather than wire a second currency through a system that invoices in
 * dollars, this says plainly what happens. If the client ever does need to
 * invoice in ZWG, that is a real piece of work — the rate, the rounding, the
 * figure on a statement that spans a change — and not a dropdown.
 */
export function GeneralSettings() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Money and time</CardTitle>
                <CardDescription>
                    How this system handles figures and dates. None of it is configurable,
                    and saying so is more use than a setting that does nothing.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex items-start gap-3">
                    <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Everything is in US dollars</p>
                        <p className="text-sm text-muted-foreground">
                            Invoices, statements, expenses, reports and the WhatsApp assistant
                            all show USD. Amounts are stored as entered — the system does no
                            conversion, so enter what was actually charged or paid.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Times show in your own timezone</p>
                        <p className="text-sm text-muted-foreground">
                            Every date and time is rendered on the device reading it, so a
                            driver&apos;s phone and the office screen agree about when something
                            happened without either of them setting anything.
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">The business day runs on Harare time</p>
                        <p className="text-sm text-muted-foreground">
                            Anything that has to pick a day rather than a moment — the
                            assistant&apos;s monthly message allowance, a daily digest, a
                            period that ends &quot;today&quot; — uses Central Africa Time, so a
                            record entered at half past ten at night lands on the day it was
                            entered.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

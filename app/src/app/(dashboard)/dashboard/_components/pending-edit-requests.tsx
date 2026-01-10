import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ClipboardEdit } from "lucide-react";

interface PendingEditRequestsProps {
    count: number;
}

export function PendingEditRequests({ count }: PendingEditRequestsProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <ClipboardEdit className="h-5 w-5" />
                    Pending Edit Requests
                </CardTitle>
                <Link href="/edit-requests">
                    <Button variant="ghost" size="sm">
                        Review <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent>
                <div className="text-center py-4">
                    <p className="text-4xl font-bold text-orange-500">{count}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        requests awaiting your approval
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

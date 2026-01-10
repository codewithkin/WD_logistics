import { LucideIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export interface PageHeaderProps {
    title: string;
    description?: string;
    backHref?: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
        icon?: LucideIcon;
    };
    children?: React.ReactNode;
}

export function PageHeader({ title, description, backHref, action, children }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between pb-6">
            <div className="flex items-center gap-4">
                {backHref && (
                    <Link href={backHref}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                )}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground">{description}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {children}
                {action && (
                    action.href ? (
                        <Link href={action.href}>
                            <Button>
                                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                {action.label}
                            </Button>
                        </Link>
                    ) : (
                        <Button onClick={action.onClick}>
                            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                            {action.label}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
}

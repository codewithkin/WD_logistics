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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4 min-w-0">
                {backHref && (
                    <Link href={backHref}>
                        <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform duration-300 shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                )}
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text truncate">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground mt-1 text-sm sm:text-base">{description}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {children}
                {action && (
                    action.href ? (
                        <Link href={action.href} className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                {action.label}
                            </Button>
                        </Link>
                    ) : (
                        <Button onClick={action.onClick} className="w-full sm:w-auto transition-all duration-300 hover:scale-105 hover:shadow-lg">
                            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                            {action.label}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
}

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
        <div className="flex items-center justify-between pb-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-4">
                {backHref && (
                    <Link href={backHref}>
                        <Button variant="ghost" size="icon" className="hover:scale-110 transition-transform duration-300">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                )}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">{title}</h1>
                    {description && (
                        <p className="text-muted-foreground mt-1">{description}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {children}
                {action && (
                    action.href ? (
                        <Link href={action.href}>
                            <Button className="transition-all duration-300 hover:scale-105 hover:shadow-lg">
                                {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                                {action.label}
                            </Button>
                        </Link>
                    ) : (
                        <Button onClick={action.onClick} className="transition-all duration-300 hover:scale-105 hover:shadow-lg">
                            {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                            {action.label}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
}

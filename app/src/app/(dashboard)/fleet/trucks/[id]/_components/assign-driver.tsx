"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { assignDriverToTruck, getAvailableDrivers } from "../../actions";
import { toast } from "sonner";

interface Driver {
    id: string;
    firstName: string;
    lastName: string;
    assignedTruckId: string | null;
}

interface AssignDriverProps {
    truckId: string;
    currentDriverId: string | null;
    currentDriverName: string | null;
}

export function AssignDriver({ truckId, currentDriverId, currentDriverName }: AssignDriverProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(currentDriverId);

    useEffect(() => {
        async function loadDrivers() {
            const result = await getAvailableDrivers();
            if (result.success && result.drivers) {
                setDrivers(result.drivers);
            }
        }
        loadDrivers();
    }, []);

    const handleSelect = async (driverId: string | null) => {
        setIsLoading(true);
        try {
            const result = await assignDriverToTruck(truckId, driverId);
            if (result.success) {
                setSelectedDriverId(driverId);
                toast.success(driverId ? "Driver assigned successfully" : "Driver unassigned");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to assign driver");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
            setOpen(false);
        }
    };

    const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
    const displayName = selectedDriver
        ? `${selectedDriver.firstName} ${selectedDriver.lastName}`
        : currentDriverName;

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="flex-1 justify-between"
                        disabled={isLoading}
                    >
                        {displayName ? (
                            <span className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {displayName}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select a driver...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search drivers..." />
                        <CommandList className="max-h-60 overflow-y-auto">
                            <CommandEmpty>No drivers found.</CommandEmpty>
                            <CommandGroup>
                                {drivers.map((driver) => {
                                    const isAssignedElsewhere = driver.assignedTruckId && driver.assignedTruckId !== truckId;
                                    return (
                                        <CommandItem
                                            key={driver.id}
                                            value={`${driver.firstName} ${driver.lastName}`}
                                            onSelect={() => handleSelect(driver.id)}
                                            disabled={isLoading}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedDriverId === driver.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="flex-1">
                                                {driver.firstName} {driver.lastName}
                                            </span>
                                            {isAssignedElsewhere && (
                                                <span className="text-xs text-muted-foreground">(assigned)</span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedDriverId && (
                <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => handleSelect(null)}
                    disabled={isLoading}
                    title="Unassign driver"
                    className="shrink-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

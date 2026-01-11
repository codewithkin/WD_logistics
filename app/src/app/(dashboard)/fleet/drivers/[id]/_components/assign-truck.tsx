"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Truck, X } from "lucide-react";
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
import { assignTruckToDriver, getAvailableTrucks } from "../../actions";
import { toast } from "sonner";

interface TruckOption {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
    assignedDriver: { id: string } | null;
}

interface AssignTruckProps {
    driverId: string;
    currentTruckId: string | null;
    currentTruckName: string | null;
}

export function AssignTruck({ driverId, currentTruckId, currentTruckName }: AssignTruckProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [trucks, setTrucks] = useState<TruckOption[]>([]);
    const [selectedTruckId, setSelectedTruckId] = useState<string | null>(currentTruckId);

    useEffect(() => {
        async function loadTrucks() {
            const result = await getAvailableTrucks();
            if (result.success && result.trucks) {
                setTrucks(result.trucks);
            }
        }
        loadTrucks();
    }, []);

    const handleSelect = async (truckId: string | null) => {
        setIsLoading(true);
        try {
            const result = await assignTruckToDriver(driverId, truckId);
            if (result.success) {
                setSelectedTruckId(truckId);
                toast.success(truckId ? "Truck assigned successfully" : "Truck unassigned");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to assign truck");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
            setOpen(false);
        }
    };

    const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
    const displayName = selectedTruck 
        ? selectedTruck.registrationNo
        : currentTruckName;

    return (
        <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={isLoading}
                    >
                        {displayName ? (
                            <span className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {displayName}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select a truck...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-75 p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search trucks..." />
                        <CommandList>
                            <CommandEmpty>No trucks found.</CommandEmpty>
                            <CommandGroup>
                                {trucks.map((truck) => {
                                    const isAssignedElsewhere = truck.assignedDriver && truck.assignedDriver.id !== driverId;
                                    return (
                                        <CommandItem
                                            key={truck.id}
                                            value={`${truck.registrationNo} ${truck.make} ${truck.model}`}
                                            onSelect={() => handleSelect(truck.id)}
                                            disabled={isLoading}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedTruckId === truck.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="flex-1">
                                                {truck.registrationNo}
                                                <span className="text-muted-foreground ml-1">
                                                    ({truck.make} {truck.model})
                                                </span>
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
            {selectedTruckId && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSelect(null)}
                    disabled={isLoading}
                    title="Unassign truck"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

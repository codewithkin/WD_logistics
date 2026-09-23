"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import type { MaintenanceHistoryRow } from "../_lib/history";

/**
 * Which vehicle is in the workshop the most, for the selected period — the
 * answer to "is this truck costing us money in repairs?" from the other end
 * (the truck page shows the same numbers for one vehicle).
 */
export function MaintenanceHistoryPanel({
    rows,
    periodLabel,
}: {
    rows: MaintenanceHistoryRow[];
    periodLabel: string;
}) {
    const [vehicleType, setVehicleType] = useState<string>("all");

    const filtered = rows.filter((row) => vehicleType === "all" || row.vehicleType === vehicleType);

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Maintenance history</CardTitle>
                    <CardDescription>
                        Vehicles ranked by how often they came in — {periodLabel.toLowerCase()},
                        plus anything still open from before
                    </CardDescription>
                </div>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All vehicles</SelectItem>
                        <SelectItem value="truck">Trucks only</SelectItem>
                        <SelectItem value="trailer">Trailers only</SelectItem>
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vehicle</TableHead>
                                <TableHead className="text-right">Jobs</TableHead>
                                <TableHead className="text-right">Still open</TableHead>
                                <TableHead className="text-right">Days out of service</TableHead>
                                <TableHead>Last job</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No maintenance logged in this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((row) => (
                                    <TableRow key={`${row.vehicleType}-${row.vehicleId}`}>
                                        <TableCell>
                                            <Link
                                                href={
                                                    row.vehicleType === "truck"
                                                        ? `/fleet/trucks/${row.vehicleId}`
                                                        : `/fleet/trailers/${row.vehicleId}`
                                                }
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {row.registrationNo}
                                            </Link>
                                            <div className="text-xs text-muted-foreground">
                                                {row.vehicleType === "trailer" ? "Trailer · " : ""}
                                                {row.description}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{row.total}</TableCell>
                                        <TableCell className="text-right">
                                            {row.open > 0 ? (
                                                <Badge variant="secondary">{row.open}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">{row.downtimeDays}</TableCell>
                                        <TableCell>{format(row.lastRequestDate, "d MMM yyyy")}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

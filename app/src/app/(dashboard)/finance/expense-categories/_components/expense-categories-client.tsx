"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Truck, MapPin, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } from "../actions";
import { useRouter } from "next/navigation";

const categorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    isTruck: z.boolean().default(false),
    isTrip: z.boolean().default(false),
    color: z.string().optional(),
});

interface Category {
    id: string;
    name: string;
    description: string | null;
    isTruck: boolean;
    isTrip: boolean;
    color: string | null;
    _count: {
        expenses: number;
    };
}

interface ExpenseCategoriesClientProps {
    categories: Category[];
}

const predefinedColors = [
    "#ef4444", // red
    "#f97316", // orange
    "#f59e0b", // amber
    "#84cc16", // lime
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#71717a", // gray
];

export function ExpenseCategoriesClient({ categories }: ExpenseCategoriesClientProps) {
    const router = useRouter();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const form = useForm<z.infer<typeof categorySchema>>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            name: "",
            description: "",
            isTruck: false,
            isTrip: false,
            color: predefinedColors[0],
        },
    });

    const handleCreate = async (values: z.infer<typeof categorySchema>) => {
        try {
            await createExpenseCategory(values);
            setIsCreateOpen(false);
            form.reset();
            router.refresh();
        } catch (error) {
            console.error("Failed to create category:", error);
            alert(error instanceof Error ? error.message : "Failed to create category");
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        form.reset({
            name: category.name,
            description: category.description || "",
            isTruck: category.isTruck,
            isTrip: category.isTrip,
            color: category.color || predefinedColors[0],
        });
    };

    const handleUpdate = async (values: z.infer<typeof categorySchema>) => {
        if (!editingCategory) return;
        
        try {
            await updateExpenseCategory(editingCategory.id, values);
            setEditingCategory(null);
            form.reset();
            router.refresh();
        } catch (error) {
            console.error("Failed to update category:", error);
            alert(error instanceof Error ? error.message : "Failed to update category");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this category?")) return;

        setDeletingId(id);
        try {
            await deleteExpenseCategory(id);
            router.refresh();
        } catch (error) {
            console.error("Failed to delete category:", error);
            alert(error instanceof Error ? error.message : "Failed to delete category");
        } finally {
            setDeletingId(null);
        }
    };

    const CategoryFormContent = ({ onSubmit }: { onSubmit: (values: z.infer<typeof categorySchema>) => Promise<void> }) => (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category Name *</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Fuel, Maintenance" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Brief description" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Color</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                                {predefinedColors.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => field.onChange(color)}
                                        className={`h-8 w-8 rounded-full border-2 ${
                                            field.value === color ? "border-foreground" : "border-transparent"
                                        }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-3">
                    <FormLabel>Category Types</FormLabel>
                    <FormField
                        control={form.control}
                        name="isTruck"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 font-normal">
                                        <Truck className="h-4 w-4" />
                                        Truck Expense
                                    </FormLabel>
                                    <FormDescription>
                                        Can be associated with specific trucks
                                    </FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="isTrip"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 font-normal">
                                        <MapPin className="h-4 w-4" />
                                        Trip Expense
                                    </FormLabel>
                                    <FormDescription>
                                        Can be associated with specific trips
                                    </FormDescription>
                                </div>
                            </FormItem>
                        )}
                    />
                </div>

                <DialogFooter>
                    <Button type="submit">
                        {editingCategory ? "Update Category" : "Create Category"}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Category
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Expense Category</DialogTitle>
                            <DialogDescription>
                                Add a new category for organizing expenses
                            </DialogDescription>
                        </DialogHeader>
                        <CategoryFormContent onSubmit={handleCreate} />
                    </DialogContent>
                </Dialog>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Types</TableHead>
                            <TableHead>Expenses</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No categories found
                                </TableCell>
                            </TableRow>
                        ) : (
                            categories.map((category) => (
                                <TableRow key={category.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: category.color || "#71717a" }}
                                            />
                                            <span className="font-medium">{category.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{category.description || "-"}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {category.isTruck && (
                                                <Badge variant="secondary">
                                                    <Truck className="mr-1 h-3 w-3" />
                                                    Truck
                                                </Badge>
                                            )}
                                            {category.isTrip && (
                                                <Badge variant="secondary">
                                                    <MapPin className="mr-1 h-3 w-3" />
                                                    Trip
                                                </Badge>
                                            )}
                                            {!category.isTruck && !category.isTrip && "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {category._count.expenses} {category._count.expenses === 1 ? "expense" : "expenses"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Dialog 
                                                open={editingCategory?.id === category.id} 
                                                onOpenChange={(open) => !open && setEditingCategory(null)}
                                            >
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => handleEdit(category)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Edit Category</DialogTitle>
                                                        <DialogDescription>
                                                            Update category details
                                                        </DialogDescription>
                                                    </DialogHeader>
                                                    <CategoryFormContent onSubmit={handleUpdate} />
                                                </DialogContent>
                                            </Dialog>
                                            
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(category.id)}
                                                disabled={deletingId === category.id || category._count.expenses > 0}
                                                title={category._count.expenses > 0 ? "Cannot delete category with expenses" : "Delete category"}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

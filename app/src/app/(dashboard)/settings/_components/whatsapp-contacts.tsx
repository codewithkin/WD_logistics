"use client";

/**
 * Who may talk to the WhatsApp assistant, and what they may do.
 *
 * The allowlist used to be three environment variables, so adding a yard
 * manager meant a redeploy and everyone on it had the same access. This is
 * that list, with a role per person — and the roles mean exactly what they
 * mean in the app, so nobody gains anything by messaging instead of logging
 * in.
 */

import { useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listWhatsAppContacts,
  listLinkableUsers,
  saveWhatsAppContact,
  deleteWhatsAppContact,
  type WhatsAppContactRow,
} from "../actions";

/** Value used by the "nobody" option — a Radix SelectItem cannot be empty. */
const NO_ACCOUNT = "__none__";

const ROLE_LABELS: Record<string, string> = {
  readonly: "Read only",
  staff: "Staff",
  supervisor: "Supervisor",
  admin: "Admin",
};

const ROLE_HINTS: Record<string, string> = {
  readonly: "Can ask about trucks, drivers, trips and stock. Changes nothing, sees no money.",
  staff: "As read only, plus reporting faults to the workshop and seeing invoices.",
  supervisor: "Can record expenses and payments, schedule trips and adjust stock.",
  admin: "Everything, including revenue, profit and the per-truck cost breakdowns.",
};

export function WhatsAppContacts() {
  const [contacts, setContacts] = useState<WhatsAppContactRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<WhatsAppContactRow> | null>(null);
  const [users, setUsers] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [isSaving, startSaving] = useTransition();

  const load = async () => {
    try {
      const [rows, accounts] = await Promise.all([
        listWhatsAppContacts(),
        listLinkableUsers(),
      ]);
      setContacts(rows);
      setUsers(accounts);
    } catch {
      toast.error("Could not load the contact list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = () => {
    if (!editing) return;
    startSaving(async () => {
      const result = await saveWhatsAppContact({
        id: editing.id,
        name: editing.name ?? "",
        phone: editing.phone ?? "",
        role: editing.role ?? "readonly",
        isActive: editing.isActive ?? true,
        notes: editing.notes ?? undefined,
        userId: editing.userId ?? null,
      });
      if (result.success) {
        toast.success(editing.id ? "Contact updated" : "Contact added");
        setEditing(null);
        await load();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    startSaving(async () => {
      const result = await deleteWhatsAppContact(id);
      if (result.success) {
        toast.success(`${name} removed`);
        await load();
      } else {
        toast.error(result.error);
      }
    });
  };

  const toggleActive = (contact: WhatsAppContactRow) => {
    startSaving(async () => {
      const result = await saveWhatsAppContact({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        role: contact.role,
        isActive: !contact.isActive,
        notes: contact.notes ?? undefined,
        userId: contact.userId ?? null,
      });
      if (result.success) await load();
      else toast.error(result.error);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp assistant
          </CardTitle>
          <CardDescription>
            Who can message the assistant, and what it will do for them. A
            number that is not on this list gets no answer at all.
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setEditing({ name: "", phone: "", role: "readonly", isActive: true })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : contacts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nobody is on the list yet, so the assistant will not reply to
            anyone. Add yourself first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Can do</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.name}
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground">{contact.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {contact.phone}
                      {contact.waId && (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {contact.waId}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[contact.role] ?? contact.role}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {contact.userName
                          ? `records as ${contact.userName}`
                          : "questions only"}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {contact.lastSeenAt
                        ? `${new Date(contact.lastSeenAt).toLocaleDateString("en-GB")} · ${contact.messageCount} msg`
                        : "never"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={contact.isActive}
                        onCheckedChange={() => toggleActive(contact)}
                        disabled={isSaving}
                        aria-label={`${contact.name} active`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(contact)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(contact.id, contact.name)}
                          disabled={isSaving}
                          aria-label={`Remove ${contact.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Edit contact" : "Add contact"}
            </DialogTitle>
            <DialogDescription>
              The role decides what the assistant will do for them — the same
              limits as the web app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="wa-name">Name</Label>
              <Input
                id="wa-name"
                value={editing?.name ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Tapiwa Moyo"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="wa-phone">WhatsApp number</Label>
              <Input
                id="wa-phone"
                value={editing?.phone ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="0772958986"
              />
              <p className="text-xs text-muted-foreground">
                Any format — it is stored as +263…, so 0772958986 and
                +263 77 295 8986 are the same person.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="wa-role">Role</Label>
              <Select
                value={editing?.role ?? "readonly"}
                onValueChange={(role) => setEditing((prev) => ({ ...prev, role }))}
              >
                <SelectTrigger id="wa-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_HINTS[editing?.role ?? "readonly"]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-account">Records changes as</Label>
              <Select
                value={editing?.userId ?? NO_ACCOUNT}
                onValueChange={(value) =>
                  setEditing((prev) => ({
                    ...prev,
                    userId: value === NO_ACCOUNT ? null : value,
                  }))
                }
              >
                <SelectTrigger id="wa-account">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>Nobody — can only ask questions</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({ROLE_LABELS[user.role] ?? user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editing?.userId
                  ? "Anything they record by message is filed under this account, exactly as if they had typed it into the web app — and their access there caps what the assistant will do, whatever role is set above."
                  : "Without an account, the assistant will answer questions but refuse to record anything: there would be nobody to attribute the change to."}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="wa-notes">Note (optional)</Label>
              <Input
                id="wa-notes"
                value={editing?.notes ?? ""}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Yard manager, Mutare"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

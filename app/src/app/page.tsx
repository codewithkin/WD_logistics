import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";
import { getLandingPath } from "@/lib/landing";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect(getLandingPath(session.role));
  } else {
    redirect("/sign-in");
  }
}

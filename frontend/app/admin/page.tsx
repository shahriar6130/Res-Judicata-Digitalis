import { redirect } from "next/navigation";

export default function AdminSignIn() {
  redirect("/dashboard/admin");
}

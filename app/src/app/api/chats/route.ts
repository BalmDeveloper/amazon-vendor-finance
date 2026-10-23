import { connection } from "next/server";
import { listChats } from "@/lib/db";

export async function GET() {
  await connection();
  return Response.json(await listChats());
}

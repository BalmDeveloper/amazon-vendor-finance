import { connection } from "next/server";
import { json } from "@/lib/api";
import { listChats } from "@/lib/db";

export async function GET() {
  await connection();
  return json(listChats);
}

import { cookies } from "next/headers";
export async function currentCity(): Promise<string> { return (await cookies()).get("city")?.value ?? "kyiv"; }

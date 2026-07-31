const candidate = Number(Deno.env.get("PORTAL_PORT") ?? "8000");

if (!Number.isSafeInteger(candidate) || candidate < 1 || candidate > 65_535) {
  console.error("Rejected invalid PORTAL_PORT");
  Deno.exit(1);
}

console.log(candidate);

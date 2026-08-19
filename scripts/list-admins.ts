import { listAdminAccounts } from "../src/lib/auth/admin-cli";

async function main() {
  const admins = await listAdminAccounts();
  process.stdout.write(`${JSON.stringify(admins, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Operazione fallita"}\n`
  );
  process.exitCode = 1;
});

import { closeDatabase } from "../src/db";
import {
  createAdminAccount,
  parseAdminCliArgs,
  readAdminPassword
} from "../src/lib/auth/admin-cli";

async function main() {
  const args = parseAdminCliArgs(process.argv.slice(2));
  if (!args.email) throw new Error("--email è obbligatorio");
  const password = await readAdminPassword(args);
  const admin = await createAdminAccount({
    email: args.email,
    role: args.role,
    password
  });
  process.stdout.write(`Amministratore creato: ${admin.id}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Operazione fallita"}\n`
    );
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());

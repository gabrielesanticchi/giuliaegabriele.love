import {
  parseAdminCliArgs,
  readAdminPassword,
  resetAdminPassword
} from "../src/lib/auth/admin-cli";

async function main() {
  const args = parseAdminCliArgs(process.argv.slice(2));
  if (!args.email) throw new Error("--email è obbligatorio");
  const password = await readAdminPassword(args);
  const result = await resetAdminPassword({
    email: args.email,
    password,
    resetRecovery: args.resetRecovery
  });
  process.stdout.write(`Password aggiornata: ${result.id}\n`);
  if (result.recoveryCodes)
    process.stdout.write(
      `Nuovi recovery code (mostrati una volta):\n${result.recoveryCodes.join("\n")}\n`
    );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Operazione fallita"}\n`
  );
  process.exitCode = 1;
});

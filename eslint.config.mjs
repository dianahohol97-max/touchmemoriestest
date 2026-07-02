import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Guard: never upload customer files straight to the RLS-restricted
    // buckets from the browser again. order-files / poster-exports have public
    // INSERT but no public UPDATE, so a direct upsert fails for guests — the
    // recurring "can't upload photo" / "no print files" bug. Client code must
    // use uploadCustomerFile (lib/upload-customer-file) or uploadImageToStorage
    // (lib/storage-upload), which route through the service-role server
    // endpoint. Server routes (app/api/**) and the sheet generator use the
    // admin client directly and are exempt.
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["app/api/**", "lib/print/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='upload'][callee.object.callee.property.name='from'][callee.object.arguments.0.value=/order-files|poster-exports/]",
          message:
            "Do not upload to order-files/poster-exports directly from the browser (RLS will reject guest upserts). Use uploadCustomerFile() or uploadImageToStorage().",
        },
      ],
    },
  },
]);

export default eslintConfig;

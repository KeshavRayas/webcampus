import { nextJsConfig } from "@webcampus/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/api-client.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "axios",
              message:
                "Use `apiClient` from '@/lib/api-client' instead of raw axios. See M20.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["lib/api-client.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

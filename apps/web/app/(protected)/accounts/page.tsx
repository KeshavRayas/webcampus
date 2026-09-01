import { AccountsView } from "@/modules/accounts/accounts-view";
import { RoleHero } from "@/modules/role-hero";

export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-6">
      <RoleHero
        eyebrow="Accounts"
        title="Every rupee, accounted for."
        description="Track fees, wallets, and reports from one calm workspace."
        image="/dashboard-accounts.png"
      />
      <AccountsView />
    </div>
  );
}

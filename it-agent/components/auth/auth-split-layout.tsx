import { CreditCard, MessagesSquare, ShieldCheck } from "lucide-react";

const FEATURES = [
  {
    icon: CreditCard,
    title: "Card & dispute servicing",
    description: "Card issues, disputes, and account updates handled in one chat.",
  },
  {
    icon: ShieldCheck,
    title: "Verified before resolved",
    description: "Every tool call is independently re-checked before a case closes.",
  },
  {
    icon: MessagesSquare,
    title: "One queue, every channel",
    description: "Social grievances route into the same queue CSRs already work from.",
  },
];

type AuthSplitLayoutProps = {
  children: React.ReactNode;
  /** Chip above the Clerk form marking which door this is. */
  badge?: React.ReactNode;
  /** Cross-link to the other door, rendered under the Clerk form. */
  footnote?: React.ReactNode;
};

export function AuthSplitLayout({ children, badge, footnote }: AuthSplitLayoutProps) {
  return (
    <main className="flex min-h-svh">
      <div className="hidden w-[460px] shrink-0 flex-col justify-center gap-10 bg-chrome px-14 text-chrome-foreground lg:flex">
        <div>
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight text-balance">
            Customer service at the speed of trust.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-chrome-foreground/60">
            Sign in to handle card, dispute, and account requests — every
            action verified before a case is marked resolved.
          </p>
        </div>

        <ul className="flex flex-col gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chrome-foreground/10 text-chrome-foreground">
                <Icon className="size-4.5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[14px] font-medium leading-tight">{title}</p>
                <p className="mt-1 text-[13px] leading-snug text-chrome-foreground/55">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-base px-4 py-10">
        {badge}
        {children}
        {footnote ? (
          <p className="text-[13px] text-muted-foreground">{footnote}</p>
        ) : null}
      </div>
    </main>
  );
}

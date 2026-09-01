import { CSSProperties, ReactNode } from "react";
import { cn } from "@webcampus/ui/lib/utils";

export type RoleHeroProps = {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  image?: string;
  className?: string;
};

export function RoleHero({
  eyebrow,
  title,
  description,
  image = "/admissions.png",
  className,
}: RoleHeroProps) {
  const style = { "--role-hero-image": `url("${image}")` } as CSSProperties;
  return (
    <section
      className={cn("role-hero", className)}
      style={style}
      aria-labelledby="role-hero-title"
    >
      <div className="role-hero-copy">
        {eyebrow ? <p className="role-hero-eyebrow">{eyebrow}</p> : null}
        <h1 id="role-hero-title">{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

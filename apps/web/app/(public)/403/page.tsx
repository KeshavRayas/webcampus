import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-150 flex flex-col items-center justify-center space-y-4 py-12">
      <Image
        width={60}
        height={60}
        src={"/bmsce.svg"}
        alt="BMSCE Logo"
        className="h-16 w-16"
      />
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl">
          Access Denied
        </h1>
        <p className="text-muted-foreground max-w-150 md:text-xl/relaxed">
          You do not have permission to view this page
        </p>
      </div>
      <Link
        href="/"
        className="border-border bg-card hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md border px-8 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
        prefetch={false}
      >
        Go to Homepage
      </Link>
    </div>
  );
}

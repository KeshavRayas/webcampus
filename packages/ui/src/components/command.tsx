"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@webcampus/ui/components/dialog";
import { cn } from "@webcampus/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import * as React from "react";

type CommandContextValue = {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  registerItem: (id: string, visible: boolean) => void;
  visibleCount: number;
};

const CommandContext = React.createContext<CommandContextValue | null>(null);

function useCommandContext() {
  return React.useContext(CommandContext);
}

function Command({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [search, setSearch] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(0);
  const visibilityMapRef = React.useRef(new Map<string, boolean>());

  const registerItem = React.useCallback((id: string, visible: boolean) => {
    const previous = visibilityMapRef.current.get(id);

    if (previous === visible) {
      return;
    }

    visibilityMapRef.current.set(id, visible);

    let nextVisibleCount = 0;

    visibilityMapRef.current.forEach((itemVisible) => {
      if (itemVisible) {
        nextVisibleCount += 1;
      }
    });

    setVisibleCount(nextVisibleCount);
  }, []);

  return (
    <CommandContext.Provider
      value={{ search, setSearch, registerItem, visibleCount }}
    >
      <div
        data-slot="command"
        className={cn(
          "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("overflow-hidden p-0", className)}
        showCloseButton={showCloseButton}
      >
        <Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  const commandContext = useCommandContext();

  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        className={cn(
          "outline-hidden placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
        value={commandContext?.search ?? ""}
        onChange={(event) => commandContext?.setSearch(event.target.value)}
      />
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn(
        "max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden",
        className
      )}
      {...props}
    />
  );
}

function CommandEmpty({ ...props }: React.ComponentPropsWithoutRef<"div">) {
  const commandContext = useCommandContext();

  if ((commandContext?.visibleCount ?? 0) > 0) {
    return null;
  }

  return (
    <div
      data-slot="command-empty"
      className="py-6 text-center text-sm"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="command-group"
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  value,
  onSelect,
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  value?: string;
  onSelect?: () => void;
}) {
  const commandContext = useCommandContext();
  const itemId = React.useId();
  const normalizedSearch = (commandContext?.search ?? "").trim().toLowerCase();
  const normalizedValue = (value ?? "").toLowerCase();
  const isVisible =
    normalizedSearch.length === 0 || normalizedValue.includes(normalizedSearch);

  React.useEffect(() => {
    commandContext?.registerItem(itemId, isVisible);

    return () => {
      commandContext?.registerItem(itemId, false);
    };
  }, [commandContext, itemId, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      data-slot="command-item"
      role="option"
      tabIndex={-1}
      aria-selected={false}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.();
      }}
      className={cn(
        "outline-hidden data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};

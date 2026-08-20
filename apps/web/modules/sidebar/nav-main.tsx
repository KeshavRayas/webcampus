import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@webcampus/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@webcampus/ui/components/sidebar";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavMainProps } from "./sidebar-types";

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();
  const hasSections = items.some((item) => item.section);
  const groups = hasSections
    ? Object.entries(
        items.reduce<Record<string, typeof items>>((acc, item) => {
          const section = item.section ?? "Platform";
          acc[section] ??= [];
          acc[section].push(item);
          return acc;
        }, {})
      )
    : [["Platform", items] as const];

  const renderItem = (item: (typeof items)[number]) => {
    if (item.children && item.children.length > 0) {
      const isParentActive =
        pathname === item.url ||
        item.children.some((child) => pathname === child.url);

      return (
        <Collapsible
          key={item.name}
          asChild
          defaultOpen={isParentActive}
          className="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip={item.name} isActive={isParentActive}>
                <item.icon />
                <span>{item.name}</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {item.children.map((child) => {
                  if (child.children && child.children.length > 0) {
                    const isChildActive =
                      pathname === child.url ||
                      child.children.some((c) => pathname === c.url);
                    return (
                      <Collapsible
                        key={child.name}
                        asChild
                        defaultOpen={isChildActive}
                        className="group/subcollapsible"
                      >
                        <SidebarMenuSubItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              isActive={isChildActive}
                              className="flex w-full cursor-pointer justify-between"
                            >
                              <span>{child.name}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-90" />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-2 border-l pl-2">
                              {child.children.map((grandchild) => (
                                <SidebarMenuSubItem key={grandchild.name}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === grandchild.url}
                                  >
                                    <Link href={grandchild.url}>
                                      <span>{grandchild.name}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuSubItem>
                      </Collapsible>
                    );
                  }
                  return (
                    <SidebarMenuSubItem key={child.name}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === child.url}
                      >
                        <Link href={child.url}>
                          <span>{child.name}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.name}>
        <SidebarMenuButton asChild isActive={pathname === item.url}>
          <Link href={item.url}>
            <item.icon />
            <span>{item.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      {groups.map(([section, sectionItems]) => (
        <SidebarGroup key={section} className="admission-nav-group">
          <SidebarGroupLabel>{section}</SidebarGroupLabel>
          <SidebarMenu>{sectionItems.map(renderItem)}</SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}

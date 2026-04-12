import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  Home
} from "lucide-react";
import { FaFilePdf } from "react-icons/fa6";

export function AppSidebar({ className }: { className?: () => void }) {
  const { state, isMobile, setOpenMobile } = useSidebar();

  const groups = [
    {
      group: "Main",
      title: "Title1",
      items: [
        {
          title: "Home",
          action: () => console.log("Home clicked"),
          icon: Home,
        },
      ],
    },
  ];

  const handleItem = (item: { action: () => void }) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    item.action();
  };

  return (
    <Sidebar className={cn(className)} collapsible="icon">
      <SidebarHeader className="flex flex-row gap-1 items-center text-primary">
        <div
          className={cn(
            "grow flex items-center gap-1 justify-center",
            state === "collapsed" ? "pt-[2px]" : "",
          )}
        >
          <FaFilePdf size={16} />
          {state === "expanded" && <span className="whitespace-nowrap">Visualizer</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.group} className="mt-2">
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild title={item.title} onClick={() => handleItem(item)}>
                      <div className="cursor-pointer select-none">
                        <item.icon />
                        <span>{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {state === "expanded" && (
          <div className="text-xs text-muted-foreground text-center">
            <br />
            {"Stepan Rutz © 2026"}
            <br />
            {"Built with R3F and cagent"}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

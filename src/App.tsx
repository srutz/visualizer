import { AppSidebar } from "./AppSidebar";
import { BookScene } from "./BookScene";
import { SidebarProvider, useSidebar } from "./components/ui/sidebar";

export function App() {
  return (
    <SidebarProvider>
      <div className="w-screen h-screen bg-zinc-300 flex flex-col items-center justify-center">
        <AppSidebar></AppSidebar>
        <main className="grow self-stretch flex ">
          <SidebarController />
          <BookScene />
        </main>
      </div >
    </SidebarProvider>
  )
}

function SidebarController() {
  const { toggleSidebar } = useSidebar()
  return (
    <div className="absolute top-4 left-[calc(var(--sidebar-width)+1rem)] z-50 transition-[left] duration-200 ease-linear group-data-[collapsible=icon]:left-[calc(var(--sidebar-width-icon)+1rem)] group-data-[collapsible=offcanvas]:left-4">
      <button
        onClick={toggleSidebar}
        className="px-3 py-1 bg-black/60 text-white text-xs sm:text-sm backdrop-blur-sm shadow rounded"
      >
        Toggle Sidebar
      </button>
    </div>
  )
} 
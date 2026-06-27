import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"
import { Bell } from "lucide-react"
import { NavMain } from "@/components/nav-main"

type SiteHeaderProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

const data = {
  /*user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "logo.png",
  },*/
  navMain: [
    { title: "", url: "#", icon: <Bell /> },
  ]

}

export function SiteHeader({user}: SiteHeaderProps) {
  console.log("user dans siteheader: ", user)
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Dashboard</h1>
        <div className="ms-310">
          <NavMain items={data.navMain} />
        </div>
        

        <div className="ml-auto">
          
          <NavUser user={user} />
        </div>
      </div>
    </header>
  )
}

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

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />

        <Separator
          orientation="vertical"
          className="mx-2 shrink-0 data-[orientation=vertical]:h-4"
        />

        <h1 className="shrink-0 text-base font-medium">
          Dashboard
        </h1>

        <div className="ml-auto flex shrink-0 items-center gap-4">
          <div className="flex w-10 shrink-0 justify-center">
            <NavMain items={data.navMain} />
          </div>

          <NavUser user={user} />
        </div>
      </div>
    </header>
  )
}

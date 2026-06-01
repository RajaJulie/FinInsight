"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon, TrendingUp, Wallet, HandCoins } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartAreaLinear } from "@/components/chart-area-line-dots"
import { Separator } from "@/components/ui/separator"

const months = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ]
  const years = [2024, 2025, 2026, 2027] 


export function SectionCards() {
  

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-[#071226] *:data-[slot=card]:to-[#0b1d3a] *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-2 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader >
          <CardDescription>Solde Total </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            2 720,45 €
          </CardTitle>
          <CardAction>
            <Select>
              <SelectTrigger className=" w-[135px] rounded-lg border-white/8 bg-black/10 px-2 py-1 text-xs text-white shadow-sm">
                <SelectValue placeholder="Mai 2026" />
              </SelectTrigger>

              <SelectContent>
                {years.map((year) =>
                  months.map((month) => (
                    <SelectItem
                      key={`${month}-${year}`}
                      value={`${month}-${year}`}
                    >
                      {month} {year}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium text-green-500">
            + 320,45 €
            <span className="text-muted-foreground">
              vs le mois dernier
            </span>
          </div>
          <CardContent className=" ml-auto -mt-15 w-[170px] p-0">
            <div>
              <ChartAreaLinear />
            </div>
          </CardContent>
          
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <div className="flex w-full items-center gap-10">
            <div className="flex flex-1 flex-col gap-2"> 
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Wallet className="h-6 w-6 text-green-500" />
              </div>
              
              <CardDescription>Revenus</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-green-500">
                2 400,00 €
              </CardTitle>
              
                <CardDescription className="flex items-center gap-1">
                  <TrendingUp className="h-6 w-6" /> 
                  +8% 
                </CardDescription>
              
            </div>
            
            <Separator orientation="vertical" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <HandCoins className="h-6 w-6 text-red-500" />
              </div>
              <CardDescription>Dépenses</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-red-500">
                1 680,00 €
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="size-4"/> 
                +12% 
              </CardDescription>
            </div>
            
            <Separator orientation="vertical" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <HandCoins className="h-6 w-6 text-blue-500" />
              </div>
              <CardDescription>Épargne</CardDescription>
              <CardTitle className="text-xl font-semibold tabular-nums text-blue-500">
                720,45 €
              </CardTitle>
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="size-4"/> 
                +5% 
              </CardDescription>
            </div>
          
          </div>
          
          
        </CardHeader>
        
      </Card>
      
    </div>
  )
}




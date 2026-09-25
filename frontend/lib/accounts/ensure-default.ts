import { DEFAULT_ACCOUNT } from "@/lib/accounts/constants"
import { prisma } from "@/lib/prisma"

export async function ensureDefaultAccount(userId: string) {
  const primaryAccount = await prisma.account.findFirst({
    where: { userId, isPrimary: true },
    select: { id: true },
  })

  const account =
    primaryAccount ??
    (await prisma.account.create({
      data: {
        ...DEFAULT_ACCOUNT,
        userId,
      },
      select: { id: true },
    }))

  await prisma.transaction.updateMany({
    where: {
      userId,
      accountId: null,
    },
    data: {
      accountId: account.id,
    },
  })

  return account
}

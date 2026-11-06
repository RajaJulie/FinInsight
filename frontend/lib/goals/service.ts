/**
 * Centralise les lectures et ecritures des objectifs appartenant a un utilisateur.
 * Reutilise les calculs en centimes, controle les comptes, statuts et fonds libres,
 * et verifie les operations deja enregistrees avant toute nouvelle ecriture.
 * Ne modifie que les objectifs et leur journal virtuel, jamais les soldes,
 * transactions bancaires, budgets ou reserves d'urgence.
 */
import { Decimal } from "@prisma/client/runtime/client"
import type { Prisma, SavingsGoalStatus } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateRecordedAccountBalance } from "@/lib/accounts/balance"
import type { CreateGoalInput, UpdateGoalInput, CreateGoalEntryInput } from "@/lib/validations/goal"
import { assertCanAllocate, assertCanRelease, getAccountFunding, getGoalSummary } from "./calculations"
import { toGoalCents } from "./money"
import { GoalApiError } from "./api-errors"
import { GoalSnapshotChanged, lockGoalAccounts, lockGoalBankMovements, withGoalWrite } from "./locking"

const goalInclude = { entries: { orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }, { id: "asc" }] } } satisfies Prisma.SavingsGoalInclude
const accountInclude = {
  transactions: { select: { amount: true, type: true } },
  incomingTransfers: { where: { type: "TRANSFER" }, select: { amount: true } },
} satisfies Prisma.AccountInclude
type Goal = Prisma.SavingsGoalGetPayload<{ include: typeof goalInclude }>
type Account = Prisma.AccountGetPayload<{ include: typeof accountInclude }>
type GoalState = { goals: Goal[]; accounts: Account[]; asOf: Date }

export const GOAL_STATUS_TRANSITIONS: Record<SavingsGoalStatus, readonly SavingsGoalStatus[]> = {
  ACTIVE: ["ACTIVE", "PAUSED", "ARCHIVED"],
  PAUSED: ["PAUSED", "ACTIVE", "ARCHIVED"],
  ARCHIVED: ["ARCHIVED", "ACTIVE"],
}

function assertEligible(account: Account) {
  if (account.status !== "ACTIVE") throw new GoalApiError(409, "ACCOUNT_ARCHIVED", "Ce compte est archivé.")
  if (account.currency !== "EUR") throw new GoalApiError(400, "UNSUPPORTED_CURRENCY", "Seuls les comptes en euros sont éligibles.")
}

async function readState(tx: Prisma.TransactionClient, userId: string): Promise<GoalState> {
  const asOf = new Date()
  const goals = await tx.savingsGoal.findMany({
    where: { userId, account: { userId } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: goalInclude,
  })
  const accounts = await tx.account.findMany({
    where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      transactions: { ...accountInclude.transactions, where: { userId } },
      incomingTransfers: { ...accountInclude.incomingTransfers, where: { userId, type: "TRANSFER" } },
    },
  })
  return { goals, accounts, asOf }
}

function effectiveGoals(state: GoalState) {
  return state.goals.map(goal => ({ ...goal, entries: goal.entries.filter(entry => entry.effectiveAt <= state.asOf) }))
}

function accountView(account: Account, state: GoalState) {
  const bankBalance = calculateRecordedAccountBalance(account)
  return {
    id: account.id, name: account.name, type: account.type, currency: account.currency, status: account.status,
    bankBalance, balanceVerified: false,
    hasFutureEntries: state.goals.some(goal => goal.accountId === account.id && goal.entries.some(entry => entry.effectiveAt > state.asOf)),
    ...getAccountFunding({ accountId: account.id, bankBalance, goals: effectiveGoals(state) }),
  }
}

function entryView(entry: Goal["entries"][number]) {
  return { id: entry.id, type: entry.type, amount: Number(entry.amount), effectiveAt: entry.effectiveAt,
    note: entry.note, idempotencyKey: entry.idempotencyKey, createdAt: entry.createdAt }
}

function goalView(goal: Goal, state: GoalState, withHistory = false) {
  const account = state.accounts.find(item => item.id === goal.accountId)
  if (!account) throw new GoalApiError(404, "ACCOUNT_NOT_FOUND", "Compte introuvable.")
  const funding = accountView(account, state)
  const warnings: { code: string; message: string }[] = []
  if (funding.underfunded) warnings.push({ code: "ACCOUNT_UNDERFUNDED", message: "Le solde calculé du compte ne couvre plus toutes ses sommes réservées." })
  if (account.status === "ARCHIVED") warnings.push({ code: "ACCOUNT_ARCHIVED", message: "Le compte associé est archivé. Aucune nouvelle affectation n'est possible." })
  if (account.currency !== "EUR") warnings.push({ code: "UNSUPPORTED_CURRENCY", message: "La devise du compte n'est pas prise en charge pour les affectations." })
  if (funding.hasFutureEntries) warnings.push({ code: "FUTURE_ENTRIES", message: "Des écritures futures existent sur ce compte : elles ne sont pas encore incluses dans les réservations et bloquent les nouvelles opérations." })
  return {
    id: goal.id, title: goal.title, accountId: goal.accountId, account: funding,
    targetAmount: Number(goal.targetAmount), targetDate: goal.targetDate, status: goal.status,
    ...getGoalSummary({ targetAmount: goal.targetAmount, entries: goal.entries.filter(entry => entry.effectiveAt <= state.asOf) }),
    createdAt: goal.createdAt, updatedAt: goal.updatedAt, warnings,
    ...(withHistory ? { entries: goal.entries.map(entryView) } : {}),
  }
}

async function ownedGoal(tx: Prisma.TransactionClient, userId: string, id: string) {
  const goal = await tx.savingsGoal.findFirst({ where: { id, userId, account: { userId } }, include: goalInclude })
  if (!goal) throw new GoalApiError(404, "GOAL_NOT_FOUND", "Objectif introuvable.")
  return goal
}

async function lockedGoal(tx: Prisma.TransactionClient, userId: string, id: string, nextAccountId?: string) {
  const before = await ownedGoal(tx, userId, id)
  await lockGoalAccounts(tx, userId, [before.accountId, ...(nextAccountId ? [nextAccountId] : [])])
  const goal = await ownedGoal(tx, userId, id)
  if (goal.accountId !== before.accountId) throw new GoalSnapshotChanged()
  return goal
}

function findAccount(state: GoalState, id: string) {
  const account = state.accounts.find(item => item.id === id)
  if (!account) throw new GoalApiError(404, "ACCOUNT_NOT_FOUND", "Compte introuvable.")
  return account
}

export async function listGoalsForUser(userId: string) {
  return prisma.$transaction(async tx => {
    const state = await readState(tx, userId)
    return { goals: state.goals.map(goal => goalView(goal, state)), accounts: state.accounts.map(account => accountView(account, state)), asOf: state.asOf }
  }, { isolationLevel: "RepeatableRead" })
}

export async function getGoalForUser(userId: string, id: string) {
  return prisma.$transaction(async tx => {
    await ownedGoal(tx, userId, id)
    const state = await readState(tx, userId)
    const goal = state.goals.find(item => item.id === id)
    if (!goal) throw new GoalApiError(404, "GOAL_NOT_FOUND", "Objectif introuvable.")
    return { goal: goalView(goal, state, true), asOf: state.asOf }
  }, { isolationLevel: "RepeatableRead" })
}

export async function createGoalForUser(userId: string, input: CreateGoalInput) {
  return withGoalWrite(async tx => {
    await lockGoalAccounts(tx, userId, [input.accountId])
    const state = await readState(tx, userId)
    assertEligible(findAccount(state, input.accountId))
    const goal = await tx.savingsGoal.create({ data: {
      userId, accountId: input.accountId, title: input.title,
      targetAmount: new Decimal(input.targetAmount), targetDate: input.targetDate ?? null,
    }, include: goalInclude })
    state.goals.push(goal)
    return { message: "Objectif créé avec succès.", goal: goalView(goal, state) }
  })
}

export async function updateGoalForUser(userId: string, id: string, input: UpdateGoalInput) {
  return withGoalWrite(async tx => {
    const goal = await lockedGoal(tx, userId, id, input.accountId)
    const state = await readState(tx, userId)
    const nextAccountId = input.accountId ?? goal.accountId
    if (nextAccountId !== goal.accountId && goal.entries.length > 0) {
      throw new GoalApiError(409, "ACCOUNT_CHANGE_WITH_HISTORY", "Le compte ne peut plus changer dès qu'une écriture existe.")
    }
    const nextStatus = input.status ?? goal.status
    if (!GOAL_STATUS_TRANSITIONS[goal.status].includes(nextStatus)) {
      throw new GoalApiError(409, "INVALID_STATUS_TRANSITION", "Un objectif archivé doit être restauré en actif avant d'être mis en pause.")
    }
    if (nextAccountId !== goal.accountId || (nextStatus === "ACTIVE" && goal.status !== "ACTIVE")) {
      assertEligible(findAccount(state, nextAccountId))
    }
    const updated = await tx.savingsGoal.update({ where: { id, userId }, data: {
      ...input, ...(input.targetAmount !== undefined ? { targetAmount: new Decimal(input.targetAmount) } : {}),
    }, include: goalInclude })
    state.goals = state.goals.map(item => item.id === id ? updated : item)
    return { message: "Objectif modifié avec succès.", goal: goalView(updated, state) }
  })
}

function sameEntry(entry: Goal["entries"][number], input: CreateGoalEntryInput) {
  return entry.type === input.type && toGoalCents(entry.amount) === toGoalCents(input.amount) && entry.note === input.note
}

export async function createGoalEntryForUser(userId: string, id: string, input: CreateGoalEntryInput) {
  return withGoalWrite(async tx => {
    const goal = await lockedGoal(tx, userId, id)
    // Replay precedes status/funding checks: a later archive or payment cannot invalidate a committed retry.
    const previous = await tx.goalEntry.findUnique({ where: { goalId_idempotencyKey: { goalId: id, idempotencyKey: input.idempotencyKey } } })
    if (previous) {
      if (!sameEntry(previous, input)) throw new GoalApiError(409, "IDEMPOTENCY_CONFLICT", "Cette clé d'idempotence a déjà été utilisée avec une opération différente.")
      const state = await readState(tx, userId)
      return { message: "Opération déjà enregistrée.", replayed: true, entry: entryView(previous), goal: goalView(goal, state, true) }
    }
    await lockGoalBankMovements(tx, userId, goal.accountId)
    const state = await readState(tx, userId)
    const account = findAccount(state, goal.accountId)
    const snapshots = effectiveGoals(state)
    if (state.goals.some(item => item.accountId === goal.accountId && item.entries.some(entry => entry.effectiveAt > state.asOf))) {
      throw new GoalApiError(409, "FUTURE_ENTRIES", "Des écritures futures existent sur ce compte. Leur calendrier doit être vérifié avant une nouvelle opération.")
    }
    if (input.type === "ALLOCATION") {
      if (goal.status !== "ACTIVE") throw new GoalApiError(409, "GOAL_NOT_ACTIVE", "Seul un objectif actif accepte de nouvelles affectations.")
      assertEligible(account)
      assertCanAllocate({ goalId: id, amount: input.amount, bankBalance: calculateRecordedAccountBalance(account), goals: snapshots })
    } else {
      assertCanRelease({ amount: input.amount, entries: goal.entries.filter(entry => entry.effectiveAt <= state.asOf) })
    }
    const entry = await tx.goalEntry.create({ data: {
      goalId: id, type: input.type, amount: new Decimal(input.amount), note: input.note,
      idempotencyKey: input.idempotencyKey, effectiveAt: state.asOf,
    } })
    const updated = { ...goal, entries: [...goal.entries, entry].sort((a, b) =>
      a.effectiveAt.getTime() - b.effectiveAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }
    state.goals = state.goals.map(item => item.id === id ? updated : item)
    return { message: input.type === "ALLOCATION" ? "Somme affectée à l'objectif." : "Somme libérée de l'objectif.",
      replayed: false, entry: entryView(entry), goal: goalView(updated, state, true) }
  })
}

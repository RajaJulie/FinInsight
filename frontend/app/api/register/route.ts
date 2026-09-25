import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { DEFAULT_CATEGORY_TEMPLATES } from "@/lib/categories/constants"
import { DEFAULT_ACCOUNT } from "@/lib/accounts/constants"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Tous les champs sont obligatoires." },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: "Un compte existe déjà avec cet email." },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        categories: {
          create: DEFAULT_CATEGORY_TEMPLATES.map((category) => category),
        },
        accounts: {
          create: DEFAULT_ACCOUNT,
        },
      },
    })

    return NextResponse.json(
      {
        message: "Compte créé avec succès.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("REGISTER_ERROR", error)

    return NextResponse.json(
      { message: "Erreur serveur." },
      { status: 500 }
    )
  }
}

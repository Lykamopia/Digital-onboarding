
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { User } from "./types";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          return null;
        }

        return user;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
        if (trigger === "update" && session?.mustChangePassword === false) {
          token.mustChangePassword = false;
        }
        if (user) {
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
            token.id = user.id;
            token.mustChangePassword = dbUser?.mustChangePassword;
        }
        return token;
    },
    async session({ session, token }) {
        if (session.user) {
            (session.user as any).id = token.id;
            (session.user as any).mustChangePassword = token.mustChangePassword;
        }
        return session;
    },
  },
};

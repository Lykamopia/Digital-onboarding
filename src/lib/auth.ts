
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { User } from "./types";

const MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10);

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
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("Invalid credentials");
        }

        if (user.lockoutUntil && new Date() < user.lockoutUntil) {
           const timeLeft = Math.ceil((user.lockoutUntil.getTime() - new Date().getTime()) / (1000 * 60));
           throw new Error(`Account locked. Please try again in ${timeLeft} minutes.`);
        }
        
        if (user.status === 'inactive') {
            throw new Error("Your account is deactivated. Please contact an administrator.");
        }

        if (!user.hashedPassword) {
            throw new Error("Password not set for this account. Please contact an administrator.");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
            const newFailedAttempts = user.failedLoginAttempts + 1;
            let updates: any = { failedLoginAttempts: newFailedAttempts };

            if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
                updates.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
            }
            
            await prisma.user.update({
                where: { id: user.id },
                data: updates
            });

            if (updates.lockoutUntil) {
                 throw new Error(`Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            }

            throw new Error("Invalid credentials");
        }
        
        // Reset failed attempts on successful login
        if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    lockoutUntil: null
                }
            });
        }

        return user;
      },
    }),
  ],
  cookies: (() => {
    const nextAuthUrl = (process.env.NEXTAUTH_URL || '').trim();
    const usesHttps = nextAuthUrl.toLowerCase().startsWith('https://');
    const namePrefix = usesHttps ? '__Secure-' : '';

    return {
      sessionToken: {
        name: `${namePrefix}next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          secure: usesHttps,
        },
      },
    };
  })(),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour of inactivity
    updateAge: 24 * 60 * 60, // 24 hours to force update
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

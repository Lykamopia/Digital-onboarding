

import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { headers } from 'next/headers';
import type { User, DelegationPermission } from "./types";
import { LogSeverity } from './types';
import { logSecurityEvent, SecurityEvent } from './security-logger';

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
        
        if (user.status === 'pending') {
             throw new Error("Account is pending activation. Please use the setup link in your email to set your password.");
        }

        if (user.lockoutUntil && new Date() < user.lockoutUntil) {
           const timeLeft = Math.ceil((user.lockoutUntil.getTime() - new Date().getTime()) / (1000 * 60));
           throw new Error(`Account locked. Please try again in ${timeLeft} minutes.`);
        }
        
        if (user.status === 'inactive') {
            throw new Error("Your account is deactivated. Please contact an administrator.");
        }

        if (!user.hashedPassword) {
            throw new Error("Password not set for this account. Please use the setup link sent to your email.");
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

            await logSecurityEvent({
                event: SecurityEvent.LOGIN_FAILURE,
                severity: LogSeverity.WARN,
                actor: { id: user.id, name: user.name || user.email },
                details: `Failed login attempt for user ${user.email}. Attempt ${newFailedAttempts} of ${MAX_FAILED_ATTEMPTS}.`,
            });

            if (updates.lockoutUntil) {
                 await logSecurityEvent({
                    event: SecurityEvent.ACCOUNT_LOCKED,
                    severity: LogSeverity.CRITICAL,
                    actor: { id: user.id, name: user.name || user.email },
                    details: `Account for user ${user.email} has been locked out after ${newFailedAttempts} failed login attempts.`,
                });
                 throw new Error(`Account locked due to too many failed attempts. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
            }

            throw new Error("Invalid credentials");
        }
        
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lockoutUntil: null,
            }
        });

        await logSecurityEvent({
            event: SecurityEvent.LOGIN_SUCCESS,
            severity: LogSeverity.INFO,
            actor: { id: user.id, name: user.name || user.email },
            details: `User ${user.email} logged in successfully.`,
        });

        (updatedUser as any).hashedPassword = null;

        return updatedUser;
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
    // Set a long maxAge for the session, e.g., 24 hours.
    // The session will be kept alive by `updateAge` as long as the user is active.
    maxAge: 24 * 60 * 60, // 24 hours
    
    // The session will be updated in the background every 20 minutes
    // if the user is active, creating a "sliding" session.
    updateAge: 20 * 60, // 20 minutes
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const headerList = headers();
      const ipAddress = headerList.get('x-forwarded-for') || headerList.get('cf-connecting-ip');
      const userAgent = headerList.get('user-agent');

      if (trigger === "update" && session?.onboardingCompleted === true) {
        token.onboardingCompleted = true;
      }
      
      if (trigger === "update" && session?.switch_to_delegator_id) {
          const delegateId = (token.realUser?.id || token.id) as string;
          const delegatorId = session.switch_to_delegator_id as string;
          
          const delegation = await prisma.delegation.findFirst({
              where: { delegatorId, delegateId }
          });
          
          if (delegation) {
              const delegator = await prisma.user.findUnique({ where: { id: delegatorId } });
              
              const isDelegatorActive = delegator && delegator.status === 'active' && (!delegator.lockoutUntil || new Date() > delegator.lockoutUntil);

              if (delegator && isDelegatorActive) {
                  // If not already delegated, store current user as realUser
                  if (!token.realUser) {
                      token.realUser = { id: token.id, name: token.name, email: token.email };
                  }
                  
                  await logSecurityEvent({
                      event: SecurityEvent.DELEGATION_SESSION_START,
                      severity: LogSeverity.INFO,
                      actor: { id: delegateId, name: token.realUser?.name },
                      details: `User ${token.realUser?.name} started acting on behalf of ${delegator.name}.`,
                      targetId: delegator.id,
                      targetType: 'User'
                  });

                  token.id = delegator.id;
                  token.name = delegator.name;
                  token.email = delegator.email;
                  token.picture = delegator.avatar;
                  token.onboardingCompleted = delegator.onboardingCompleted;
                  token.delegationPermissions = (delegation.permissions?.split(',') || []) as DelegationPermission[];
              }
          }
      } else if (trigger === "update" && session?.stop_delegation) {
          if (token.realUser) {
              const realUser = token.realUser as { id: string; name: string | null; email: string | null };
              
              await logSecurityEvent({
                  event: SecurityEvent.DELEGATION_SESSION_END,
                  severity: LogSeverity.INFO,
                  actor: realUser,
                  details: `User ${realUser.name} stopped acting on behalf of ${token.name}.`,
                  targetId: token.id as string,
                  targetType: 'User'
              });

              const realDbUser = await prisma.user.findUnique({ where: { id: realUser.id }});

              token.id = realUser.id;
              token.name = realUser.name;
              token.email = realUser.email;
              token.picture = realDbUser?.avatar;
              token.onboardingCompleted = realDbUser?.onboardingCompleted;
              
              delete token.realUser;
              delete token.delegationPermissions;
          }
      }

      if (user) { // This runs on initial sign-in
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
            // NOTE: The version is incremented on login to invalidate any other sessions that might exist.
            await prisma.user.update({
                where: { id: dbUser.id },
                data: { tokenVersion: { increment: 1 } }
            });
            token.tokenVersion = dbUser.tokenVersion + 1;
            token.onboardingCompleted = dbUser.onboardingCompleted;
        }
        token.id = user.id;
        token.ip = ipAddress;
        token.userAgent = userAgent;
      }
      
      // On subsequent requests, validate IP address
      if (token.ip && token.ip !== ipAddress) {
          await logSecurityEvent({
              event: SecurityEvent.SESSION_HIJACK_ATTEMPT,
              severity: LogSeverity.CRITICAL,
              actor: { id: token.id as string, name: token.name },
              details: `Session token for user ${token.name} used from a different IP address. Original: ${token.ip}, New: ${ipAddress}. Session invalidated.`,
          });
          return {}; // Invalidate session
      }
      
      // On subsequent requests, validate User Agent
      if (token.userAgent && token.userAgent !== userAgent) {
          await logSecurityEvent({
              event: SecurityEvent.USER_AGENT_MISMATCH,
              severity: LogSeverity.CRITICAL,
              actor: { id: token.id as string, name: token.name },
              details: `Session for user ${token.name} used with a different User-Agent, which could indicate a session hijack. Session invalidated. Original: ${token.userAgent}, New: ${userAgent}`,
          });
          return {}; // Invalidate session
      }

      // On subsequent requests, validate the token version
      const userIdToCheck = (token.realUser?.id || token.id) as string;
      if (userIdToCheck) {
          // Any valid token must have a version number. If not, invalidate it.
          if (typeof token.tokenVersion !== 'number') {
              await logSecurityEvent({
                  event: SecurityEvent.LOGOUT,
                  severity: LogSeverity.WARN,
                  actor: null,
                  details: 'A session was invalidated due to a missing token version.',
              });
              return {}; // Invalidate session
          }
          
          const dbUser = await prisma.user.findUnique({ where: { id: userIdToCheck }, select: { tokenVersion: true, onboardingCompleted: true } });
          
          if (!dbUser) {
              return {}; 
          }
          
          if (dbUser.tokenVersion !== token.tokenVersion) {
              const actorUser = await prisma.user.findUnique({ where: { id: userIdToCheck }, select: { id: true, name: true } });
              if (actorUser) {
                  await logSecurityEvent({
                      event: SecurityEvent.LOGOUT,
                      severity: LogSeverity.INFO,
                      actor: actorUser,
                      details: 'User session invalidated due to token version mismatch (likely remote logout).',
                  });
              }
              return {}; // Invalidate session
          }

          if (!token.realUser) { // Don't overwrite delegator's onboarding status
              token.onboardingCompleted = dbUser.onboardingCompleted;
          }

          // If this is a delegated session, perform continuous validation
          if (token.realUser) {
              const [delegation, delegator] = await Promise.all([
                  prisma.delegation.findFirst({
                      where: { delegatorId: token.id as string, delegateId: token.realUser.id as string }
                  }),
                  prisma.user.findUnique({ 
                      where: { id: token.id as string }, 
                      select: { status: true, lockoutUntil: true } 
                  })
              ]);
              
              const isDelegatorActive = delegator && delegator.status === 'active' && (!delegator.lockoutUntil || new Date() > delegator.lockoutUntil);

              if (!delegation || !isDelegatorActive) {
                  await logSecurityEvent({
                      event: SecurityEvent.DELEGATION_SESSION_END,
                      severity: LogSeverity.WARN,
                      actor: token.realUser,
                      details: `Delegated session for ${token.name} ended automatically because delegation was revoked or delegator account became inactive.`,
                      targetId: token.id as string,
                      targetType: 'User'
                  });
                  return {}; // Invalidate the delegated session
              }
          }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
        (session.user as any).onboardingCompleted = token.onboardingCompleted;

        if (token.realUser) {
            (session.user as any).isDelegated = true;
            (session.user as any).realUser = token.realUser;
            (session.user as any).delegationPermissions = token.delegationPermissions;
        } else {
            (session.user as any).isDelegated = false;
        }
      }
      return session;
    },
  },
};

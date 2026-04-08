'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getLoggedInUser } from './memo';

/**
 * Updates the profile of the currently logged-in user.
 * This action is isolated to avoid Next.js server action manifest glitches.
 */
export async function updateUserProfile(userId: string, data: { name: string, email: string, avatar?: string, signature?: string }) {
    const user = await getLoggedInUser();
    
    if (!user) {
        return { success: false, error: "Not authenticated" };
    }

    if (user.id !== userId) {
        return { success: false, error: "Unauthorized: You can only update your own profile" };
    }

    try {
        await prisma.user.update({ 
            where: { id: userId }, 
            data: { 
                name: data.name, 
                avatar: data.avatar, 
                signature: data.signature 
            } 
        });
        
        // Revalidate multiple paths to ensure UI is updated everywhere
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard/customer-onboarding');
        
        return { success: true };
    } catch (error: any) {
        console.error('[updateUserProfile] Error:', error);
        return { success: false, error: error.message || "Failed to update profile" };
    }
}

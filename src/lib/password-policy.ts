
import { z } from 'zod';
import { isPasswordPwned } from './pwned-password';

export const passwordRules = [
    { text: "At least 8 characters", regex: /.{8,}/ },
    { text: "An uppercase letter", regex: /[A-Z]/ },
    { text: "A lowercase letter", regex: /[a-z]/ },
    { text: "A number", regex: /[0-9]/ },
    { text: "A special character (!@#$%^&*)", regex: /[!@#$%^&*]/ }
];

// Combine all regex into a single Zod schema for validation
export const passwordSchema = z.string()
    .min(8, { message: "Password must be at least 8 characters long." })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
    .regex(/[0-9]/, { message: "Password must contain at least one number." })
    .regex(/[!@#$%^&*]/, { message: "Password must contain at least one special character (!@#$%^&*)." })
    .superRefine(async (password, ctx) => {
        try {
            const isPwned = await isPasswordPwned(password);
            if (isPwned) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "This password has been exposed in a data breach and is not safe to use. Please choose a different password.",
                });
            }
        } catch (error) {
            // In case of an API error, we fail open (allow the password)
            // to avoid blocking users if the HIBP service is down.
            console.error("Pwned password check failed:", error);
        }
    });

// Function to generate a random password that meets the policy
export function generateStrongPassword(length = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to ensure randomness
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

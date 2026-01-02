
'use server';

import { createHash } from 'crypto';

/**
 * Checks if a password has been exposed in a data breach using the k-Anonymity model of the Pwned Passwords API.
 * This function is safe to use as it only sends the first 5 characters of the SHA-1 hash of the password.
 * 
 * @param password The password to check.
 * @returns {Promise<boolean>} True if the password is pwned, false otherwise.
 * @throws {Error} if the API request fails for reasons other than a 404.
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  // 1. Create a SHA-1 hash of the password.
  const sha1Hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  
  // 2. Split the hash into a prefix (first 5 chars) and a suffix.
  const prefix = sha1Hash.substring(0, 5);
  const suffix = sha1Hash.substring(5);

  try {
    // 3. Query the Pwned Passwords API with the prefix.
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);

    if (!response.ok) {
        // A 404 is not an error; it just means no hashes with that prefix were found.
        if (response.status === 404) return false;
        throw new Error(`Failed to fetch pwned passwords data: ${response.statusText}`);
    }

    // 4. Process the response.
    const text = await response.text();
    const lines = text.split('\n');

    // 5. Check if the suffix exists in the response.
    for (const line of lines) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix === suffix) {
            // The password hash suffix was found.
            console.log(`Password pwned! Found with count: ${count}`);
            return true;
        }
    }
    
    // The password hash suffix was not found.
    return false;

  } catch (error) {
    console.error('Error checking pwned password API:', error);
    // Fail open: If the API is down, don't block the user.
    // In a higher-security environment, you might choose to fail closed.
    return false;
  }
}

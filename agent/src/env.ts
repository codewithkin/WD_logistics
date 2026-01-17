// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from agent directory
config({ path: resolve(process.cwd(), '.env') });

// Export for verification
export const env = process.env;

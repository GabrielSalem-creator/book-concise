-- Add credits system to user_preferences
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS daily_credits integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS last_credit_reset date DEFAULT CURRENT_DATE;

-- Update existing users to have credits
UPDATE user_preferences 
SET daily_credits = 2, last_credit_reset = CURRENT_DATE
WHERE daily_credits IS NULL;
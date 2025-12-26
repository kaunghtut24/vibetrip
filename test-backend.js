// Quick test to verify the backend server starts correctly
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

console.log('=== Backend Test ===');
console.log('1. API Key present:', Boolean(apiKey));
console.log('2. API Key length:', apiKey ? apiKey.length : 0);

try {
  const client = new GoogleGenAI({ apiKey });
  console.log('3. GoogleGenAI client created successfully ✓');
  
  // Test a simple generation
  console.log('4. Testing generateContent...');
  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: 'Say "Hello" in one word.',
  });
  
  console.log('5. Response received:', result.text);
  console.log('\n✓ Backend is working correctly!');
  process.exit(0);
} catch (err) {
  console.error('\n✗ Error:', err.message);
  console.error('Full error:', err);
  process.exit(1);
}


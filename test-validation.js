/**
 * Quick test script to verify validation middleware works correctly
 */

const testCases = [
  {
    name: 'Valid gemini-2.5-flash request',
    data: {
      model: 'gemini-2.5-flash',
      contents: 'Test prompt',
      config: { temperature: 0.7 }
    },
    shouldPass: true
  },
  {
    name: 'Valid gemini-3-flash-preview request',
    data: {
      model: 'gemini-3-flash-preview',
      contents: 'Test prompt',
      config: { temperature: 0.7 }
    },
    shouldPass: true
  },
  {
    name: 'Invalid model (non-Gemini)',
    data: {
      model: 'gpt-4',
      contents: 'Test prompt'
    },
    shouldPass: false
  },
  {
    name: 'Missing contents',
    data: {
      model: 'gemini-2.5-flash'
    },
    shouldPass: false
  },
  {
    name: 'Contents too large',
    data: {
      model: 'gemini-2.5-flash',
      contents: 'x'.repeat(60000) // 60KB
    },
    shouldPass: false
  }
];

async function runTests() {
  console.log('🧪 Testing Validation Middleware\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      const response = await fetch('http://localhost:8080/api/gemini/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data)
      });
      
      const isSuccess = response.ok;
      const expectedSuccess = test.shouldPass;
      
      if (isSuccess === expectedSuccess) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Expected: ${expectedSuccess ? 'pass' : 'fail'}, Got: ${isSuccess ? 'pass' : 'fail'}`);
        if (!response.ok) {
          const error = await response.json();
          console.log(`   Error: ${error.message}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Network error: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Wait for server to be ready
setTimeout(() => {
  runTests().catch(console.error);
}, 2000);


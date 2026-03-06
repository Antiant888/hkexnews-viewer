const cron = require('node-cron');
const fetch = require('node-fetch');

// Schedule automatic news fetching every 4 hours
// This will run at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
cron.schedule('0 */4 * * *', async () => {
  console.log('🔄 Starting scheduled news fetch at', new Date().toISOString());
  
  try {
    const response = await fetch('http://localhost:3000/api/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Scheduled fetch completed successfully');
      console.log('📊 Fetch results:', JSON.stringify(result.results, null, 2));
    } else {
      console.error('❌ Scheduled fetch failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error during scheduled fetch:', error.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Hong_Kong"
});

// Also schedule a daily full refresh at 2 AM Hong Kong time
cron.schedule('0 2 * * *', async () => {
  console.log('🔄 Starting daily full refresh at', new Date().toISOString());
  
  try {
    const response = await fetch('http://localhost:3000/api/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Daily refresh completed successfully');
      console.log('📊 Daily refresh results:', JSON.stringify(result.results, null, 2));
    } else {
      console.error('❌ Daily refresh failed with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error during daily refresh:', error.message);
  }
}, {
  scheduled: true,
  timezone: "Asia/Hong_Kong"
});

console.log('⏰ News scheduler started');
console.log('📅 Schedule:');
console.log('   - Every 4 hours: Regular news fetch');
console.log('   - Daily at 2 AM: Full refresh');
console.log('   - Timezone: Asia/Hong_Kong');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('🛑 Scheduler stopped');
  process.exit(0);
});
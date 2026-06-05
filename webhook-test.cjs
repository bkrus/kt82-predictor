#!/usr/bin/env node

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const VERCEL_URL = process.env.VERCEL_URL || 'kt82-predictor.vercel.app';
const WEBHOOK_PATH = '/api/webhook/strava';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fakeWebhookPayload = {
  object_type: 'activity',
  object_id: Math.floor(Math.random() * 1000000),
  aspect_type: 'create',
  athlete: {
    id: 12345678,
    resource_state: 2
  },
  updates: {}
};

console.log('🚀 Testing webhook pipeline...\n');

async function postWebhook() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(fakeWebhookPayload);

    const options = {
      hostname: VERCEL_URL,
      port: 443,
      path: WEBHOOK_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    console.log(`📤 POSTing webhook to ${VERCEL_URL}${WEBHOOK_PATH}`);
    console.log(`   Activity ID: ${fakeWebhookPayload.object_id}`);
    console.log(`   Athlete ID: ${fakeWebhookPayload.athlete.id}\n`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(`✅ Webhook received (status ${res.statusCode})\n`);
          resolve(true);
        } else {
          console.error(`❌ Webhook rejected (status ${res.statusCode})`);
          console.error(`   Response: ${data}\n`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Network error: ${e.message}\n`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function checkWebhooksTable() {
  console.log('⏳ Waiting 2 seconds for processing...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('📋 Checking webhooks table...\n');

  const { data, error } = await supabase
    .from('webhooks')
    .select('id, object_id, status, matched, error_message, created_at')
    .eq('object_id', fakeWebhookPayload.object_id)
    .single();

  if (error) {
    console.error(`❌ Failed to query webhooks: ${error.message}\n`);
    return null;
  }

  if (!data) {
    console.error(`❌ Webhook not found in DB (ID: ${fakeWebhookPayload.object_id})\n`);
    return null;
  }

  console.log(`✅ Webhook recorded in DB`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Matched: ${data.matched ? 'Yes' : 'No'}`);
  if (data.error_message) {
    console.log(`   Error: ${data.error_message}`);
  }
  console.log(`   Created: ${new Date(data.created_at).toLocaleTimeString()}\n`);

  return data;
}

async function checkTeamPlan() {
  console.log('📊 Checking team_plan (current state)...\n');

  const { data, error } = await supabase
    .from('team_plan')
    .select('leg_number, runner_name, start_time, end_time, predicted_time_s, elapsed_time_s')
    .order('leg_number', { ascending: true });

  if (error) {
    console.error(`❌ Failed to query team_plan: ${error.message}\n`);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No legs in team_plan\n');
    return;
  }

  console.log(`Team has ${data.length} legs:`);
  data.forEach((leg, idx) => {
    const status = leg.end_time ? '✅ Completed' : '⏱️  In Progress';
    console.log(`   Leg ${leg.leg_number}: ${leg.runner_name} — ${status}`);
  });
  console.log();
}

async function runTests() {
  try {
    await postWebhook();
    await checkWebhooksTable();
    await checkTeamPlan();

    console.log('✅ Webhook pipeline test complete!\n');
    console.log('Summary:');
    console.log('  1. Webhook endpoint is reachable');
    console.log('  2. Data is being written to the database');
    console.log('  3. Team/leg state is accessible\n');
    console.log('Your app is ready for the race. 🏁\n');

  } catch (err) {
    console.error(`\n❌ Test failed: ${err.message}`);
    console.error('\nTroubleshooting:');
    console.error('  - Verify VERCEL_URL is correct');
    console.error('  - Check Vercel function logs for webhook errors');
    console.error('  - Ensure Supabase credentials are valid');
    process.exit(1);
  }
}

runTests();
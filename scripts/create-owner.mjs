#!/usr/bin/env node

/**
 * One-time command to create the initial Owner account in Supabase.
 *
 * Usage:
 *   node scripts/create-owner.mjs [email] [password] [name]
 *
 * Example:
 *   node scripts/create-owner.mjs owner@manasu.com ManasuOwner2026! "Anand Kumar"
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// Load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\x1b[31mError:\x1b[0m Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
\x1b[36mManasu Restaurant - Initial Owner Account Creation\x1b[0m

Usage:
  npm run create-owner -- [email] [password] [name]
  or
  node scripts/create-owner.mjs [email] [password] [name]

Examples:
  npm run create-owner
  node scripts/create-owner.mjs owner@manasu.com ManasuOwner2026! "Anand Kumar"

Required Environment (.env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
  process.exit(0);
}

const email = (args[0] || 'owner@manasu.com').trim().toLowerCase();
const password = args[1] || 'ManasuOwner2026!';
const name = args[2] || 'Anand Kumar (Owner)';

if (password.length < 6) {
  console.error('\x1b[31mError:\x1b[0m Password must be at least 6 characters long.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function createOwnerAccount() {
  console.log(`\x1b[36mCreating Initial Owner Account for Manasu Restaurant...\x1b[0m`);
  console.log(`- Supabase URL: ${supabaseUrl}`);
  console.log(`- Email: ${email}`);
  console.log(`- Name:  ${name}`);

  let userId;

  // 1. Check if user already exists in auth.users
  const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('\x1b[31mFailed to list auth users:\x1b[0m', listError.message);
    process.exit(1);
  }

  const existingUser = userList.users.find(u => u.email?.toLowerCase() === email);

  if (existingUser) {
    console.log(`\x1b[33mAuth user already exists with ID: ${existingUser.id}. Updating password...\x1b[0m`);
    userId = existingUser.id;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { name, role: 'owner' },
    });

    if (updateError) {
      console.error('\x1b[31mFailed to update user password:\x1b[0m', updateError.message);
      process.exit(1);
    }
  } else {
    // Create new auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'owner' },
    });

    if (createError || !newUser.user) {
      console.error('\x1b[31mFailed to create user in auth.users:\x1b[0m', createError?.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`\x1b[32mCreated auth user with ID: ${userId}\x1b[0m`);
  }

  // 2. Upsert profile in profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name,
      role: 'owner',
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (profileError) {
    console.error('\x1b[31mFailed to upsert profile record:\x1b[0m', profileError.message);
    process.exit(1);
  }

  console.log('\n\x1b[32m✓ Owner account setup successful!\x1b[0m');
  console.log(`\nYou can now sign in at \x1b[34mhttp://localhost:3000/login\x1b[0m with:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}\n`);
}

createOwnerAccount().catch(err => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err);
  process.exit(1);
});

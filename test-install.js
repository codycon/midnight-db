#!/usr/bin/env node

/**
 * Installation Test Script
 * Verifies that all necessary files and dependencies are in place
 */

const fs = require('fs');
const path = require('path');

console.log('Testing Automod Bot Installation...\n');

let passed = 0;
let failed = 0;

function test(name, condition, fix = '') {
    if (condition) {
        console.log(`${name}`);
        passed++;
    } else {
        console.log(`${name}`);
        if (fix) console.log(`   Fix: ${fix}`);
        failed++;
    }
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
test(
    `Node.js version ${nodeVersion}`,
    majorVersion >= 16,
    'Install Node.js v16.9.0 or higher'
);

// Check for required files
test(
    'package.json exists',
    fs.existsSync('package.json'),
    'Run this script from the bot directory'
);

test(
    '.env file exists',
    fs.existsSync('.env'),
    'Copy .env.example to .env and fill in your credentials'
);

test(
    'index.js exists',
    fs.existsSync('index.js')
);

// Check directories
test('commands/admin directory exists', fs.existsSync('commands/admin'));
test('commands/utility directory exists', fs.existsSync('commands/utility'));
test('events directory exists', fs.existsSync('events'));
test('utils directory exists', fs.existsSync('utils'));

// Check critical files
const criticalFiles = [
    'utils/database.js',
    'utils/automodChecker.js',
    'utils/automodActions.js',
    'events/messageCreate.js',
    'events/interactionCreate.js',
    'events/ready.js',
    'deploy-commands.js'
];

criticalFiles.forEach(file => {
    test(`${file} exists`, fs.existsSync(file));
});

// Check for node_modules
test(
    'Dependencies installed (node_modules exists)',
    fs.existsSync('node_modules'),
    'Run: npm install'
);

// Check .env configuration
if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    test(
        '.env has DISCORD_TOKEN',
        envContent.includes('DISCORD_TOKEN=') && !envContent.includes('your_bot_token_here'),
        'Add your bot token to .env file'
    );
    test(
        '.env has DISCORD_CLIENT_ID',
        envContent.includes('DISCORD_CLIENT_ID=') && !envContent.includes('your_client_id_here'),
        'Add your client ID to .env file'
    );
}

// Count commands
try {
    const adminCommands = fs.readdirSync('commands/admin').filter(f => f.endsWith('.js'));
    const utilityCommands = fs.readdirSync('commands/utility').filter(f => f.endsWith('.js'));
    console.log(`\nFound ${adminCommands.length} admin commands and ${utilityCommands.length} utility commands`);
} catch (e) {
    console.log('Could not count commands');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\nAll tests passed! Your bot is ready to run.');
    console.log('\nNext steps:');
    console.log('1. npm run deploy-commands');
    console.log('2. npm start');
} else {
    console.log('\nPlease fix the issues above before running the bot.');
}

process.exit(failed > 0 ? 1 : 0);

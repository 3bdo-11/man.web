import { execSync, spawn } from 'child_process';
import { createInterface } from 'readline';
import { exit } from 'process';

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', ...opts }).trim();
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer); });
  });
}

function findAdb() {
  const candidates = [
    'adb',
    ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`] : []),
    ...(process.env.ANDROID_HOME ? [`${process.env.ANDROID_HOME}\\platform-tools\\adb.exe`] : []),
    ...(process.env.ANDROID_SDK_ROOT ? [`${process.env.ANDROID_SDK_ROOT}\\platform-tools\\adb.exe`] : []),
    'C:\\Users\\justa\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
  ];
  for (const c of candidates) {
    try { execSync(`"${c}" --version`, { stdio: 'pipe' }); return c; }
    catch { }
  }
  return null;
}

function printPairingInstructions() {
  console.log('');
  console.log('  ┌─────────────────────────────────────────────────────────────┐');
  console.log('  │  Wireless ADB Setup                                        │');
  console.log('  ├─────────────────────────────────────────────────────────────┤');
  console.log('  │  Option A — Android 11+ (Wireless debugging)               │');
  console.log('  │   1. Settings → Developer options → Wireless debugging     │');
  console.log('  │   2. Tap "Pair device with pairing code"                   │');
  console.log('  │   3. Run:  adb pair <ip>:<port>                            │');
  console.log('  │   4. Run:  adb connect <ip>:<port>                         │');
  console.log('  │                                                             │');
  console.log('  │  Option B — Legacy (any Android)                           │');
  console.log('  │   1. Connect device via USB                                │');
  console.log('  │   2. Run:  adb tcpip 5555                                  │');
  console.log('  │   3. Disconnect USB                                        │');
  console.log('  │   4. Run:  adb connect <ip-address>:5555                   │');
  console.log('  └─────────────────────────────────────────────────────────────┘');
  console.log('');
}

async function selectDevice(devices, label) {
  console.log(`\n  ${devices.map((d, i) => `${i + 1}. ${d}`).join('\n  ')}`);
  const choice = await prompt(`\n  Select ${label} [1-${devices.length}]: `);
  const idx = parseInt(choice, 10) - 1;
  if (idx >= 0 && idx < devices.length) return devices[idx];
  console.log('  Invalid selection.');
  return null;
}

function isWireless(id) {
  return /:\d+$/.test(id) && !id.startsWith('emulator');
}

async function main() {
  const isLive = process.argv.includes('--live');

  // 1. Find ADB
  const adb = findAdb();
  if (!adb) {
    console.log('\n  ❌ ADB not found. Install Android SDK platform-tools or set ANDROID_HOME.');
    exit(1);
  }

  console.log('\n  ── Wireless Android Deploy ──\n');

  // 2. List devices
  let devicesOutput;
  try {
    devicesOutput = run(`"${adb}" devices`);
  } catch {
    console.log('  ❌ Failed to run adb. Is the Android SDK properly installed?');
    exit(1);
  }

  const lines = devicesOutput.split('\n').slice(1).filter(l => l.trim() && !l.startsWith('*'));
  const wireless = [], usb = [];

  for (const line of lines) {
    const [id, state] = line.split('\t').map(s => s.trim());
    if (state !== 'device') continue;
    if (isWireless(id)) wireless.push(id);
    else usb.push(id);
  }

  let target = null;

  if (wireless.length > 0) {
    console.log(`  📶 Wireless device(s): ${wireless.join(', ')}`);
    if (wireless.length === 1) {
      target = wireless[0];
      console.log(`  → Using ${target}`);
    } else {
      target = await selectDevice(wireless, 'wireless device');
      if (!target) exit(1);
    }
  } else if (usb.length > 0) {
    console.log('  ❌ No wireless devices connected.');
    printPairingInstructions();
    const ok = await prompt('  Use USB device as fallback? (y/N): ');
    if (ok.toLowerCase() === 'y') {
      if (usb.length === 1) {
        target = usb[0];
        console.log(`  → Using USB: ${target}`);
      } else {
        target = await selectDevice(usb, 'USB device');
        if (!target) exit(1);
      }
    } else {
      console.log('\n  ℹ️  Run the pairing commands above, then re-run npm run cap:run\n');
      exit(0);
    }
  } else {
    console.log('  ❌ No Android devices found (USB or wireless).');
    printPairingInstructions();
    exit(1);
  }

  // 3. Build, sync, deploy
  console.log(`\n  ── Deploying to ${target} ──\n`);

  const capArgs = ['cap', 'run', 'android', '--target', target];

  if (isLive) {
    console.log('  🔴 Live reload mode (skipping build, using dev server)');
    capArgs.push('--live-reload', '--host=0.0.0.0');
  } else {
    console.log('  📦 Building web app...');
    execSync('npx vite build', { stdio: 'inherit', shell: true });

    console.log('\n  🔄 Syncing Capacitor...');
    execSync('npx cap sync', { stdio: 'inherit', shell: true });
  }

  console.log(`\n  🚀 Launching on ${target}...\n`);

  const child = spawn('npx', capArgs, { stdio: 'inherit', shell: true });

  child.on('exit', code => exit(code ?? 0));
  child.on('error', err => {
    console.error(`\n  ❌ ${err.message}`);
    exit(1);
  });
}

main();

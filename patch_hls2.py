# -*- coding: utf-8 -*-
import sys

filepath = r"C:\Users\Administrator\WorkBuddy\2026-05-13-task-2\LunaTV\src\app\play\page.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find the old HLS config (lowLatencyMode: true means cf100 old version)
hls_line = None
for i, line in enumerate(lines):
    if "lowLatencyMode: true" in line:
        hls_line = i
        break

if hls_line is None:
    print("lowLatencyMode: true not found, checking for other patterns...")
    for i, line in enumerate(lines):
        if "new Hls(" in line:
            hls_line = i
            print(f"  Found new Hls( at L{i+1}")
            break

if hls_line is None:
    print("ERROR: HLS config not found"); exit(1)

print(f"HLS config at L{hls_line+1}")

# Find the start of hlsConfig block - go backwards to "const hlsConfig: any = {"
cfg_start = None
for i in range(hls_line, max(hls_line - 20, 0), -1):
    if "const hlsConfig" in lines[i] or "const hls = new Hls(" in lines[i]:
        cfg_start = i
        break

# Find closing of config block (the "const hls = new Hls(hlsConfig);")
hls_new_line = None
for i in range(hls_line, min(hls_line + 30, len(lines))):
    if "const hls = new Hls(" in lines[i]:
        hls_new_line = i
        break

# For old cf100, the structure is:
# const hls = new Hls({ ... });
# We need to find the matching "});"
if hls_new_line is None:
    print("ERROR: const hls = new Hls not found"); exit(1)

brace = 0
found = False
hls_block_end = None
for i in range(hls_new_line, len(lines)):
    for ch in lines[i]:
        if ch == "{": brace += 1; found = True
        elif ch == "}": brace -= 1
    if found and brace == 0:
        # Find the );  closing
        rest = lines[i]
        if "});" in rest or ");" in rest:
            hls_block_end = i
            break

if hls_block_end is None:
    print("ERROR: end of Hls block not found"); exit(1)

print(f"HLS block: L{cfg_start+1 if cfg_start else hls_new_line+1}-L{hls_block_end+1}")

# Replace the entire block from cfg_start or hls_new_line to hls_block_end
start = cfg_start if cfg_start else hls_new_line
old_block = "".join(lines[start:hls_block_end+1])
print(f"Old block ({len(old_block)} chars): {old_block[:100]}...")

# Build new block
new_block = """            // Device detection (best practice from ergTV v6.6.0)
            const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
            const isIOS = /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
            const isIOS13 = isIOS || (userAgent.includes('Macintosh') && typeof navigator !== 'undefined' && navigator.maxTouchPoints >= 1);
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || isIOS13;

            // User buffer mode config
            const getHlsBufferConfig = () => {
              const mode = typeof window !== 'undefined'
                ? localStorage.getItem('playerBufferMode') || 'standard'
                : 'standard';
              switch (mode) {
                case 'enhanced':
                  return { maxBufferLength: 45, backBufferLength: 45, maxBufferSize: 90 * 1000 * 1000 };
                case 'max':
                  return { maxBufferLength: 90, backBufferLength: 60, maxBufferSize: 180 * 1000 * 1000 };
                case 'standard':
                default:
                  return { maxBufferLength: 30, backBufferLength: 30, maxBufferSize: 60 * 1000 * 1000 };
              }
            };

            // Network adaptive buffer
            const connection = (navigator as any).connection;
            const effectiveType = connection?.effectiveType || '4g';
            const isSlowNetwork = effectiveType === '2g' || effectiveType === 'slow-2g';
            const isMediumNetwork = effectiveType === '3g';
            const bufferConfig = getHlsBufferConfig();

            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: !isMobile,

              maxBufferLength: isMobile
                ? (isIOS13 ? 8 : isIOS ? 10 : 15)
                : (isSlowNetwork ? 60 : isMediumNetwork ? 90 : bufferConfig.maxBufferLength),
              backBufferLength: isMobile
                ? (isIOS13 ? 5 : isIOS ? 8 : 10)
                : bufferConfig.backBufferLength,
              maxBufferSize: isMobile
                ? (isIOS13 ? 20 * 1000 * 1000 : isIOS ? 30 * 1000 * 1000 : 40 * 1000 * 1000)
                : (isSlowNetwork ? 30 * 1000 * 1000 : bufferConfig.maxBufferSize),

              maxLoadingDelay: isMobile ? (isIOS13 ? 2 : 3) : 4,
              maxBufferHole: isMobile ? (isIOS13 ? 0.05 : 0.1) : 0.1,

              liveDurationInfinity: false,
              maxMaxBufferLength: isMobile ? (isIOS13 ? 60 : 120) : 600,
              maxFragLookUpTolerance: isMobile ? 0.1 : 0.25,

              startFragPrefetch: !isMobile,
              testBandwidth: !isIOS13,

              abrEwmaFastLive: isMobile ? 2 : 3,
              abrEwmaSlowLive: isMobile ? 6 : 9,
              abrBandWidthFactor: isMobile ? 0.8 : 0.95,
              abrBandWidthUpFactor: 0.7,

              fragLoadPolicy: {
                default: {
                  maxTimeToFirstByteMs: isMobile ? 6000 : 10000,
                  maxLoadTimeMs: isMobile ? 60000 : 120000,
                  timeoutRetry: {
                    maxNumRetry: isMobile ? 2 : 4,
                    retryDelayMs: 0,
                    maxRetryDelayMs: 0,
                  },
                  errorRetry: {
                    maxNumRetry: isMobile ? 3 : 6,
                    retryDelayMs: 1000,
                    maxRetryDelayMs: isMobile ? 4000 : 8000,
                  },
                },
              },

              loader: blockAdEnabledRef.current
                ? CustomHlsJsLoader
                : Hls.DefaultConfig.loader,
            });

            hls.loadSource(url);
            hls.attachMedia(video);
            video.hls = hls;

            ensureVideoSource(video, url);
"""

lines[start:hls_block_end+1] = [new_block]
print("OK1: HLS config replaced")

# Find and replace error handler
err_idx = None
for i, line in enumerate(lines):
    if "hls.on(Hls.Events.ERROR" in line:
        err_idx = i
        break

if err_idx is None:
    print("ERROR: error handler not found"); exit(1)

brace = 0
found_open = False
err_end = None
for i in range(err_idx, len(lines)):
    for ch in lines[i]:
        if ch == "{": brace += 1; found_open = True
        elif ch == "}": brace -= 1
    if found_open and brace == 0:
        err_end = i
        break

if err_end is None:
    print("ERROR: error handler end not found"); exit(1)

new_err = """            hls.on(Hls.Events.ERROR, function (event: any, data: any) {
              console.error('HLS Error:', event, data);

              if (data.details === 'fragParsingError') {
                console.log('frag parse error, retrying...');
                hls.startLoad();
                return;
              }

              if (data.details === 'bufferAppendError' &&
                  data.err && data.err.message &&
                  data.err.message.includes('timestamp')) {
                console.log('timestamp error, resetting buffer...');
                try {
                  const currentTime = video.currentTime;
                  hls.trigger(Hls.Events.BUFFER_RESET, undefined);
                  hls.startLoad(currentTime);
                } catch (e) {
                  console.warn('buffer reset failed:', e);
                  hls.startLoad();
                }
                return;
              }

              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('network error, recovering...');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('media error, recovering...');
                    hls.recoverMediaError();
                    break;
                  default:
                    console.log('unrecoverable error');
                    hls.destroy();
                    break;
                }
              }
            });
"""

lines[err_idx:err_end+1] = [new_err]
print("OK2: error handler replaced")

with open(filepath, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"SUCCESS: {len(lines)} lines")

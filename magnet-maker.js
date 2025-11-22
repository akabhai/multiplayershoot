// --- CRYPTO MODULE ---

document.addEventListener('DOMContentLoaded', () => {
    const btnGen = document.getElementById('gen-btn');
    const btnCopy = document.getElementById('copy-btn');
    const btnLaunch = document.getElementById('launch-btn');
    const output = document.getElementById('output-link');
    const roomInput = document.getElementById('room-name');
    
    // Auto-detect region for the UI
    document.getElementById('region-tag').value = detectRegion();

    // 1. GENERATE LINK
    btnGen.addEventListener('click', async () => {
        const seed = roomInput.value.trim() || `Sector-${Math.floor(Math.random()*9999)}`;
        const region = document.getElementById('region-tag').value;

        // Visual Feedback (Simulate Processing)
        btnGen.innerText = "ENCRYPTING...";
        btnGen.style.opacity = "0.7";
        output.value = "> Computing SHA-256 Hash...";

        // Heavy Crypto Simulation delay
        await new Promise(r => setTimeout(r, 600));

        // Generate Hash
        const hash = await generateSectorHash(seed);
        
        // Construct Magnet URI
        // Format: <Origin>/index.html#magnet:?xt=urn:arena:<HASH>&rg=<REGION>
        const origin = window.location.href.replace('magnet-maker.html', 'index.html');
        const cleanOrigin = origin.split('#')[0]; // Remove existing hashes
        
        const finalLink = `${cleanOrigin}#magnet:?xt=urn:arena:${hash}&rg=${region}`;
        
        output.value = finalLink;
        
        // Restore Button
        btnGen.innerText = "ENCRYPT LINK";
        btnGen.style.opacity = "1";
        
        // Pulse Effect on Output
        output.style.boxShadow = "0 0 20px var(--neon-blue)";
        setTimeout(() => output.style.boxShadow = "none", 500);
    });

    // 2. COPY TO CLIPBOARD
    btnCopy.addEventListener('click', () => {
        if (!output.value || output.value.startsWith('>')) return;

        output.select();
        document.execCommand('copy');
        
        const originalText = btnCopy.innerText;
        btnCopy.innerText = "COPIED!";
        btnCopy.style.background = "#fff";
        btnCopy.style.color = "#000";
        
        setTimeout(() => {
            btnCopy.innerText = originalText;
            btnCopy.style.background = "";
            btnCopy.style.color = "";
        }, 1500);
    });

    // 3. LAUNCH / TEST
    btnLaunch.addEventListener('click', () => {
        if (!output.value || output.value.startsWith('>')) {
            alert("Please generate a link first.");
            return;
        }
        window.open(output.value, '_blank');
    });
});

/**
 * Generates a secure hexadecimal hash from a string seed + timestamp
 */
async function generateSectorHash(seed) {
    const data = new TextEncoder().encode(seed + Date.now());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Convert to Hex and truncate to 16 chars for readability
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16).toUpperCase();
}

function detectRegion() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes("New_York") || tz.includes("Los_Angeles")) return "US-NORTH";
    if (tz.includes("London") || tz.includes("Berlin")) return "EU-WEST";
    if (tz.includes("Tokyo") || tz.includes("Seoul")) return "ASIA-EAST";
    return "GLOBAL-1";
}

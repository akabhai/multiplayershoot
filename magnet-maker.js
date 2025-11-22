document.getElementById('gen-btn').addEventListener('click', async () => {
    const room = document.getElementById('room-name').value;
    const region = document.getElementById('region').value;
    
    // Generate a unique ID
    const rawId = `${room}-${region}-${Date.now()}`;
    
    // SHA-256 Hash for integrity
    const msgBuffer = new TextEncoder().encode(rawId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create Magnet Structure
    // magnet:?xt=urn:arena:<ShortHash>&dn=<DisplayName>
    const shortHash = hashHex.substring(0, 12);
    const finalLink = `${window.location.origin}/index.html#magnet:?xt=urn:arena:${shortHash}&dn=${encodeURIComponent(room)}`;
    
    document.getElementById('output').value = finalLink;
});

document.getElementById('copy-btn').addEventListener('click', () => {
    const copyText = document.getElementById("output");
    copyText.select();
    document.execCommand("copy");
    alert("Link Copied to Clipboard!");
});

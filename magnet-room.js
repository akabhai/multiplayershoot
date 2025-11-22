class MagnetRoom {
    constructor() {
        this.roomId = null;
        this.region = "GLOBAL-1";
        
        // Initialize on load
        this.resolveConnection();
    }

    resolveConnection() {
        // Parse the URL Hash for Magnet Links
        // Format: index.html#magnet:?xt=urn:arena:<ID>&rg=<REGION>
        const hash = window.location.hash;
        
        if (hash.startsWith('#magnet:')) {
            this.connectToExisting(hash);
        } else {
            this.createNewSector();
        }
    }

    connectToExisting(hash) {
        try {
            // Parse parameters manually to avoid server dependencies
            const queryString = hash.substring(8); // Remove '#magnet:'
            const params = new URLSearchParams(queryString);
            
            const urn = params.get('xt');
            const region = params.get('rg');
            
            if (urn && urn.startsWith('urn:arena:')) {
                this.roomId = urn.split(':')[2];
                this.region = region || "UNKNOWN";
                console.log(`[NET] Locking on to Sector: ${this.roomId}`);
            } else {
                throw new Error("Invalid URN");
            }
        } catch (e) {
            console.warn("[NET] Magnet Link Corrupt. Re-routing...");
            this.createNewSector();
        }
    }

    createNewSector() {
        // Generate a new Cryptographic ID for the lobby
        const array = new Uint8Array(6);
        window.crypto.getRandomValues(array);
        const hexId = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        
        this.roomId = hexId;
        this.region = this.detectRegion();
        
        // Update the Browser URL without reloading
        const newLink = `#magnet:?xt=urn:arena:${this.roomId}&rg=${this.region}`;
        window.history.replaceState(null, null, newLink);
        
        console.log(`[NET] Sector Initialized: ${this.roomId}`);
    }

    detectRegion() {
        // Heuristic region detection based on Timezone
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.includes("New_York") || tz.includes("Los_Angeles")) return "US-NORTH";
        if (tz.includes("London") || tz.includes("Berlin")) return "EU-WEST";
        if (tz.includes("Tokyo") || tz.includes("Shanghai")) return "ASIA-EAST";
        return "GLOBAL-1";
    }
}

class MagnetRoom {
    constructor() {
        this.currentRoomId = null;
        this.parseMagnet();
    }

    parseMagnet() {
        // Check URL hash for room ID
        // Format: #magnet:?xt=urn:arena:<RoomID>&pk=<Key>
        const hash = window.location.hash;
        
        if (hash.startsWith('#magnet:')) {
            const params = new URLSearchParams(hash.substring(8));
            const xt = params.get('xt'); // urn:arena:12345
            
            if (xt && xt.startsWith('urn:arena:')) {
                this.currentRoomId = xt.split(':')[2];
                document.getElementById('room-display').innerText = `Linked to Sector: ${this.currentRoomId}`;
                return;
            }
        }

        // No room found? Generate a new shard
        this.createNewShard();
    }

    createNewShard() {
        // Shard ID based on Date + Random (Simulating a unique region)
        const shardId = 'shard_' + Math.floor(Math.random() * 9999);
        this.currentRoomId = shardId;
        
        // Update URL without reload
        const magnetLink = `#magnet:?xt=urn:arena:${shardId}`;
        history.replaceState(null, null, magnetLink);
        
        document.getElementById('room-display').innerText = `Hosting Sector: ${shardId}`;
    }

    checkOccupancy() {
        // In a real mesh, we would ask connected peers how many people are in the mesh.
        // If > 4, we generate a next-link and redirect new connections.
        const playerCount = 1; // Placeholder
        if (playerCount >= 4) {
            return false; // Room full
        }
        return true;
    }
}

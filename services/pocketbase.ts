import PocketBase from 'pocketbase';

// Factory function to create a client instance
// This allows the consuming app to specify the URL
export const createPocketBaseClient = (url: string) => {
    const pb = new PocketBase(url);
    // Disable auto cancellation to prevent race conditions in React effects
    pb.autoCancellation(false);
    return pb;
};
'use client';

import React from 'react';

/**
 * This page provides a view for the participants list.
 * Note: The primary participants view is handled dynamically within the meeting room,
 * but this route exists to satisfy structure requirements and provide a standalone view if needed.
 */
export default function ParticipantsPage() {
  return (
    <div className="container mx-auto p-8 text-center space-y-4">
      <h1 className="text-3xl font-bold">Meeting Participants</h1>
      <p className="text-muted-foreground">
        Access the participants list directly from within an active meeting session for real-time controls.
      </p>
    </div>
  );
}

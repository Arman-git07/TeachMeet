
import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

// This is a simple event emitter that will be used to bubble up
// Firestore permission errors to a centralized listener component.
export const errorEmitter = new EventEmitter<ErrorEvents>();

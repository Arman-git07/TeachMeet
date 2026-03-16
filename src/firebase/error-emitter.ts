import { EventEmitter } from 'events';
import type { FirestorePermissionError } from './errors';

// Define event type
type PermissionErrorListener = (error: FirestorePermissionError) => void;

class TypedErrorEmitter extends EventEmitter {
  emit(event: 'permission-error', error: FirestorePermissionError): boolean {
    return super.emit(event, error);
  }

  on(event: 'permission-error', listener: PermissionErrorListener): this {
    return super.on(event, listener);
  }
}

// Central emitter instance
export const errorEmitter = new TypedErrorEmitter();

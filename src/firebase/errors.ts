
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  readonly context: SecurityRuleContext;
  readonly cause?: Error;

  constructor(context: SecurityRuleContext, options?: { cause: Error }) {
    const message = `Firestore permission denied for operation '${context.operation}' on path '${context.path}'.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    this.cause = options?.cause;

    // This is to make sure the instance of check works correctly
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

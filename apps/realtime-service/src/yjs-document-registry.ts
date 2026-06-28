import * as Y from "yjs";

export class YjsDocumentRegistry {
  private docs = new Map<string, Y.Doc>();

  /**
   * Retrieves an active Y.Doc instance or instantiates a new one
   */
  getOrCreate(docId: string): Y.Doc {
    let doc = this.docs.get(docId);
    if (!doc) {
      doc = new Y.Doc();
      this.docs.set(docId, doc);
      console.log(`Initialized Y.Doc in-memory instance for: ${docId}`);
    }
    return doc;
  }

  /**
   * Retrieves an active Y.Doc if it exists in memory
   */
  get(docId: string): Y.Doc | undefined {
    return this.docs.get(docId);
  }

  /**
   * Safely destroys and removes the Y.Doc instance from memory
   */
  remove(docId: string): void {
    const doc = this.docs.get(docId);
    if (doc) {
      doc.destroy();
      this.docs.delete(docId);
      console.log(`🧹 Evicted Y.Doc instance from memory: ${docId}`);
    }
  }

  /**
   * Checks if the document is active in-memory
   */
  has(docId: string): boolean {
    return this.docs.has(docId);
  }

  /**
   * Returns all active document keys in this registry
   */
  keys(): string[] {
    return Array.from(this.docs.keys());
  }
}

export const documentRegistry = new YjsDocumentRegistry();

/**
 * Minimal placeholder for Node's `fs` module. Browser builds never invoke
 * the exported APIs, but the shim keeps bundlers happy when dependencies
 * import `fs` for typing purposes (e.g., PersonaLoader).
 */
export class Dirent {
  public readonly name = '';
  public isDirectory(): boolean {
    return false;
  }
  public isFile(): boolean {
    return false;
  }
  public isSymbolicLink(): boolean {
    return false;
  }
}

export default {
  Dirent,
};

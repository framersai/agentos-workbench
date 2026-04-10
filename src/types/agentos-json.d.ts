declare module '@framers/agentos/config/extension-secrets.json' {
  const value: Array<{
    id: string;
    label?: string;
    description?: string;
    envVar?: string;
    docsUrl?: string;
    optional?: boolean;
    providers?: string[];
  }>;

  export default value;
}

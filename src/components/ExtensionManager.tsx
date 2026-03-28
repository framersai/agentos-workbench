import React, { useMemo, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { HelpTooltip } from './ui/HelpTooltip';
import { ExtensionDependencyGraph } from './ExtensionDependencyGraph';
import {
  agentosClient,
  type ExtensionInfo,
  type ExtensionToolInfo,
} from '../lib/agentosClient';
import {
  Package,
  Search,
  Download,
  Check,
  AlertCircle,
  Code,
  Zap,
  RefreshCw,
  ChevronRight,
  Key,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Category color map — maps extension category slugs to Tailwind badge classes.
// ---------------------------------------------------------------------------

/** Color classes for category badges, keyed by category slug. */
const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-500/20 text-blue-400',
  research: 'bg-green-500/20 text-green-400',
  entertainment: 'bg-purple-500/20 text-purple-400',
  business: 'bg-amber-500/20 text-amber-400',
  media: 'bg-pink-500/20 text-pink-400',
  productivity: 'bg-cyan-500/20 text-cyan-400',
  tool: 'bg-slate-500/20 text-slate-400',
  integration: 'bg-orange-500/20 text-orange-400',
  voice: 'bg-indigo-500/20 text-indigo-400',
};

export const ExtensionManager: React.FC = () => {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [availableTools, setAvailableTools] = useState<ExtensionToolInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ExtensionToolInfo | null>(null);
  const [testInput, setTestInput] = useState('{}');
  const [testOutput, setTestOutput] = useState('');
  const [actionMessage, setActionMessage] = useState<string>('');
  /** Set of extension names currently toggled to "enabled" by the user. */
  const [enabledExtensions, setEnabledExtensions] = useState<Set<string>>(new Set());

  /**
   * Toggle an extension between enabled and disabled state.
   * This is a local UI toggle — it does not persist to the backend.
   */
  const toggleExtension = (name: string) => {
    setEnabledExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    loadExtensions();
    loadAvailableTools();
  }, []);

  const loadExtensions = async () => {
    setLoading(true);
    try {
      const response = await agentosClient.getExtensions();
      setExtensions(response);
    } catch (error) {
      console.error('Failed to load extensions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTools = async () => {
    try {
      const response = await agentosClient.getAvailableTools();
      setAvailableTools(response);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const installExtension = async (packageName: string) => {
    try {
      const result = await agentosClient.installExtension(packageName);
      setActionMessage(result.message);
      await loadExtensions();
      await loadAvailableTools();
    } catch (error) {
      console.error('Failed to install extension:', error);
      setActionMessage(error instanceof Error ? error.message : 'Failed to install extension');
    }
  };

  const testTool = async () => {
    if (!selectedTool) return;
    
    try {
      const input = JSON.parse(testInput);
      const result = await agentosClient.executeTool(selectedTool.id, input);
      setTestOutput(JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setTestOutput(`Error: ${message}`);
    }
  };

  const filteredExtensions = extensions.filter(ext => {
    if (selectedCategory !== 'all' && ext.category !== selectedCategory) {
      return false;
    }
    if (searchQuery && !ext.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !ext.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const categories = useMemo(
    () => [
      'all',
      ...Array.from(new Set(extensions.map((ext) => ext.category))).sort((left, right) =>
        left.localeCompare(right)
      ),
    ],
    [extensions]
  );

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Extension Manager</h2>
          <HelpTooltip label="Explain extension manager" side="bottom">
            Browse registry metadata, inspect surfaced tools, and test tool calls against the connected backend. In
            standalone mode some actions are simulated, so install and schema results can be lighter than a full runtime.
          </HelpTooltip>
        </div>
        <Button
          title="Reload extension registry entries and available tool metadata from the backend."
          onClick={() => { loadExtensions(); loadAvailableTools(); }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload
        </Button>
      </div>

      {actionMessage && (
        <div className="rounded-lg border theme-border theme-bg-secondary px-3 py-2 text-xs theme-text-secondary">
          {actionMessage}
        </div>
      )}

        <Tabs defaultValue="browse" className="flex-1">
          <TabsList>
          <TabsTrigger value="browse" title="Browse extension packs and install metadata.">Browse Extensions</TabsTrigger>
          <TabsTrigger value="tools" title="Inspect the tools currently surfaced by installed extensions.">Available Tools</TabsTrigger>
          <TabsTrigger value="test" title="Run a tool call against the backend with custom JSON input.">Test Tools</TabsTrigger>
          <TabsTrigger value="graph" title="Visualize extension-to-tool relationships as a force-directed graph.">Dependencies</TabsTrigger>
          </TabsList>

        {/* Browse Extensions Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex space-x-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'primary' : 'outline'}
                  size="sm"
                  title={`Filter the extension list to ${cat === 'all' ? 'all categories' : cat}.`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'all'
                    ? 'All'
                    : cat.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>

          {/* Extensions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              filteredExtensions.map(ext => (
                <Card key={ext.id} className="p-4 space-y-3 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{ext.name}</h3>
                        {ext.verified && (
                          <Badge
                            variant="success"
                            size="xs"
                            className="uppercase tracking-wider"
                            title="Verified via AgentOS standards (tests, docs, security). See Admin Policy."
                          >
                            Verified
                          </Badge>
                        )}
                        {/* Category color badge */}
                        {ext.category && (
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                              CATEGORY_COLORS[ext.category.toLowerCase()] ?? 'bg-slate-500/20 text-slate-400'
                            )}
                          >
                            {ext.category}
                          </span>
                        )}
                        {/* API key required indicator */}
                        {ext.requiredSecrets && ext.requiredSecrets.length > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-amber-400"
                            title={`Requires secrets: ${ext.requiredSecrets.join(', ')}`}
                          >
                            <Key className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{ext.package}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Enable/disable toggle */}
                      <button
                        onClick={() => toggleExtension(ext.name)}
                        title={enabledExtensions.has(ext.name) ? `Disable ${ext.name}.` : `Enable ${ext.name}.`}
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                          enabledExtensions.has(ext.name)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        )}
                      >
                        {enabledExtensions.has(ext.name) ? 'Enabled' : 'Disabled'}
                      </button>
                      {ext.installed ? (
                        <Badge variant="success">
                          <Check className="w-3 h-3 mr-1" />
                          Installed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          title="Install or connect this extension pack in the current runtime mode."
                          onClick={() => installExtension(ext.package)}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm">{ext.description}</p>

                  {ext.features && ext.features.length > 0 && (
                    <div className="space-y-1">
                      {ext.features.slice(0, 2).map((feature) => (
                        <p key={feature} className="text-xs text-muted-foreground">
                          {feature}
                        </p>
                      ))}
                    </div>
                  )}
                  
                  {ext.tools && ext.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ext.tools.map(tool => (
                        <Badge key={tool} variant="secondary" size="sm">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {ext.platforms && ext.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ext.platforms.map((platform) => (
                        <Badge key={platform} variant="secondary" size="sm">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {(ext.requiredEnvVars?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ext.requiredEnvVars!.map((envVar) => (
                        <Badge key={envVar} variant="warning" size="sm">
                          {envVar}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {ext.configuration && Object.keys(ext.configuration).length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(
                        (ext.configuration.properties as Record<string, unknown> | undefined) ?? ext.configuration
                      ).length} configuration fields
                    </div>
                  )}
                  
                  {ext.author && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>by {ext.author.name}</span>
                      <span>v{ext.version}</span>
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Available Tools Tab */}
        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableTools.map(tool => (
              <Card 
                key={tool.id} 
                className="p-4 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
                title="Open this tool in the testing panel with its schemas and metadata."
                onClick={() => setSelectedTool(tool)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{tool.name}</h3>
                  </div>
                  {tool.hasSideEffects && (
                    <Badge variant="warning" size="sm">
                      <Zap className="w-3 h-3 mr-1" />
                      Side Effects
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground">{tool.description}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {tool.kind ? `${tool.kind} · ` : ''}from {tool.extension}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Test Tools Tab */}
        <TabsContent value="test" className="space-y-4">
          {selectedTool ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tool Details */}
              <Card className="p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedTool.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedTool.description}</p>
                  {selectedTool.extensionPackage && (
                    <p className="mt-1 text-xs font-mono text-muted-foreground">
                      {selectedTool.extensionPackage}
                    </p>
                  )}
                </div>
                
                {/* Input Schema */}
                {selectedTool.inputSchema && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Input Schema</h4>
                    <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-48">
                      {JSON.stringify(selectedTool.inputSchema, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Output Schema */}
                {selectedTool.outputSchema && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Output Schema</h4>
                    <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-48">
                      {JSON.stringify(selectedTool.outputSchema, null, 2)}
                    </pre>
                  </div>
                )}

                {!selectedTool.inputSchema && !selectedTool.outputSchema && (
                  <p className="text-xs text-muted-foreground">
                    This registry entry exposes tool metadata only. Runtime schemas are not surfaced in standalone mode.
                  </p>
                )}
              </Card>
              
              {/* Test Interface */}
              <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Test Execution</h4>
                  <HelpTooltip label="Explain tool testing" side="bottom">
                    Use this panel to send JSON input directly to the selected tool. It is best for quick payload and
                    schema checks, not for validating full workflow behavior.
                  </HelpTooltip>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Input JSON</label>
                  <textarea
                    className="w-full h-32 p-2 border rounded font-mono text-sm"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Enter JSON input..."
                  />
                </div>
                
                <Button onClick={testTool} className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  Execute Tool
                </Button>
                
                {testOutput && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Output</label>
                    <pre className="w-full h-48 p-2 border rounded font-mono text-sm overflow-auto bg-secondary">
                      {testOutput}
                    </pre>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p>Select a tool from the Available Tools tab to test it</p>
            </div>
          )}
        </TabsContent>

        {/* Dependency Graph Tab */}
        <TabsContent value="graph" className="space-y-4">
          <ExtensionDependencyGraph extensions={extensions} tools={availableTools} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

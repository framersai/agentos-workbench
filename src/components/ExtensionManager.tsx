import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { agentosClient } from '../lib/agentosClient';
import {
  Package,
  Search,
  Download,
  Check,
  AlertCircle,
  Code,
  Shield,
  Zap,
  RefreshCw,
  ChevronRight
} from 'lucide-react';

interface Extension {
  id: string;
  name: string;
  package: string;
  version: string;
  description: string;
  category: string;
  verified?: boolean;
  installed?: boolean;
  tools?: string[];
  author?: {
    name: string;
    url?: string;
  };
}

interface Tool {
  id: string;
  name: string;
  description: string;
  extension: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  hasSideEffects?: boolean;
}

export const ExtensionManager: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [testInput, setTestInput] = useState('{}');
  const [testOutput, setTestOutput] = useState('');

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
      await agentosClient.installExtension(packageName);
      await loadExtensions();
      await loadAvailableTools();
    } catch (error) {
      console.error('Failed to install extension:', error);
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

  const categories = ['all', 'research', 'integrations', 'productivity', 'development', 'utilities'];

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Extension Manager</h2>
        </div>
        <Button onClick={() => { loadExtensions(); loadAvailableTools(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload
        </Button>
      </div>

      <Tabs defaultValue="browse" className="flex-1">
        <TabsList>
          <TabsTrigger value="browse">Browse Extensions</TabsTrigger>
          <TabsTrigger value="tools">Available Tools</TabsTrigger>
          <TabsTrigger value="test">Test Tools</TabsTrigger>
        </TabsList>

        {/* Browse Extensions Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex space-x-4">
            <div className="flex-1">
              <Input
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex space-x-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
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
                          <Shield className="w-4 h-4 text-blue-500" title="Verified" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{ext.package}</p>
                    </div>
                    {ext.installed ? (
                      <Badge variant="success">
                        <Check className="w-3 h-3 mr-1" />
                        Installed
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => installExtension(ext.package)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Install
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-sm">{ext.description}</p>
                  
                  {ext.tools && ext.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ext.tools.map(tool => (
                        <Badge key={tool} variant="secondary" size="sm">
                          {tool}
                        </Badge>
                      ))}
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
                  <span className="text-muted-foreground">from {tool.extension}</span>
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
              </Card>
              
              {/* Test Interface */}
              <Card className="p-4 space-y-4">
                <h4 className="font-medium">Test Execution</h4>
                
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
      </Tabs>
    </div>
  );
};

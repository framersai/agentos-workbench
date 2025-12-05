/**
 * @file MarketplaceBrowser.tsx
 * @description Agent Marketplace browser component for discovering,
 * installing, and managing agents, personas, and extensions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Star,
  Package,
  User,
  Filter,
  Grid,
  List,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  Trash2,
  Settings,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Tabs } from './ui/Tabs';

// Types matching the marketplace interface
interface MarketplaceItem {
  id: string;
  type: 'agent' | 'persona' | 'workflow' | 'extension' | 'template';
  name: string;
  description: string;
  version: string;
  publisher: {
    id: string;
    name: string;
    verified: boolean;
  };
  categories: string[];
  tags: string[];
  license: string;
  pricing: {
    model: string;
    priceInCents?: number;
  };
  stats: {
    downloads: number;
    activeInstalls: number;
    views: number;
  };
  ratings: {
    average: number;
    count: number;
  };
  iconUrl?: string;
}

interface InstalledItem {
  installationId: string;
  itemId: string;
  version: string;
  status: string;
  installedAt: string;
  autoUpdate: boolean;
}

interface MarketplaceBrowserProps {
  /** API endpoint for marketplace */
  apiEndpoint?: string;
  /** Callback when an item is installed */
  onInstall?: (item: MarketplaceItem) => void;
  /** Callback when an item is uninstalled */
  onUninstall?: (installationId: string) => void;
}

/**
 * Marketplace browser component
 */
export function MarketplaceBrowser({
  apiEndpoint = '/api/marketplace',
  onInstall,
  onUninstall,
}: MarketplaceBrowserProps) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [installedItems, setInstalledItems] = useState<InstalledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);

  // Fetch marketplace items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedType !== 'all') params.append('types', selectedType);
      if (selectedCategory !== 'all') params.append('categories', selectedCategory);

      const response = await fetch(`${apiEndpoint}/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch marketplace items:', error);
      // Use mock data for demo
      setItems(getMockItems());
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, searchQuery, selectedType, selectedCategory]);

  // Fetch installed items
  const fetchInstalled = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}/installed`);
      if (response.ok) {
        const data = await response.json();
        setInstalledItems(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch installed items:', error);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    fetchItems();
    fetchInstalled();
  }, [fetchItems, fetchInstalled]);

  // Install an item
  const handleInstall = async (item: MarketplaceItem) => {
    try {
      const response = await fetch(`${apiEndpoint}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setInstalledItems(prev => [...prev, result.installation]);
          onInstall?.(item);
        }
      }
    } catch (error) {
      console.error('Failed to install item:', error);
    }
  };

  // Uninstall an item
  const handleUninstall = async (installationId: string) => {
    try {
      const response = await fetch(`${apiEndpoint}/uninstall/${installationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setInstalledItems(prev => prev.filter(i => i.installationId !== installationId));
        onUninstall?.(installationId);
      }
    } catch (error) {
      console.error('Failed to uninstall item:', error);
    }
  };

  // Check if an item is installed
  const isInstalled = (itemId: string) => {
    return installedItems.some(i => i.itemId === itemId);
  };

  // Get installation for an item
  const getInstallation = (itemId: string) => {
    return installedItems.find(i => i.itemId === itemId);
  };

  // Render item card
  const renderItemCard = (item: MarketplaceItem) => {
    const installed = isInstalled(item.id);
    const installation = getInstallation(item.id);

    return (
      <Card
        key={item.id}
        className={`p-4 cursor-pointer hover:border-accent transition-colors ${
          selectedItem?.id === item.id ? 'border-accent' : ''
        }`}
        onClick={() => setSelectedItem(item)}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-surface-elevated flex items-center justify-center">
            {item.iconUrl ? (
              <img src={item.iconUrl} alt={item.name} className="w-8 h-8" />
            ) : (
              <Package className="w-6 h-6 text-muted" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{item.name}</h3>
              {item.publisher.verified && (
                <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted truncate">{item.description}</p>

            {/* Meta */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.publisher.name}
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {formatNumber(item.stats.downloads)}
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                {item.ratings.average.toFixed(1)}
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="secondary" size="sm">
                {item.type}
              </Badge>
              {item.pricing.model !== 'free' && (
                <Badge variant="accent" size="sm">
                  {item.pricing.model}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {installed ? (
              <>
                <Badge variant="success" size="sm">
                  Installed
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (installation) handleUninstall(installation.installationId);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstall(item);
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                Install
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Render item details panel
  const renderDetailsPanel = () => {
    if (!selectedItem) {
      return (
        <div className="flex items-center justify-center h-full text-muted">
          Select an item to view details
        </div>
      );
    }

    const installed = isInstalled(selectedItem.id);
    const installation = getInstallation(selectedItem.id);

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg bg-surface-elevated flex items-center justify-center">
            {selectedItem.iconUrl ? (
              <img src={selectedItem.iconUrl} alt={selectedItem.name} className="w-12 h-12" />
            ) : (
              <Package className="w-8 h-8 text-muted" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{selectedItem.name}</h2>
              {selectedItem.publisher.verified && (
                <CheckCircle className="w-5 h-5 text-accent" />
              )}
            </div>
            <p className="text-muted">{selectedItem.publisher.name}</p>
            <p className="text-sm text-muted">v{selectedItem.version}</p>
          </div>
          <div>
            {installed ? (
              <div className="flex gap-2">
                <Button variant="secondary">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="danger"
                  onClick={() => installation && handleUninstall(installation.installationId)}
                >
                  Uninstall
                </Button>
              </div>
            ) : (
              <Button onClick={() => handleInstall(selectedItem)}>
                <Download className="w-4 h-4 mr-2" />
                Install
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold">{formatNumber(selectedItem.stats.downloads)}</div>
            <div className="text-sm text-muted">Downloads</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
              {selectedItem.ratings.average.toFixed(1)}
            </div>
            <div className="text-sm text-muted">{selectedItem.ratings.count} ratings</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold">{formatNumber(selectedItem.stats.activeInstalls)}</div>
            <div className="text-sm text-muted">Active Installs</div>
          </Card>
        </div>

        {/* Description */}
        <div>
          <h3 className="font-medium mb-2">Description</h3>
          <p className="text-secondary">{selectedItem.description}</p>
        </div>

        {/* Categories & Tags */}
        <div>
          <h3 className="font-medium mb-2">Categories & Tags</h3>
          <div className="flex flex-wrap gap-2">
            {selectedItem.categories.map(cat => (
              <Badge key={cat} variant="secondary">{cat}</Badge>
            ))}
            {selectedItem.tags.map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
          </div>
        </div>

        {/* License */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">License</span>
          <span>{selectedItem.license}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-divider">
        <h1 className="text-xl font-semibold">Marketplace</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchItems}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="px-4 pt-2"
      >
        <Tabs.List>
          <Tabs.Trigger value="browse">Browse</Tabs.Trigger>
          <Tabs.Trigger value="installed">
            Installed ({installedItems.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="updates">Updates</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {/* Search & Filters */}
      <div className="p-4 border-b border-divider space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <Input
              placeholder="Search marketplace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-surface border border-divider rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All Types</option>
            <option value="agent">Agents</option>
            <option value="persona">Personas</option>
            <option value="workflow">Workflows</option>
            <option value="extension">Extensions</option>
            <option value="template">Templates</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-surface border border-divider rounded px-3 py-1.5 text-sm"
          >
            <option value="all">All Categories</option>
            <option value="productivity">Productivity</option>
            <option value="development">Development</option>
            <option value="research">Research</option>
            <option value="automation">Automation</option>
            <option value="integrations">Integrations</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Items List */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-muted" />
            </div>
          ) : activeTab === 'browse' ? (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-3'}>
              {items.map(renderItemCard)}
            </div>
          ) : activeTab === 'installed' ? (
            <div className="space-y-3">
              {installedItems.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  No items installed yet
                </div>
              ) : (
                installedItems.map(inst => {
                  const item = items.find(i => i.id === inst.itemId);
                  return item ? renderItemCard(item) : null;
                })
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              No updates available
            </div>
          )}
        </div>

        {/* Details Panel */}
        <div className="w-96 border-l border-divider bg-surface-elevated overflow-auto hidden lg:block">
          {renderDetailsPanel()}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getMockItems(): MarketplaceItem[] {
  return [
    {
      id: '1',
      type: 'agent',
      name: 'Research Assistant',
      description: 'An AI agent specialized in web research, fact-checking, and summarization.',
      version: '1.2.0',
      publisher: { id: 'framers', name: 'Frame.dev', verified: true },
      categories: ['productivity', 'research'],
      tags: ['research', 'summarization', 'web-search'],
      license: 'MIT',
      pricing: { model: 'free' },
      stats: { downloads: 12500, activeInstalls: 8200, views: 45000 },
      ratings: { average: 4.8, count: 342 },
    },
    {
      id: '2',
      type: 'persona',
      name: 'Code Reviewer',
      description: 'A persona for detailed, constructive code reviews with best practices.',
      version: '1.0.0',
      publisher: { id: 'framers', name: 'Frame.dev', verified: true },
      categories: ['development', 'code-quality'],
      tags: ['code-review', 'development', 'best-practices'],
      license: 'MIT',
      pricing: { model: 'free' },
      stats: { downloads: 8700, activeInstalls: 5400, views: 32000 },
      ratings: { average: 4.6, count: 218 },
    },
    {
      id: '3',
      type: 'workflow',
      name: 'Document Analysis Pipeline',
      description: 'Automated workflow for analyzing, summarizing, and extracting insights.',
      version: '2.0.0',
      publisher: { id: 'framers', name: 'Frame.dev', verified: true },
      categories: ['automation', 'documents'],
      tags: ['document', 'analysis', 'extraction'],
      license: 'Apache-2.0',
      pricing: { model: 'free' },
      stats: { downloads: 5200, activeInstalls: 3100, views: 18000 },
      ratings: { average: 4.5, count: 156 },
    },
    {
      id: '4',
      type: 'extension',
      name: 'Slack Integration',
      description: 'Connect your agents to Slack for notifications and commands.',
      version: '1.1.0',
      publisher: { id: 'framers', name: 'Frame.dev', verified: true },
      categories: ['integrations', 'communication'],
      tags: ['slack', 'notifications', 'integration'],
      license: 'MIT',
      pricing: { model: 'free' },
      stats: { downloads: 9800, activeInstalls: 6500, views: 28000 },
      ratings: { average: 4.7, count: 289 },
    },
  ];
}

export default MarketplaceBrowser;


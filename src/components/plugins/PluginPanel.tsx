import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { KnowledgePluginUI } from './KnowledgePluginUI';
import { SportradarPluginUI } from './SportradarPluginUI';
import { useAgentPanels } from '@/hooks/useAgent';

export interface PluginPanelProps {
  agentId: string;
}

export function PluginPanel({ agentId }: PluginPanelProps) {
  const { data: panels, isLoading } = useAgentPanels(agentId);

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading plugins...</div>;
  }

  if (!panels || panels.data.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No plugins available</div>;
  }

  return (
    <Tabs defaultValue={panels.data[0]?.name} className="w-full">
      <TabsList className="w-full">
        {panels.data.map((panel) => (
          <TabsTrigger key={panel.name} value={panel.name}>
            {panel.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {panels.data.map((panel) => (
        <TabsContent key={panel.name} value={panel.name} className="mt-4">
          {panel.name === 'Knowledge' && <KnowledgePluginUI agentId={agentId} panelPath={panel.path} />}
          {panel.name === 'Sportradar' && <SportradarPluginUI agentId={agentId} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}

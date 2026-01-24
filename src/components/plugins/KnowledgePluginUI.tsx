import { useState } from 'react';
import { Upload, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import apiClient from '@/services/api/client';

export interface KnowledgePluginUIProps {
  agentId: string;
  panelPath: string;
}

export function KnowledgePluginUI({ agentId: _agentId, panelPath }: KnowledgePluginUIProps) {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<Array<{ name: string; id: string }>>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post(panelPath.replace('/display', '/upload'), formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFiles((prev) => [...prev, { name: file.name, id: response.data.id || Date.now().toString() }]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-4">Upload documents for RAG</p>
        <label>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            accept=".pdf,.txt,.md,.doc,.docx"
          />
          <Button disabled={uploading}>
            {uploading ? 'Uploading...' : 'Choose File'}
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Uploaded Documents</h3>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{file.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

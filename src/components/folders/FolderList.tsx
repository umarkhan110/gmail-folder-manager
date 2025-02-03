"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { FolderOpen, Plus, Trash } from 'lucide-react';

interface Folder {
  id: string;
  displayName: string;
  description?: string;
}

export function FolderList() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      const data = await res.json();
      setFolders(data);
    } catch (error) {
      toast.error('Failed to fetch folders');
    } finally {
      setIsLoading(false);
    }
  };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newFolderName,
          description: newFolderDescription 
        }),
      });

      if (!res.ok) throw new Error('Failed to create folder');
      
      await fetchFolders();
      setNewFolderName('');
      setNewFolderDescription('');
      toast.success('Folder created successfully');
    } catch (error) {
      toast.error('Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder?')) {
      return;
    }

    try {
      const res = await fetch('/api/folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === 'ErrorDeleteDistinguishedFolder') {
          toast.error('Cannot delete default Outlook folders');
          return;
        }
        throw new Error(data.error || 'Failed to delete folder');
      }

      setFolders(folders.filter(folder => folder.id !== folderId));
      toast.success('Folder deleted successfully');
    } catch (error) {
      toast.error('Failed to delete folder');
    }
  };

  if (isLoading) return <div>Loading folders...</div>;

  return (
    <div className="space-y-6">
      <form onSubmit={createFolder} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Folder Name</label>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Enter folder name"
            disabled={isCreating}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description (optional)</label>
          <Input
            value={newFolderDescription}
            onChange={(e) => setNewFolderDescription(e.target.value)}
            placeholder="Enter folder description"
            disabled={isCreating}
          />
        </div>
        <Button type="submit" disabled={isCreating}>
          <Plus className="h-4 w-4 mr-2" />
          {isCreating ? 'Creating...' : 'Create Folder'}
        </Button>
      </form>

      <div className="grid gap-4">
        {folders.map(folder => (
          <div 
            key={folder.id}
            className="p-4 border rounded-lg flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                <span className="font-medium">{folder.displayName}</span>
              </div>
              {folder.description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {folder.description}
                </div>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteFolder(folder.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
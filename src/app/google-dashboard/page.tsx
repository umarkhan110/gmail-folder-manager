/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LogOut, FolderOpen, Home } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "react-hot-toast"
import { LicenseActivation } from '@/components/LicenseActivation'
import { SignOutOptions } from "@/components/SignOutOptions"

interface Folder {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession()

  const handleForceNewLogin = async () => {
    // Clear local session
    await signOut({ redirect: false });

    // Clear Microsoft login state
    // window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session?.user?.email) {
    return window.location.href = '/';
  }

  return (
    <div className="container max-w-4xl mx-auto p-8">
      <Card className="bg-card border-border/10 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/'}
            >
              <Home className="h-4 w-4" />
            </Button>
            <CardTitle>Google Folders</CardTitle>
            {status === "authenticated" && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{session.user.name}</span>
                <span className="mx-1">·</span>
                <span>{session.user.email}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => signOut({ redirect: false })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceNewLogin}
            >
              Force New Login
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <FolderList />
        </CardContent>
      </Card>
    </div>
  )
}

function FolderList() {
  const { data: session } = useSession()
  const [folders, setFolders] = useState<Folder[]>([])
  const [error, setError] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [descriptionInputs, setDescriptionInputs] = useState<{ [key: string]: string }>({})
  const [hasLicense, setHasLicense] = useState(true)
  const [showSystemFolders, setShowSystemFolders] = useState(false)

  const SYSTEM_FOLDERS = [
    'archive',
    'conversation history',
    'deleted items',
    'drafts',
    'inbox',
    'junk email',
    'outbox',
    'sent items',
  ].map(name => name.toLowerCase())

  const displayedFolders = folders.filter(folder =>
    showSystemFolders ? true : folder.type !== 'system'
  )

  // useEffect(() => {
  //   const checkLicense = async () => {
  //     try {
  //       const res = await fetch('/api/license')
  //       if (!res.ok) {
  //         throw new Error('License check failed')
  //       }
  //       const data = await res.json()
  //       setHasLicense(data.hasValidLicense)
  //     } catch (error) {
  //       console.error('Error checking license:', error)
  //       setHasLicense(false)
  //     } finally {
  //       setIsLoading(false)
  //     }
  //   }

  //   if (session) {
  //     checkLicense()
  //   } else {
  //     setIsLoading(false)
  //   }
  // }, [session])

  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/google-folders')
      if (!res.ok) {
        if (res.status === 401) {
          // setHasLicense(false)
          setIsLoading(false)
          return
        }
        throw new Error('Failed to fetch folders')
      }
      const data = await res.json()
      // console.log('Raw folders from API:', data) // Debug log
      setFolders(data)

      // Debug log after filtering
      // console.log('Displayed folders after filter:', displayedFolders)
    } catch (error) {
      console.error('Error fetching folders:', error)
      toast.error('Failed to fetch folders')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session && hasLicense) {
      fetchFolders()
    }
  }, [session, hasLicense])

  useEffect(() => {
    const initialInputs = folders.reduce((acc, folder) => {
      acc[folder.id] = folder.description || ''
      return acc
    }, {} as { [key: string]: string })
    setDescriptionInputs(initialInputs)
  }, [folders])

  const createFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      const res = await fetch('/api/google-folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName,
          description: newFolderDescription,
        }),
      })

      if (!res.ok) throw new Error('Failed to create folder')

      // Refresh folders list
      const updatedRes = await fetch('/api/google-folders')
      const updatedFolders = await updatedRes.json()
      setFolders(updatedFolders)

      // Clear inputs
      setNewFolderName('')
      setNewFolderDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDescriptionChange = (folderId: string, value: string) => {
    setDescriptionInputs(prev => ({
      ...prev,
      [folderId]: value
    }))
  }

  const handleSaveDescription = async (folderId: string) => {
    try {
      const res = await fetch('/api/google-folders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelId: folderId,
          description: descriptionInputs[folderId] ?? ''
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update description')
      }

      setFolders(prev => prev.map(folder =>
        folder.id === folderId
          ? { ...folder, description: descriptionInputs[folderId] ?? '' }
          : folder
      ))

      toast.success('Description updated')
    } catch (error) {
      console.error('Error updating description:', error)
      toast.error('Failed to update description')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder?')) {
      return
    }

    try {
      const res = await fetch('/api/google-folders', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labelId: folderId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.')
          signOut({ callbackUrl: '/' })
          return
        }
        if (data.code === 'ErrorDeleteDistinguishedFolder') {
          toast.error('Cannot delete default Outlook folders')
          return
        }
        toast.error(data.error || 'Failed to delete folder')
        return
      }

      setFolders(folders.filter(folder => folder.id !== folderId))
      toast.success('Folder deleted successfully')
    } catch (err) {
      console.error('Error deleting folder:', err)
      toast.error('Network error. Please try again.')
    }
  }

  if (error) {
    return (
      <div className="p-4 text-destructive bg-destructive/10 rounded-md">
        {error.includes('Failed to fetch folders')
          ? 'Please sign out and sign back in to refresh your session'
          : error}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {!hasLicense ? (
        <LicenseActivation />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your Google Folders</h1>
            <div className="flex items-center gap-2">
              <label className="text-sm">Show Default Folders</label>
              <input
                type="checkbox"
                checked={showSystemFolders}
                onChange={(e) => setShowSystemFolders(e.target.checked)}
                className="rounded border-gray-300"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="border-2 border-border"
            />
            <Input
              placeholder="Folder description"
              value={newFolderDescription}
              onChange={(e) => setNewFolderDescription(e.target.value)}
              className="border-2 border-border"
            />
            <div className="flex gap-2">
              <Button
                onClick={createFolder}
                disabled={isCreating || !newFolderName.trim()}
                className="border-2 border-primary hover:bg-primary/90"
              >
                {isCreating ? 'Creating...' : 'Create Folder'}
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500">{error}</p>}

          {displayedFolders.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              {folders.length === 0 ? 'Loading folders...' : 'No custom folders found'}
            </div>
          ) : (
            <div className="space-y-4 border-2 border-border p-4">
              {displayedFolders.map((folder) => (
                <div key={folder.id} className="flex items-center justify-between border-2 border-border p-4 bg-card">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    <span>{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={descriptionInputs[folder.id] || ''}
                      onChange={(e) => handleDescriptionChange(folder.id, e.target.value)}
                      placeholder="Add description"
                      className="border-2 border-border"
                    />
                    <Button
                      onClick={() => handleSaveDescription(folder.id)}
                      className="border-2 border-primary hover:bg-primary/90"
                    >
                      Save
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="border-2 border-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 
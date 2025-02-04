// src/app/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LogOut, FolderOpen, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "react-hot-toast"
import { LicenseActivation } from '@/components/LicenseActivation'
import { Nav } from '@/components/ui/nav'
import { useRouter, usePathname } from 'next/navigation'

interface Folder {
  id: string;
  displayName: string;
  description: string;
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'authenticated' && pathname !== '/') {
      router.push('/dashboard')
    }
  }, [status, router, pathname])

  // Don't render anything while checking authentication
  if (status === 'loading') {
    return null
  }

  // Render landing page
  return (
    <div className="min-h-screen">
      <Nav />
      
      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Organize Your Outlook, <span className="text-primary">Effortlessly</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Create and manage Outlook folders with ease. Keep your emails organized automatically with our intelligent folder management system.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/purchase'}
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose InBrief?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              title="Easy Organization"
              description="Create and manage Outlook folders with just a few clicks. No technical knowledge required."
            />
            <FeatureCard 
              title="Custom Descriptions"
              description="Add descriptions to your folders to easily remember their purpose and contents."
            />
            <FeatureCard 
              title="Outlook Integration"
              description="Seamlessly integrates with your existing Outlook account. No email migrations needed."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Simple, Transparent Pricing</h2>
          <div className="max-w-md mx-auto">
            <div className="rounded-lg border bg-card p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Monthly License</h3>
              <p className="text-3xl font-bold mb-2">$15</p>
              <p className="text-sm text-muted-foreground mb-4">per user / month</p>
              <ul className="text-left space-y-4 mb-8">
                <PricingFeature text="Full email organization" />
                <PricingFeature text="Unlimited folder creation" />
                <PricingFeature text="Custom descriptions" />
                <PricingFeature text="Priority support" />
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => window.location.href = '/purchase'}
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// function FolderList() {
//   const { data: session } = useSession()
//   const [folders, setFolders] = useState<Folder[]>([])
//   const [error, setError] = useState('')
//   const [newFolderName, setNewFolderName] = useState('')
//   const [newFolderDescription, setNewFolderDescription] = useState('')
//   const [isCreating, setIsCreating] = useState(false)
//   const [isLoading, setIsLoading] = useState(true)
//   const [descriptionInputs, setDescriptionInputs] = useState<{ [key: string]: string }>({})
//   const [hasLicense, setHasLicense] = useState(false)

//   const SYSTEM_FOLDERS = [
//     'archive',
//     'conversation history',
//     'deleted items',
//     'drafts',
//     'inbox',
//     'junk email',
//     'outbox',
//     'sent items',
//   ].map(name => name.toLowerCase())

//   const displayedFolders = folders.filter(folder => 
//     !SYSTEM_FOLDERS.includes(folder.displayName.toLowerCase())
//   )

//   useEffect(() => {
//     const checkLicense = async () => {
//       try {
//         const res = await fetch('/api/license')
//         if (!res.ok) {
//           throw new Error('License check failed')
//         }
//         const data = await res.json()
//         setHasLicense(data.hasValidLicense)
//       } catch (error) {
//         console.error('Error checking license:', error)
//         setHasLicense(false)
//       } finally {
//         setIsLoading(false)
//       }
//     }

//     if (session) {
//       checkLicense()
//     } else {
//       setIsLoading(false)
//     }
//   }, [session])

//   const fetchFolders = async () => {
//     try {
//       const res = await fetch('/api/folders')
//       if (!res.ok) {
//         if (res.status === 401) {
//           setHasLicense(false)
//           setIsLoading(false)
//           return
//         }
//         throw new Error('Failed to fetch folders')
//       }
//       const data = await res.json()
//       setFolders(data)
//     } catch (error) {
//       console.error('Error fetching folders:', error)
//       toast.error('Failed to fetch folders')
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   useEffect(() => {
//     if (session && hasLicense) {
//       fetchFolders()
//     }
//   }, [session, hasLicense])

//   useEffect(() => {
//     const initialInputs = folders.reduce((acc, folder) => {
//       acc[folder.id] = folder.description || ''
//       return acc
//     }, {} as { [key: string]: string })
//     setDescriptionInputs(initialInputs)
//   }, [folders])

//   const createFolder = async () => {
//     if (!newFolderName.trim()) return
    
//     setIsCreating(true)
//     try {
//       const res = await fetch('/api/folders', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           name: newFolderName,
//           description: newFolderDescription,
//         }),
//       })

//       if (!res.ok) throw new Error('Failed to create folder')
      
//       // Refresh folders list
//       const updatedRes = await fetch('/api/folders')
//       const updatedFolders = await updatedRes.json()
//       setFolders(updatedFolders)

//       // Clear inputs
//       setNewFolderName('')
//       setNewFolderDescription('')
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to create folder')
//     } finally {
//       setIsCreating(false)
//     }
//   }

//   const handleDescriptionChange = (folderId: string, value: string) => {
//     setDescriptionInputs(prev => ({
//       ...prev,
//       [folderId]: value
//     }))
//   }

//   const handleSaveDescription = async (folderId: string) => {
//     try {
//       const res = await fetch('/api/folders', {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ 
//           id: folderId,
//           description: descriptionInputs[folderId] ?? '' 
//         }),
//       })
      
//       if (!res.ok) {
//         const data = await res.json()
//         throw new Error(data.error || 'Failed to update description')
//       }
      
//       setFolders(prev => prev.map(folder => 
//         folder.id === folderId 
//           ? { ...folder, description: descriptionInputs[folderId] ?? '' }
//           : folder
//       ))
      
//       toast.success('Description updated')
//     } catch (error) {
//       console.error('Error updating description:', error)
//       toast.error('Failed to update description')
//     }
//   }

//   const handleDeleteFolder = async (folderId: string) => {
//     if (!confirm('Are you sure you want to delete this folder?')) {
//       return
//     }

//     try {
//       const res = await fetch('/api/folders', {
//         method: 'DELETE',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ id: folderId }),
//       })
      
//       const data = await res.json()
      
//       if (!res.ok) {
//         if (res.status === 401) {
//           toast.error('Session expired. Please sign in again.')
//           signOut({ callbackUrl: '/' })
//           return
//         }
//         if (data.code === 'ErrorDeleteDistinguishedFolder') {
//           toast.error('Cannot delete default Outlook folders')
//           return
//         }
//         toast.error(data.error || 'Failed to delete folder')
//         return
//       }
      
//       setFolders(folders.filter(folder => folder.id !== folderId))
//       toast.success('Folder deleted successfully')
//     } catch (err) {
//       console.error('Error deleting folder:', err)
//       toast.error('Network error. Please try again.')
//     }
//   }

//   if (error) {
//     return (
//       <div className="p-4 text-destructive bg-destructive/10 rounded-md">
//         {error.includes('Failed to fetch folders') 
//           ? 'Please sign out and sign back in to refresh your session'
//           : error}
//       </div>
//     )
//   }
  
//   if (isLoading) {
//     return (
//       <div className="flex justify-center items-center min-h-screen">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
//       </div>
//     )
//   }

//   return (
//     <div className="container mx-auto p-4 space-y-4">
//       {!hasLicense ? (
//         <LicenseActivation />
//       ) : (
//         <div className="space-y-4">
//           <div className="flex items-center justify-between">
//             <h1 className="text-2xl font-bold">Your Outlook Folders</h1>
//           </div>
          
//           <div className="space-y-2">
//             <Input
//               placeholder="New folder name"
//               value={newFolderName}
//               onChange={(e) => setNewFolderName(e.target.value)}
//               className="border-2 border-border"
//             />
//             <Input
//               placeholder="Folder description"
//               value={newFolderDescription}
//               onChange={(e) => setNewFolderDescription(e.target.value)}
//               className="border-2 border-border"
//             />
//             <div className="flex gap-2">
//               <Button 
//                 onClick={createFolder}
//                 disabled={isCreating || !newFolderName.trim()}
//                 className="border-2 border-primary hover:bg-primary/90"
//               >
//                 {isCreating ? 'Creating...' : 'Create Folder'}
//               </Button>
//             </div>
//           </div>

//           {error && <p className="text-red-500">{error}</p>}

//           {displayedFolders.length === 0 ? (
//             <div className="flex items-center justify-center p-8 text-muted-foreground">
//               {folders.length === 0 ? 'Loading folders...' : 'No custom folders found'}
//             </div>
//           ) : (
//             <div className="space-y-4 border-2 border-border p-4">
//               {displayedFolders.map((folder) => (
//                 <div key={folder.id} className="flex items-center justify-between border-2 border-border p-4 bg-card">
//                   <div className="flex items-center gap-2">
//                     <FolderOpen className="h-5 w-5" />
//                     <span>{folder.displayName}</span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <Input
//                       value={descriptionInputs[folder.id] || ''}
//                       onChange={(e) => handleDescriptionChange(folder.id, e.target.value)}
//                       placeholder="Add description"
//                       className="border-2 border-border"
//                     />
//                     <Button
//                       onClick={() => handleSaveDescription(folder.id)}
//                       className="border-2 border-primary hover:bg-primary/90"
//                     >
//                       Save
//                     </Button>
//                     <Button
//                       variant="destructive"
//                       onClick={() => handleDeleteFolder(folder.id)}
//                       className="border-2 border-destructive hover:bg-destructive/90"
//                     >
//                       Delete
//                     </Button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center">
      <Check className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}
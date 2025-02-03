'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Nav } from '@/components/ui/nav'
import { Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PurchasePage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      // if (!res.ok) throw new Error('Failed to purchase')
      
    } catch (err) {
      console.log(err)
      // setError(err instanceof Error ? err.message : 'Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <Link 
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Order Summary */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold mb-4">Complete your purchase</h1>
              <p className="text-muted-foreground">
                Get access to InBrief's powerful folder management features
              </p>
            </div>

            <div className="border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">Order Summary</h2>
              
              <div className="flex justify-between py-4 border-b">
                <span>Monthly License</span>
                <span className="font-semibold">$15.00</span>
              </div>
              
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>$15.00 USD</span>
              </div>
            </div>

            <div className="border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold mb-4">What's included</h2>
              <ul className="space-y-3">
                <FeatureItem text="Full email organization capabilities" />
                <FeatureItem text="Unlimited folder creation" />
                <FeatureItem text="Custom folder descriptions" />
                <FeatureItem text="Outlook integration" />
                <FeatureItem text="Priority support" />
                <FeatureItem text="Cancel anytime" />
              </ul>
            </div>
          </div>

          {/* Payment Form */}
          <div className="border rounded-lg p-6">
            <form onSubmit={handlePurchase} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email address
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full"
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Purchase License - $15.00'}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                By purchasing, you agree to our{' '}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/privacy" className="underline hover:text-foreground">
                  Privacy Policy
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start">
      <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}
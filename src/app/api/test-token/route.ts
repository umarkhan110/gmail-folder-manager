import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Client } from '@microsoft/microsoft-graph-client';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('Session debug:', {
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      hasError: !!session?.error,
      tokenStart: session?.accessToken ? `${session.accessToken.substring(0, 20)}...` : null
    });

    if (!session?.accessToken) {
      return NextResponse.json({ 
        error: 'No token found', 
        sessionInfo: {
          exists: !!session,
          hasToken: !!session?.accessToken,
          hasError: !!session?.error
        }
      }, { status: 401 });
    }

    // Initialize Microsoft Graph client
    const client = Client.init({
      authProvider: (done) => {
        console.log('Auth provider called with token');
        done(null, session.accessToken || null);
      },
    });

    try {
      // Try a simple profile request first
      const profile = await client.api('/me').select('displayName,userPrincipalName').get();
      
      return NextResponse.json({ 
        success: true, 
        profile,
        tokenInfo: {
          hasToken: true,
          tokenType: session.accessToken.split('.')[0], // First part of JWT
          scopes: session.accessToken.includes('Mail.Read') ? 'Has Mail.Read' : 'No Mail.Read'
        }
      });
    } catch (graphError: any) {  // Type as any since Graph errors aren't well-typed
      console.error('Graph API error details:', {
        code: graphError?.code,
        statusCode: graphError?.statusCode,
        message: graphError?.message,
        body: graphError?.body
      });
      
      return NextResponse.json({ 
        error: 'Graph API call failed',
        details: {
          code: graphError?.code,
          status: graphError?.statusCode,
          message: graphError?.message
        }
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Token test failed:', error);
    return NextResponse.json({ 
      error: 'Token test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 
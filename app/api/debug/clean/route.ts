import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const secret = url.searchParams.get('secret');
        if (secret !== 'ayo1234') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!getApps().length) {
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            let privateKey = process.env.FIREBASE_PRIVATE_KEY;

            if (projectId && clientEmail && privateKey) {
                privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
                initializeApp({
                    credential: cert({ projectId, clientEmail, privateKey })
                });
            } else {
                return NextResponse.json({ error: 'Missing creds' }, { status: 500 });
            }
        }

        const firestore = getFirestore();
        const docs = await firestore.collection('aya_registry').where('website', '==', 'https://www.eclore-asso.org').get();
        const docs2 = await firestore.collection('aya_registry').where('website', '==', 'https://eclore-asso.org').get();

        let deleted = 0;

        for (const doc of docs.docs) {
            await doc.ref.delete();
            deleted++;
        }
        for (const doc2 of docs2.docs) {
            await doc2.ref.delete();
            deleted++;
        }

        return NextResponse.json({ success: true, deleted });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

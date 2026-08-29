import { NextResponse } from 'next/server';
import { tokenCountriesMap } from '@/config/token-countries';

// Deliberately standalone: this route takes no params, validates nothing, and
// makes no upstream call, so it has no use for the envelope helpers the five
// Qobuz-proxying routes share. It answers in the same wire format.
export async function GET() {
    // An empty list is the default configuration, not a failure: the picker stays
    // hidden and requests fall back to a random token. This used to omit a status
    // and return `{ success: false }`, so the status said OK while the body said
    // otherwise.
    const countryCodes: string[] = tokenCountriesMap.map((country) => country.code);
    return NextResponse.json({ success: true, data: countryCodes }, { status: 200 });
}

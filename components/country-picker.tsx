import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem } from './ui/select';
import { SelectTrigger } from '@radix-ui/react-select';
import { ReactCountryFlag } from 'react-country-flag';
import { useCountry } from '@/lib/country-provider';
import { getApiClient } from '@/lib/api/client';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const CountryPicker = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
    const { country, setCountry } = useCountry();
    const [countriesList, setCountriesList] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const [enabled, setEnabled] = useState(false);
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const response = await getApiClient().get<string[]>(getApiClient().routes.countries);
            if (cancelled) return;
            // An empty list means country selection isn't configured, so the picker
            // stays hidden rather than rendering an empty dropdown.
            if (!response.success || response.data.length === 0) return;
            setEnabled(true);
            setCountriesList(response.data);
            const savedCountry = localStorage.getItem('country');
            if (!savedCountry || !response.data.includes(savedCountry)) setCountry(response.data[0]);
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    return (
        <>
            {enabled && (
                <div className={cn('flex', className)} ref={ref} {...props}>
                    <Select value={country} onValueChange={setCountry} open={open} onOpenChange={setOpen}>
                        <SelectTrigger className='select-none outline-none'>
                            <div className='bg-background rounded-none'>
                                <div className='bg-secondary flex gap-2 px-3 py-1 rounded-none outline-primary/40 outline-[0.5px] outline items-center justify-center text-nowrap'>
                                    {country ? (
                                        <>
                                            <ReactCountryFlag countryCode={country} />
                                        </>
                                    ) : (
                                        <p>Select a country</p>
                                    )}
                                    <ChevronDownIcon />
                                </div>
                            </div>
                        </SelectTrigger>
                        <SelectContent className='mt-2'>
                            {countriesList.map((country) => (
                                <SelectItem key={country} value={country}>
                                    <div className='flex gap-2 items-center'>
                                        <ReactCountryFlag countryCode={country} />
                                        {displayNames.of(country)}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </>
    );
});

export default CountryPicker;

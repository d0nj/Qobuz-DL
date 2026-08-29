'use client';

import axios from 'axios';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReleaseCard from '@/components/release-card';
import SearchBar from '@/components/search-bar/search-bar';
import { Button } from '@/components/ui/button';
import { Disc3Icon, DiscAlbumIcon, UsersIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FilterDataType, filterExplicit, QobuzAlbum, QobuzArtist, QobuzSearchFilters, QobuzSearchResults, QobuzTrack } from '@/lib/qobuz-dl';
import { getTailwindBreakpoint } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useInView } from 'react-intersection-observer';
import { useSettings } from '@/lib/settings-provider';
import { useTheme } from 'next-themes';
import CountryPicker from '@/components/country-picker';
import { useCountry } from '@/lib/country-provider';

export const filterData: FilterDataType = [
    {
        label: 'Albums',
        value: 'albums',
        icon: DiscAlbumIcon
    },
    {
        label: 'Tracks',
        value: 'tracks',
        icon: Disc3Icon
    },
    {
        label: 'Artists',
        value: 'artists',
        icon: UsersIcon
    }
];

const SearchView = () => {
    const { resolvedTheme } = useTheme();
    const [results, setResults] = useState<QobuzSearchResults | null>(null);
    const [searchField, setSearchField] = useState<QobuzSearchFilters>('albums');
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [searching, setSearching] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string>('');
    const { settings } = useSettings();
    const { country } = useCountry();

    useEffect(() => {
        console.log(`%c${process.env.NEXT_PUBLIC_APPLICATION_NAME}`, 'font-size: 25px; font-weight: bold;');
        if (process.env.NEXT_PUBLIC_DISCORD) {
            console.log(`Discord: ${process.env.NEXT_PUBLIC_DISCORD}`);
        }
        if (process.env.NEXT_PUBLIC_GITHUB) {
            console.log(`GitHub: ${process.env.NEXT_PUBLIC_GITHUB}`);
        }
    }, []);

    
    const [scrollTrigger, isInView] = useInView();

    const fetchMore = () => {
        if (loading) return;
        setLoading(true);
        const filter = filterData.find((fd) => fd.value == searchField) || filterData[0];
        if (filter.searchRoute) {
            axios
                .get('/api/' + filter.searchRoute + `?q=${query}&offset=${results![searchField].items.length}`, { headers: { 'Token-Country': country } })
                .then((response) => {
                    if (response.status === 200) {
                        response.data.data[searchField].items.length = Math.max(
                            response.data.data[searchField].items.length,
                            Math.min(response.data.data[searchField].limit, response.data.data[searchField].total - response.data.data[searchField].offset)
                        );
                        response.data.data[searchField].items.fill(null, response.data.data[searchField].items.length);
                        const newResults = {
                            ...results!,
                            [searchField]: {
                                ...results![searchField],
                                items: [...results![searchField].items, ...response.data.data[searchField].items]
                            }
                        };
                        setLoading(false);
                        if (query === response.data.data.query) setResults(newResults);
                    }
                });
        } else {
            axios.get(`/api/get-music?q=${query}&offset=${results![searchField].items.length}`, { headers: { 'Token-Country': country } }).then((response) => {
                if (response.status === 200) {
                    let newResults = {
                        ...results!,
                        [searchField]: {
                            ...results!.albums,
                            items: [...results!.albums.items, ...response.data.data.albums.items]
                        }
                    };
                    filterData.map((filter) => {
                        response.data.data[filter.value].items.length = Math.max(
                            response.data.data[filter.value].items.length,
                            Math.min(response.data.data[filter.value].limit, response.data.data[filter.value].total - response.data.data[filter.value].offset)
                        );
                        response.data.data[filter.value].items.fill(null, response.data.data[filter.value].items.length);
                        newResults = {
                            ...newResults,
                            [filter.value]: {
                                ...results![filter.value as QobuzSearchFilters],
                                items: [...results![filter.value as QobuzSearchFilters].items, ...response.data.data[filter.value].items]
                            }
                        };
                    });
                    setLoading(false);
                    if (query === response.data.data.query) setResults(newResults);
                }
            });
        }
    };

    useEffect(() => {
        if (searching) return;
        if (isInView && results![searchField].total > results![searchField].items.length && !loading) fetchMore();
        if (results?.switchTo) {
            setSearchField(results.switchTo);
        }
    }, [isInView, results]);

    const cardRef = useRef<HTMLDivElement | null>(null);
    const [cardHeight, setCardHeight] = useState<number>(0);

    useEffect(() => {
        const element = cardRef.current;

        if (!element) {
            return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === element) {
                    setCardHeight(entry.contentRect.height);
                }
            }
        });

        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [results, settings.explicitContent, searchField]);

    useLayoutEffect(() => {
        const handleResize = () => {
            if (typeof window !== 'undefined') {
                setNumRows(rowsMap[getTailwindBreakpoint(window.innerWidth)]);
            }
        };

        handleResize();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const rowsMap = {
        sm: 3,
        md: 5,
        lg: 6,
        xl: 7,
        '2xl': 7,
        base: 2
    };

    const [numRows, setNumRows] = useState(0);

    const onSearch = async (query: string, searchFieldInput: string = searchField) => {
        setQuery(query);
        setSearchError('');
        const filter = filterData.find((filter) => filter.value === searchFieldInput) || filterData[0];
        try {
            const response = await axios.get(`/api/${filter.searchRoute ? filter.searchRoute : 'get-music'}?q=${query}&offset=0`, {
                headers: {
                    'Token-Country': country
                }
            });
            if (response.status === 200) {
                setLoading(false);
                if (searchField !== searchFieldInput) setSearchField(searchFieldInput as QobuzSearchFilters);

                let newResults = { ...response.data.data };
                filterData.map((filter) => {
                    if (!newResults[filter.value])
                        newResults = {
                            ...newResults,
                            [filter.value]: {
                                total: undefined,
                                offset: undefined,
                                limit: undefined,
                                items: []
                            }
                        };
                });
                setResults(newResults);
            }
        } catch (error: any) {
            setSearchError(error?.response.data?.error || error.message || 'An error occurred.');
        }
        setSearching(false);
    };

    useEffect(() => {
        if (country && query) onSearch(query);
    }, [country]);
    return (
        <>
            <div className='space-y-4'>
                <div className='flex flex-col select-none cursor-pointer items-center animate-[wordmark-in_600ms_cubic-bezier(0.22,1,0.36,1)_both]' onClick={() => {
                    setQuery('');
                    setResults(null);
                    setSearchField('albums');
                }}>
                    {process.env.NEXT_PUBLIC_APPLICATION_NAME!.toLowerCase() === 'qobuz-dl' ? (
                        <h1 className='font-serif text-[64px] leading-none md:text-[96px] tracking-tight text-foreground'>
                            Qobuz<span className='italic'>—</span>DL
                        </h1>
                    ) : (
                        <h1 className='font-serif text-[48px] leading-none md:text-[72px] tracking-tight text-foreground'>
                            {process.env.NEXT_PUBLIC_APPLICATION_NAME}
                        </h1>
                    )}
                    <p className='index-numeral mt-3'>A frontend browser client for downloading music for Qobuz</p>
                </div>
                <div className='flex flex-col items-start justify-center'>
                    <SearchBar onSearch={onSearch} searching={searching} setSearching={setSearching} query={query} />

                    <div className='w-full flex items-center justify-between'>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='ghost'
                                    className='my-2 flex items-center gap-2.5 focus-visible:outline-none select-none shadow-none outline-none !z-[99] px-2 text-xs font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground hover:bg-transparent'
                                >
                                    <span className='inline-block h-px w-4 bg-border transition-colors group-data-[state=open]:bg-primary' />
                                    {searchField}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='start' className='min-w-[10rem]'>
                                <DropdownMenuRadioGroup value={searchField} onValueChange={setSearchField as React.Dispatch<React.SetStateAction<string>>}>
                                    {filterData.map((type, index) => (
                                        <DropdownMenuRadioItem key={index} value={type.value} className='text-xs font-medium'>
                                            {type.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <CountryPicker className='sm:hidden' />
                    </div>
                    {searchError && (
                        <p className='text-destructive w-full text-center font-medium font-mono text-xs tracking-wide'>
                            {typeof searchError === 'object' ? JSON.stringify(searchError) : searchError}
                        </p>
                    )}
                </div>
            </div>

            <div>
                {results && (
                    <div className='my-6 w-screen mx-auto max-w-[1600px] pb-20'>
                        <div
                            className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-4 gap-y-8 w-full px-6 overflow-visible rail-line pl-4 md:pl-8'
                            style={{
                                maxHeight: `${(Math.ceil(filterExplicit(results, settings.explicitContent)[searchField].items.length / numRows) + 2) * (cardHeight + 16)}px`
                            }}
                        >
                            {filterExplicit(results, settings.explicitContent)[searchField].items.map(
                                (result: QobuzAlbum | QobuzTrack | QobuzArtist, index: number) => {
                                    if (!result) return null;
                                    return (
                                        <div
                                            key={`${index}-${result.id}-${searchField}`}
                                            className='plate-hang'
                                            style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
                                        >
                                            <ReleaseCard
                                                result={result}
                                                resolvedTheme={String(resolvedTheme)}
                                                ref={index === 0 ? cardRef : null}
                                                index={index}
                                            />
                                        </div>
                                    );
                                }
                            )}
                            {results![searchField].items.length < results![searchField].total &&
                                [
                                    ...Array(
                                        results![searchField].total > results![searchField].items.length + 30
                                            ? 30
                                            : results![searchField].total - results![searchField].items.length
                                    )
                                ].map((_, index) => {
                                    return (
                                        <div key={index} className='relative w-full'>
                                            <Skeleton
                                                className='relative w-full aspect-square group select-none rounded-none overflow-hidden'
                                                ref={index === 0 ? scrollTrigger : null}
                                            />
                                            <div className='h-[40px]'></div>
                                        </div>
                                    );
                                })}
                        </div>
                        {results![searchField].items.length >= results![searchField].total && (
                            <div className='w-full h-[40px] index-numeral flex items-center justify-center pt-8'>END OF CATALOGUE — {results![searchField].total} {searchField.toUpperCase()}</div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default SearchView;

export function formatDateFromSeconds(seconds: bigint | number | string | undefined | null): string {
    const value = typeof seconds === 'bigint' ? Number(seconds) : Number(seconds);
    if (!seconds || isNaN(value) || value <= 0) {
        return 'N/A';
    }
    return new Date(value * 1000).toLocaleDateString();
}

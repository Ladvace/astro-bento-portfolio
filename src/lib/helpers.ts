export function trimText(input: string, maxLength: number = 100): string {
    if (input.length <= maxLength) return input;
    return input.substring(0, maxLength - 3) + '...';
}
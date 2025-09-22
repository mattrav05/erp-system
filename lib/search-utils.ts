/**
 * Normalize a search string that might be an amount
 * Removes commas, handles decimals, and returns a number if valid
 */
export function normalizeAmountSearch(searchTerm: string): number | null {
  // Remove all commas and spaces
  const cleaned = searchTerm.replace(/[,\s]/g, '');
  
  // Check if it's a valid number
  const num = parseFloat(cleaned);
  
  // Return the number if it's valid and finite
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }
  
  return null;
}

/**
 * Check if an amount matches a search term
 * Handles various formats: 8024, 8,024, 8024.00, etc.
 */
export function matchesAmount(amount: number | null | undefined, searchTerm: string): boolean {
  if (amount === null || amount === undefined) return false;
  
  // Try to parse the search term as a number
  const searchAmount = normalizeAmountSearch(searchTerm);
  
  if (searchAmount !== null) {
    // Exact match
    if (amount === searchAmount) return true;
    
    // Check if the amount starts with the search term (for partial searches)
    // Convert both to strings for comparison
    const amountStr = amount.toFixed(2);
    const searchStr = searchAmount.toString();
    
    // Remove trailing zeros and decimal point if needed
    const amountFormatted = amount.toString();
    
    // Check various formats
    return (
      amountStr.includes(searchStr) ||
      amountFormatted.includes(searchStr) ||
      Math.floor(amount).toString().includes(Math.floor(searchAmount).toString())
    );
  }
  
  // Also check if the formatted amount (with commas) contains the search term
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  const formattedAmountNoDecimals = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return (
    formattedAmount.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formattedAmountNoDecimals.toLowerCase().includes(searchTerm.toLowerCase())
  );
}
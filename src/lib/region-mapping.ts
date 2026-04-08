export const REGION_MAPPING: Record<string, string> = {
  "EU01": "Europeans Countries",
  "FR01": "France",
  "IT01": "Italy",
  "KE01": "Kenya",
  "SA01": "SAUDI ARABIA",
  "TR01": "TURKEY",
  "UE01": "United Arab Emirates",
  "US01": "United State of America",
  "ZA01": "South Africa",
  "ET08": "Somali Region",
  "ET09": "Southern Nation Nationalities & PP",
  "ET11": "Out of Ethiopia Regions",
  "ET12": "Central Ethiopia",
  "ET13": "South Ethiopia Regional State",
  "ET14": "South West Ethiopia Regional State",
  "ET22": "Dire Dawa City Administration",
  "ET23": "Sidama Region",
  "CN01": "China",
  "DJ01": "DJIBOUTI",
  "ET00": "Addis Ababa City Administration",
  "ET01": "Tigray Region",
  "ET02": "Afar Region",
  "ET03": "Amhara Region",
  "ET04": "Oromia Region",
  "ET05": "Benishangul-Gumuz Region",
  "ET06": "Gambela Region",
  "ET07": "Harari Region",
};

/**
 * Common search logic to find a region entry (ID + Label)
 */
function findRegionEntry(input: string) {
  if (!input) return null;
  const trimmed = input.trim();
  const lowerInput = trimmed.toLowerCase();
  
  // 1. Direct ID match (case-insensitive)
  const upperInput = trimmed.toUpperCase();
  if (REGION_MAPPING[upperInput]) {
    return [upperInput, REGION_MAPPING[upperInput]];
  }

  // 2. Search IDs and Labels
  return Object.entries(REGION_MAPPING).find(([id, label]) => {
    const lowerId = id.toLowerCase();
    const lowerLabel = label.toLowerCase();
    
    // Exact ID match (redundant but safe)
    if (lowerId === lowerInput) return true;
    
    // Substring match: Input in label or vice versa
    if (lowerLabel.includes(lowerInput) || lowerInput.includes(lowerLabel)) return true;
    
    // Acronym match (e.g., "AA" for "Addis Ababa City Administration")
    const labelAcronym = lowerLabel.split(/\s+/).filter(w => w.length > 0).map(w => w[0]).join('');
    if (labelAcronym.includes(lowerInput)) return true;

    return false;
  }) || null;
}

export function getRegionLabel(input: string): string {
  const entry = findRegionEntry(input);
  return entry ? entry[1] : (REGION_MAPPING["ET00"] || "Addis Ababa City Administration");
}

export function getRegionId(input: string): string {
  const entry = findRegionEntry(input);
  return entry ? entry[0] : "ET00";
}

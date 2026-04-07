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

export function getRegionLabel(input: string): string {
  if (!input) return input;
  
  const trimmedInput = input.trim();
  const lowerInput = trimmedInput.toLowerCase();
  
  // 1. Direct ID match (case-insensitive)
  const upperInput = trimmedInput.toUpperCase();
  if (REGION_MAPPING[upperInput]) {
    return REGION_MAPPING[upperInput];
  }

  // 2. Intelligent search in labels
  // We look for any label that contains the input or vice versa (case-insensitive)
  const entry = Object.entries(REGION_MAPPING).find(([id, label]) => {
    const lowerLabel = label.toLowerCase();
    const lowerId = id.toLowerCase();
    
    // Check if input matches ID (case-insensitive)
    if (lowerId === lowerInput) return true;
    
    // Check if the input is a substring of the label, or vice versa
    return lowerLabel.includes(lowerInput) || lowerInput.includes(lowerLabel);
  });

  return entry ? entry[1] : input;
}

export function getRegionId(label: string): string {
  if (!label) return label;

  const trimmedLabel = label.trim().toLowerCase();
  
  // Find the ID that matches this label
  const entry = Object.entries(REGION_MAPPING).find(([id, regionLabel]) => {
    return regionLabel.toLowerCase() === trimmedLabel;
  });

  return entry ? entry[0] : label;
}

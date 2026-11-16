
export interface BeautyProduct {
  id: string;
  name: string;
  brand: string;
  image: string | null;
  ingredients: string;
  categories: string;
  barcode: string;
  productUrl: string;
}

const API_URL = "https://world.openbeautyfacts.org/cgi/search.pl";

export async function searchBeautyProducts(
  searchTerm: string,
  page = 1
): Promise<BeautyProduct[]> {
  const params = new URLSearchParams({
    search_terms: searchTerm,
    search_simple: "1",
    action: "process",
    json: "1",
    page: String(page),
    page_size: "30",
    fields: [
      "code",
      "product_name",
      "brands",
      "image_front_url",
      "ingredients_text",
      "categories",
      "url",
    ].join(","),
  });

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: {
      "User-Agent": "SkinAIAnalyzer/1.0 (Expo React Native)",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to retrieve skincare products.");
  }

  const data = await response.json();

  return (data.products ?? [])
    .filter((product: any) => product.product_name && product.image_front_url)
    .map((product: any) => ({
      id: product.code,
      name: product.product_name,
      brand: product.brands || "Unknown brand",
      image: product.image_front_url || null,
      ingredients: product.ingredients_text || "",
      categories: product.categories || "",
      barcode: product.code || "",
      productUrl: product.url || "",
    }));
}

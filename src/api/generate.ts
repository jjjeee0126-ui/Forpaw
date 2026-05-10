import type { GenerationResult } from '../App';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function parseJsonResponse(response: Response): Promise<any> {
  const raw = await response.text();

  if (!raw) {
    throw new Error('서버 응답이 비어 있어요. 잠시 후 다시 시도해 주세요.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('서버 응답 형식이 올바르지 않아요. 다시 시도해 주세요.');
  }
}

function buildPrompt(petName: string): string {
  const safeName = petName.trim().slice(0, 10);

  return [
    'Create a premium studio product render of a single plush heart charm, centered in the frame with a soft shadow underneath.',

    'Use the uploaded pet photo ONLY as a reference for coat color, fur tone variation, subtle patterning, overall color temperature, eye color, and background color mood.',
    'Also use the uploaded pet photo as the main reference for the coat texture type itself.',
    'Preserve whether the pet fur feels curly, wavy, silky, straight, fluffy, woolly, smooth, airy, dense, or plush.',
    'If the pet has curly or wavy fur, reflect that curl pattern naturally in the final heart fur texture.',
    'If the pet has sleek or smooth fur, keep the final heart fur smoother, finer, and more streamlined.',
    'If the pet has very fluffy, cottony, or powdery fur, keep that soft airy volume in the final heart.',
    'If the pet has long fur, short fur, layered fur, or visibly different guard hair and undercoat behavior, preserve those characteristics in a stylized but faithful way.',
    'Preserve the pet fur undertone faithfully and keep the final heart in the same warm, cool, or neutral family as the real coat.',
    'If the animal coat reads warm-toned, keep the whole image soft, gentle, warm, and cozy.',
    'If the animal coat reads cool-toned, keep the whole image bright, fresh, airy, and cool.',
    'If the coat reads neutral, keep the palette balanced and softly nuanced rather than strongly warm or strongly cool.',
    'Match the real coat hue family as closely as possible, including ash gray, silver, taupe, smoky beige, cream, charcoal, blue-gray, cocoa, apricot, caramel, or ivory nuances when present.',
    'Do NOT shift the fur warmer or cooler than the source photo.',
    'Avoid artificial color grading, sepia cast, sunset tint, heavy warming filters, or icy blue overcorrection unless those qualities are clearly present in the photo.',
    'Do NOT include any animal face, eyes, nose, ears, paws, body parts, or portrait features.',
    'Do NOT include any keyring hook, chain, ring, clasp, or metal hardware.',

    'HEART MATERIAL: a puffy heart made of dense faux fur with short-to-medium visible fibers.',
    'The fur texture is extremely important: it should feel layered, soft, airy, and made of countless fine strands rather than a flat plush surface.',
    'Show visible individual fibers, delicate strand separation, subtle directional flow, and softly varied pile density across the heart.',
    'The fur should have a realistic mix of undercoat softness and slightly longer guard hairs around the outer silhouette.',
    'The silhouette edges should bloom with tiny fluffy fibers, while the main body remains dense, plush, and touchable.',
    'Let the fur nap change gently with the form of the heart so the surface does not feel stamped or texture-mapped.',
    'Make the fur behavior resemble the uploaded pet coat rather than using one generic plush texture for every animal.',
    'The heart should feel like the uploaded pet coat has been transformed into a heart charm, not replaced with arbitrary fake fur.',
    'If the uploaded pet coat is curly, the heart fur should show soft curl structure and springy loops rather than straight fibers.',
    'If the uploaded pet coat is silky or straight, the heart fur should show smoother directional strands and cleaner flow.',
    'If the uploaded pet coat is especially fluffy, the heart fur should show airy puffiness and cloud-like density.',
    'Keep the texture tactile and realistic, like luxury faux fur photographed close-up in a premium product shot.',
    'Avoid sleek velvet, shaved plush, felt, fleece, microfiber blanket texture, glossy fur, or extremely smooth stuffed-toy fabric.',
    'Avoid long wild hair, windblown strands, messy shaggy fur, clumped fur, matted fur, or overly airbrushed softness.',
    'The heart must look like a cute handmade fur accessory, not a generic pillow.',

    'HEART SHAPE: front-facing, centered, softly puffed, with two rounded top lobes and a slightly organic handmade silhouette.',
    'Keep the object large, filling about 70 percent of the square frame.',

    `TEXT DETAIL: place the name "${safeName}" across the middle as individual sewn-on chenille letters.`,
    'This text material is the highest-priority detail after the heart fur color, and it must remain consistent even if the background becomes more colorful.',
    'The letters must look like separate plush varsity letters attached directly onto the fur surface.',
    'Do NOT create a single large backing plaque, badge, sticker, label plate, or word-shaped patch behind the whole name.',
    'Each letter should have soft fuzzy chenille pile, rounded volume, textile thickness, and a thin stitched border.',
    'The material must look like chenille fabric or terry embroidery, not satin stitch fill, not rubber, not silicone, not plastic, not clay, not foam, not pebbled leather, not sponge, not fleece lumps, and not tiny bead texture.',
    'The letters should feel integrated into the heart, with subtle thread stitching where they meet the fur.',
    'Use bubbly rounded lowercase lettering with cute, plush, tactile depth.',
    'The surface of each letter should show soft directional fabric fibers, like a real embroidered chenille patch, not granular bumps.',
    'The letters must not become stylized because of the background. Keep the patch material realistic, textile-based, and tactile.',
    'PATCH COLOR RULE: derive the patch accent color primarily from the pet eye color, and secondarily from a small accent color already present in the pet coat or photo.',
    'If the eye color is vivid or saturated, the patch color may become a slightly poppier version of that hue while staying tasteful.',
    'If the eye color is very dark, muted, or close to black, brighten it slightly into a softer, more visible accent while keeping the original hue family.',
    'Do NOT invent unrelated accent colors that fight the pet photo.',
    'Avoid neon, fluorescent, electric, or over-saturated candy colors unless the source photo clearly supports them.',

    'BACKGROUND: use the original photo background as a reference for the final background mood.',
    'Transform that background mood into a soft pastel product gradient that feels cleaner, simpler, and more premium than the original photo.',
    'The background should subtly harmonize with the fur color, the patch accent color, and the eye color accent at the same time.',
    'Use only 2 softly blended hues, or at most 3 very subtle hues, and keep them restrained.',
    'The background should feel gentle and art-directed, not loud, rainbow-like, or overly colorful.',
    'The background may become more polished than the original photo, but the heart fur color itself must remain faithful to the uploaded pet undertone.',
    'Avoid plain white studio backdrop, avoid dirty beige emptiness, avoid realistic room lighting, avoid visible environment, and avoid high-saturation rainbow gradients.',
    'Keep the background soft, minimal, graphic, and harmonized with both the fur and the text patch.',
    'The background may change in color mood, but it must never change the textile material of the letters.',

    'LIGHTING: soft diffused studio lighting with gentle highlights catching the individual fur fibers, subtle depth in the pile, and a soft shadow below the heart.',

    'STYLE: hyper-realistic 3D product render, cute luxury accessory aesthetic, polished but playful, very close to a designer plush charm reference image.',
    'Only one object in the scene: the fur heart with the sewn-on chenille letters.',
  ].join(' ');
}

export async function generateKeyringImage(
  photoDataUrl: string,
  petName: string,
): Promise<GenerationResult> {
  const prompt = buildPrompt(petName);

  const token = localStorage.getItem('forpaw_token') || '';
  const response = await fetch(`${API_BASE}/api/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: petName,
      photoDataUrl,
      prompt,
      outputSize: '1024x1024',
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || '키링 이미지 생성에 실패했어요');
  }

  return {
    imageDataUrl: data.imageDataUrl,
    model: data.model,
    size: data.size,
  };
}

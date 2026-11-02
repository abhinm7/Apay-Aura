import { fail, ok } from "@/lib/http";
import { deleteImageLater, storeImage } from "@/lib/images";
import { setAvatarUrl } from "@/lib/queries";
import { currentUserId } from "@/lib/session";

// Body is the raw image (Content-Type image/webp, image/jpeg or image/png).
export async function POST(req: Request) {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);

  const image = await storeImage(req, `avatars/${me}`);
  if ("error" in image) return fail(image.error);
  deleteImageLater(await setAvatarUrl(me, image.url));
  return ok({ url: image.url });
}

export async function DELETE() {
  const me = await currentUserId();
  if (!me) return fail("Not signed in", 401);
  deleteImageLater(await setAvatarUrl(me, null));
  return ok();
}

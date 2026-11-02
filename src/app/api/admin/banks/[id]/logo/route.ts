import { isAdmin } from "@/lib/admin";
import { fail, ok } from "@/lib/http";
import { deleteImageLater, storeImage } from "@/lib/images";
import { getBank, setBankLogo } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

// Body is the raw image (Content-Type image/webp, image/jpeg or image/png).
export async function POST(req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return fail("Admin PIN required", 401);
  const { id } = await params;
  if (!(await getBank(id))) return fail("Bank not found", 404);

  const image = await storeImage(req, `banks/${id}`);
  if ("error" in image) return fail(image.error);
  deleteImageLater(await setBankLogo(id, image.url));
  return ok({ url: image.url });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return fail("Admin PIN required", 401);
  const previous = await setBankLogo((await params).id, null);
  if (previous === undefined) return fail("Bank not found", 404);
  deleteImageLater(previous);
  return ok();
}

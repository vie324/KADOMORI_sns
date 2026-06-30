import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validatePost } from "@/lib/validate";
import { POST_STATUSES, PostStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/posts?status=draft|approved|published|failed
// status 省略時は全件。
export async function GET(req: NextRequest) {
  try {
    const status = new URL(req.url).searchParams.get("status");
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && POST_STATUSES.includes(status as PostStatus)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/posts  body: { id, status?, body?, theme? }
// 承認・却下・編集に使用。body 変更時は ng_flagged を再計算する。
export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const { id, status, body, theme } = payload as {
      id?: string;
      status?: string;
      body?: string;
      theme?: string;
    };

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (typeof status === "string") {
      if (!POST_STATUSES.includes(status as PostStatus)) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 });
      }
      update.status = status;
    }
    if (typeof theme === "string") {
      update.theme = theme;
    }
    if (typeof body === "string") {
      update.body = body;
      update.ng_flagged = validatePost(body).ngFlagged;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ post: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/posts?id=<uuid>
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

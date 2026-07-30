import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const { data: children } = await supabase
      .from('children')
      .select('*')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      profile: profile || { full_name: user.user_metadata?.full_name || '', phone: '', telegram_handle: '' },
      children: children || [],
      email: user.email,
    });
  } catch (error: any) {
    console.error('Parent profile fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { full_name, phone, telegram_handle, new_child_name, new_child_grade } = body;

    // Обновление профиля родителя
    if (full_name !== undefined || phone !== undefined || telegram_handle !== undefined) {
      await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: full_name ?? '',
          phone: phone ?? '',
          telegram_handle: telegram_handle ?? '',
          updated_at: new Date().toISOString(),
        });
    }

    // Добавление нового ребенка
    if (new_child_name && new_child_name.trim()) {
      await supabase
        .from('children')
        .insert({
          parent_id: user.id,
          name: new_child_name.trim(),
          grade: new_child_grade || 'preschool_6',
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Профиль успешно обновлен',
    });
  } catch (error: any) {
    console.error('Parent profile update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Редактирование карточки ребенка
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { child_id, name, grade } = await req.json();
    if (!child_id || !name) {
      return NextResponse.json({ success: false, error: 'child_id and name are required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('children')
      .update({ name: name.trim(), grade })
      .eq('id', child_id)
      .eq('parent_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Профиль ребёнка обновлён' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Удаление карточки ребенка
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const child_id = searchParams.get('child_id');

    if (!child_id) {
      return NextResponse.json({ success: false, error: 'child_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', child_id)
      .eq('parent_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Профиль ребёнка удалён' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

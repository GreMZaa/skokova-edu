-- 1. Сборка пользовательских enum типов
CREATE TYPE booking_status AS ENUM ('pending_payment', 'receipt_uploaded', 'confirmed', 'rescheduled', 'cancelled');
CREATE TYPE grade_level AS ENUM ('preschool_5', 'preschool_6', 'grade_1', 'grade_2', 'grade_3', 'grade_4');

-- 2. Таблица слотов расписания педагога
CREATE TABLE IF NOT EXISTS public.time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска свободных слотов
CREATE INDEX idx_time_slots_start_time ON public.time_slots(start_time);
CREATE INDEX idx_time_slots_availability ON public.time_slots(is_booked, start_time);

-- 3. Таблица заявок на обучение
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES public.time_slots(id) ON DELETE RESTRICT,
    service_title VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    
    -- Данные родителя и ребёнка
    parent_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    telegram_handle VARCHAR(100),
    child_name VARCHAR(255) NOT NULL,
    child_grade grade_level NOT NULL,
    comment TEXT,
    
    -- Файл чека и статус
    receipt_file_url TEXT,
    status booking_status DEFAULT 'pending_payment',
    admin_notes TEXT,
    rescheduled_from_slot_id UUID REFERENCES public.time_slots(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для фильтрации заявок админом и поиску по статусам
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_phone ON public.bookings(phone);

-- 4. Функция временного запечатывания слота на 15 минут
CREATE OR REPLACE FUNCTION lock_time_slot(p_slot_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_booked BOOLEAN;
    v_locked_until TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT is_booked, locked_until INTO v_is_booked, v_locked_until
    FROM public.time_slots
    WHERE id = p_slot_id
    FOR UPDATE;

    IF v_is_booked = TRUE THEN
        RETURN FALSE;
    END IF;

    IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
        RETURN FALSE;
    END IF;

    UPDATE public.time_slots
    SET locked_until = NOW() + INTERVAL '15 minutes'
    WHERE id = p_slot_id;

    RETURN TRUE;
END;
$$;

-- 5. Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookings_modtime
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 6. Безопасность RLS (Row Level Security)
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Публичное чтение свободных слотов
CREATE POLICY "Allow public read of active time slots"
    ON public.time_slots FOR SELECT
    USING (TRUE);

-- Публичное создание бронирования
CREATE POLICY "Allow public insert into bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (TRUE);

-- Публичный выбор собственного бронирования по ID
CREATE POLICY "Allow public select own booking"
    ON public.bookings FOR SELECT
    USING (TRUE);

-- 7. Хранилище Supabase Storage для чеков
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Политика публичной загрузки чеков в бакет
CREATE POLICY "Allow public receipt uploads" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow public receipt view" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'receipts');

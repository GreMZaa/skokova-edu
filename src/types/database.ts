export type BookingStatus = 'pending_payment' | 'receipt_uploaded' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';

export type GradeLevel = 
  | 'preschool_5' 
  | 'preschool_6' 
  | 'grade_1' 
  | 'grade_2' 
  | 'grade_3' 
  | 'grade_4';

export interface Service {
  id: string;
  title: string;
  category: 'preschool' | 'primary_school' | 'diagnostic';
  description: string;
  duration_minutes: number;
  price: number;
  features: string[];
  is_active: boolean;
}

export interface TimeSlot {
  id: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  is_booked: boolean;
  locked_until?: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  slot_id: string;
  service_title: string;
  price: number;
  
  parent_name: string;
  phone: string;
  telegram_handle?: string | null;
  child_name: string;
  child_grade: GradeLevel;
  comment?: string | null;
  
  receipt_file_url?: string | null;
  status: BookingStatus;
  admin_notes?: string | null;
  rescheduled_from_slot_id?: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined relation
  slot?: TimeSlot;
}

export const GRADE_LABELS: Record<GradeLevel, string> = {
  preschool_5: 'Подготовка к школе (5 лет)',
  preschool_6: 'Подготовка к школе (6 лет / Перед 1 классом)',
  grade_1: '1 класс (Начальная школа)',
  grade_2: '2 класс (Начальная школа)',
  grade_3: '3 класс (Начальная школа)',
  grade_4: '4 класс (Начальная школа)',
};

export const STATUS_LABELS: Record<BookingStatus, { label: string; color: string }> = {
  pending_payment: { label: 'Ожидает оплаты', color: 'amber' },
  receipt_uploaded: { label: 'Чек загружен (На проверке)', color: 'blue' },
  confirmed: { label: 'Запись подтверждена', color: 'emerald' },
  rescheduled: { label: 'Занятие перенесено', color: 'purple' },
  cancelled: { label: 'Заявка отменена', color: 'rose' },
  completed: { label: 'Занятие завершено', color: 'sky' },
};

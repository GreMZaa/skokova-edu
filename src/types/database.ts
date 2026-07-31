export type BookingStatus = 'pending_payment' | 'receipt_uploaded' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';

export type GradeLevel = 
  | 'preschool_5'
  | 'preschool_6'
  | 'preschool'
  | 'grade_1'
  | 'grade_2'
  | 'grade_3'
  | 'grade_4'
  | 'grade_5'
  | 'grade_6'
  | 'grade_7'
  | 'grade_8'
  | 'grade_9'
  | 'grade_10'
  | 'grade_11'
  | 'age_5'
  | 'age_6'
  | 'age_7'
  | 'age_8'
  | 'age_9'
  | 'age_10'
  | 'age_11'
  | 'age_12'
  | 'age_13'
  | 'age_14'
  | 'age_15'
  | 'age_16'
  | 'age_17'
  | (string & {});

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

export const GRADE_LABELS: Record<string, string> = {
  preschool: 'Подготовка к школе',
  preschool_5: 'Подготовка к школе (5 лет)',
  preschool_6: 'Подготовка к школе (6–7 лет)',
  grade_1: '1 класс',
  grade_2: '2 класс',
  grade_3: '3 класс',
  grade_4: '4 класс',
  grade_5: '5 класс',
  grade_6: '6 класс',
  grade_7: '7 класс',
  grade_8: '8 класс',
  grade_9: '9 класс',
  grade_10: '10 класс',
  grade_11: '11 класс',
  age_5: 'Возраст: 5 лет',
  age_6: 'Возраст: 6 лет',
  age_7: 'Возраст: 7 лет',
  age_8: 'Возраст: 8 лет',
  age_9: 'Возраст: 9 лет',
  age_10: 'Возраст: 10 лет',
  age_11: 'Возраст: 11 лет',
  age_12: 'Возраст: 12 лет',
  age_13: 'Возраст: 13 лет',
  age_14: 'Возраст: 14 лет',
  age_15: 'Возраст: 15 лет',
  age_16: 'Возраст: 16 лет',
  age_17: 'Возраст: 17 лет',
};

export const STATUS_LABELS: Record<BookingStatus, { label: string; color: string }> = {
  pending_payment: { label: 'Ожидает оплаты', color: 'amber' },
  receipt_uploaded: { label: 'Чек загружен (На проверке)', color: 'blue' },
  confirmed: { label: 'Запись подтверждена', color: 'emerald' },
  rescheduled: { label: 'Занятие перенесено', color: 'purple' },
  cancelled: { label: 'Заявка отменена', color: 'rose' },
  completed: { label: 'Занятие завершено', color: 'sky' },
};

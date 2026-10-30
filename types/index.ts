export type UserRole = "ADMIN" | "EMPLOYEE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type ShiftStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "OPEN" | "CLOSED" | "ABSENT" | "CORRECTED";

export type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  status: ShiftStatus;
  created_at: string;
};

export type Employee = {
  id: string;
  employee_id: string;
  auth_user_id: string;
  name: string;
  mobile: string;
  designation: string;
  shift_id: string | null;
  role: UserRole;
  status: EmployeeStatus;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
  shifts?: Shift | null;
};

export type OfficeSettings = {
  id: string;
  office_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  allowed_radius_meters: number;
  office_public_ip: string | null;
  allowed_office_ips: string[];
  max_gps_accuracy_meters: number;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  check_in_distance_meters: number | null;
  check_in_ip: string | null;
  check_out_time: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  check_out_distance_meters: number | null;
  check_out_ip: string | null;
  total_work_minutes: number | null;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
  employees?: Employee | null;
};

export type AuditLog = {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
};

export type GpsPayload = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "EMPLOYEE_INACTIVE"
  | "ALREADY_CHECKED_IN"
  | "ALREADY_CHECKED_OUT"
  | "NOT_CHECKED_IN"
  | "OFFICE_NETWORK_REQUIRED"
  | "GPS_REQUIRED"
  | "GPS_ACCURACY_TOO_LOW"
  | "OUTSIDE_OFFICE"
  | "ATTENDANCE_NOT_FOUND"
  | "INVALID_ATTENDANCE_STATE"
  | "OFFICE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

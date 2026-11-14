import { z } from "zod";

export const gpsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(50000),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const employeeCreateSchema = z.object({
  employee_id: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Use uppercase letters and numbers only")
    .optional(),
  name: z.string().min(2).max(100),
  mobile: z.string().min(10).max(15),
  designation: z.string().min(2).max(100),
  shift_id: z.string().uuid().nullable().optional(),
  role: z.enum(["ADMIN", "ADMIN_VIEWER", "EMPLOYEE"]).default("EMPLOYEE"),
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(8),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const employeeUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  mobile: z.string().min(10).max(15).optional(),
  designation: z.string().min(2).max(100).optional(),
  shift_id: z.string().uuid().nullable().optional(),
  role: z.enum(["ADMIN", "ADMIN_VIEWER", "EMPLOYEE"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const shiftSchema = z.object({
  name: z.string().min(2).max(50),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  grace_minutes: z.number().int().min(0).max(120).default(15),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const officeLocationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  address: z.string().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  allowed_radius_meters: z.number().int().min(10).max(5000),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

export const officeSettingsSchema = z.object({
  office_name: z.string().min(2).max(100),
  address: z.string().max(300).nullable().optional(),
  /** Kept in sync with the first / primary location for legacy readers. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  allowed_radius_meters: z.number().int().min(10).max(5000).optional(),
  office_public_ip: z.string().max(45).nullable().optional(),
  allowed_office_ips: z.array(z.string().max(45)).optional(),
  max_gps_accuracy_meters: z.number().int().min(5).max(50000),
  allow_wifi_only_punch: z.boolean().default(true),
  timezone: z.string().min(3).max(64).default("Asia/Karachi"),
  locations: z.array(officeLocationSchema).min(1, "Add at least one office location"),
});

export const attendanceCorrectSchema = z.object({
  check_in_time: z.string().datetime().nullable().optional(),
  check_out_time: z.string().datetime().nullable().optional(),
  reason: z.string().min(3).max(500),
});

import { z } from "zod";

const phoneRegex = /^[\d\s()+.-]{7,}$/;

// Honeypot: a hidden field real users never fill. Bots that auto-fill
// every input will populate it, letting us silently drop the submission.
const honeypot = z.string().max(200).optional().default("");

export const bookingSchema = z.object({
  service: z.string().min(1, "Service is required").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  dateLabel: z.string().max(80).optional().default(""),
  time: z.string().min(1, "Time is required").max(40),
  name: z.string().min(1, "Name is required").max(120),
  phone: z.string().regex(phoneRegex, "Invalid phone number").max(40),
  email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  address: z.string().min(1, "Address is required").max(240),
  notes: z.string().max(2000).optional().default(""),
  company: honeypot,
});

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  contact: z.string().min(1, "Phone or email is required").max(160),
  message: z.string().min(5, "Message is too short").max(2000),
  company: honeypot,
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type ContactInput = z.infer<typeof contactSchema>;

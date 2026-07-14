import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  numeric,
  boolean,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Lead — every booking or contact-form submission lands here, append-only.
 * Structured columns power the admin inbox; `payload` keeps the full
 * validated submission for safety/auditing.
 */
export const leadType = pgEnum("lead_type", ["booking", "contact"]);
export const leadStatus = pgEnum("lead_status", ["new", "contacted", "won", "lost"]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: leadType("type").notNull(),
    status: leadStatus("status").notNull().default("new"),

    // Set when the lead is matched/created against a customer (dedupe by
    // phone/email). Nullable so leads still save when the DB has no match.
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    service: text("service"),
    preferredDate: text("preferred_date"),
    preferredTime: text("preferred_time"),
    address: text("address"),
    message: text("message"),

    payload: jsonb("payload").notNull(),

    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leads_created_idx").on(t.createdAt),
    index("leads_status_idx").on(t.status),
    index("leads_customer_idx").on(t.customerId),
    // Composite indexes matching the real (filter, sort) access patterns so the
    // inbox and per-customer history stay index-served as the table grows.
    index("leads_status_created_idx").on(t.status, t.createdAt),
    index("leads_customer_created_idx").on(t.customerId, t.createdAt),
    index("leads_created_id_idx").on(t.createdAt, t.id), // keyset pagination
  ]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatus.enumValues)[number];

/**
 * Booking — a schedulable appointment with its own lifecycle, distinct from
 * the append-only lead inbox. Every booking-type submission creates one in
 * `requested` state; Albert confirms or declines it.
 *
 * Double-booking is prevented at the database level by a PARTIAL UNIQUE index
 * on (date, time) limited to active states — two people can't both hold the
 * same slot, even under a race. A concurrent insert simply fails.
 */
export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "confirmed",
  "declined",
  "cancelled",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    status: bookingStatus("status").notNull().default("requested"),

    date: text("date").notNull(), // YYYY-MM-DD
    time: text("time").notNull(), // e.g. "9:00 AM"

    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    service: text("service"),
    address: text("address"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("bookings_date_idx").on(t.date),
    index("bookings_status_idx").on(t.status),
    // FK lookup (findBookingByLead) — previously unindexed.
    index("bookings_lead_idx").on(t.leadId).where(sql`lead_id is not null`),
    // Only one active (requested/confirmed) booking per slot.
    uniqueIndex("bookings_active_slot_idx")
      .on(t.date, t.time)
      .where(sql`status in ('requested', 'confirmed')`),
  ]
);

/**
 * Weekly availability template — one row per weekday (0=Sun … 6=Sat).
 * Replaces the hardcoded slot arrays. `slots` are display strings like
 * "9:00 AM". When the table is empty or the DB is unset, code falls back
 * to DEFAULT_AVAILABILITY so the public booking form always works.
 */
export const availability = pgTable("availability", {
  weekday: integer("weekday").primaryKey(), // 0..6
  enabled: boolean("enabled").notNull().default(true),
  slots: jsonb("slots").$type<string[]>().notNull(),
});

/**
 * Blocked slots — Albert marks time off. A row with `time = null` blocks the
 * entire day (vacation); with a time it blocks that single slot.
 */
export const blockedSlots = pgTable(
  "blocked_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: text("date").notNull(), // YYYY-MM-DD
    time: text("time"), // null => whole day
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("blocked_date_idx").on(t.date)]
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type AvailabilityRow = typeof availability.$inferSelect;
export type BlockedSlot = typeof blockedSlots.$inferSelect;

/**
 * Customer — a person Albert has done (or will do) work for. Created lazily
 * the first time a lead comes in, deduped by phone (preferred) or email so
 * repeat callers collapse into one record. `phoneKey` / `emailKey` hold the
 * normalized match keys; partial unique indexes keep duplicates out.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),

    // Normalized dedupe keys (digits-only phone, lowercased email).
    phoneKey: text("phone_key"),
    emailKey: text("email_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customers_created_idx").on(t.createdAt),
    index("customers_created_id_idx").on(t.createdAt, t.id), // keyset pagination
    uniqueIndex("customers_phone_key_idx")
      .on(t.phoneKey)
      .where(sql`phone_key is not null`),
    uniqueIndex("customers_email_key_idx")
      .on(t.emailKey)
      .where(sql`email_key is not null`),
  ]
);

/**
 * Job — a unit of billable work for a customer. Flows through the lifecycle
 * quoted → scheduled → in_progress → completed → invoiced (cancelled is a
 * terminal off-ramp). Can be spawned from a lead and/or a confirmed booking,
 * both kept as soft references so deleting either never drops the job.
 */
export const jobStatus = pgEnum("job_status", [
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
]);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    // Set when this job was spawned by accepting a quote. Nullable; cyclic
    // with quotes.jobId (both nullable, FKs added via separate ALTERs).
    quoteId: uuid("quote_id").references((): AnyPgColumn => quotes.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    status: jobStatus("status").notNull().default("quoted"),

    amountCents: integer("amount_cents"), // base labor/service price in cents
    discountCents: integer("discount_cents"), // optional invoice discount in cents

    scheduledDate: text("scheduled_date"), // YYYY-MM-DD
    scheduledTime: text("scheduled_time"), // e.g. "9:00 AM"
    address: text("address"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("jobs_customer_idx").on(t.customerId),
    index("jobs_status_idx").on(t.status),
    index("jobs_created_idx").on(t.createdAt),
    // Board (status, sort), per-customer history, and lifetime-spend rollup.
    index("jobs_status_created_idx").on(t.status, t.createdAt),
    index("jobs_customer_created_idx").on(t.customerId, t.createdAt),
    index("jobs_customer_status_idx").on(t.customerId, t.status),
    index("jobs_created_id_idx").on(t.createdAt, t.id), // keyset pagination
    // FK lookup (getJobLinksForBookings / createJobFromBooking) — was unindexed.
    index("jobs_booking_idx").on(t.bookingId).where(sql`booking_id is not null`),
  ]
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type JobStatus = (typeof jobStatus.enumValues)[number];

/**
 * Quote — an itemized estimate for a customer. `totalCents` is denormalized
 * (Σ line totals + tax) so listings and the lifetime-spend rollup never have
 * to re-aggregate line items. Accepting a quote spawns a linked job
 * (quotes.jobId ⇄ jobs.quoteId — a deliberate, both-nullable cycle).
 * `number` is a human-friendly identity sequence shown as "Q-1024".
 */
export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
]);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: integer("number").notNull().generatedAlwaysAsIdentity(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),

    status: quoteStatus("status").notNull().default("draft"),
    title: text("title").notNull(),
    notes: text("notes"),

    taxCents: integer("tax_cents"),
    totalCents: integer("total_cents").notNull().default(0),
    validUntil: text("valid_until"), // YYYY-MM-DD

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("quotes_customer_idx").on(t.customerId),
    index("quotes_status_idx").on(t.status),
    index("quotes_created_idx").on(t.createdAt),
    index("quotes_customer_created_idx").on(t.customerId, t.createdAt),
  ]
);

export const quoteLineItems = pgTable(
  "quote_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("quote_line_items_quote_idx").on(t.quoteId)]
);

/**
 * Payment — money actually collected. Stripe payments are inserted `pending`
 * when the Checkout Session is created, then flipped to `succeeded` by the
 * webhook (idempotent via the unique `stripe_session_id`). Manual cash/check
 * payments are inserted `succeeded` immediately. Lifetime spend = Σ amountCents
 * where status = 'succeeded'.
 */
export const paymentMethod = pgEnum("payment_method", [
  "card_stripe",
  "cash",
  "check",
  "other",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),

    amountCents: integer("amount_cents").notNull(),
    method: paymentMethod("method").notNull(),
    status: paymentStatus("status").notNull().default("succeeded"),

    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    reference: text("reference"), // check # / freeform note

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("payments_customer_idx").on(t.customerId),
    index("payments_status_idx").on(t.status),
    index("payments_customer_created_idx").on(t.customerId, t.createdAt),
    index("payments_customer_status_idx").on(t.customerId, t.status),
    uniqueIndex("payments_stripe_session_idx")
      .on(t.stripeSessionId)
      .where(sql`stripe_session_id is not null`),
  ]
);

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteStatus = (typeof quoteStatus.enumValues)[number];
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type NewQuoteLineItem = typeof quoteLineItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];

/**
 * Notification overrides — admin-editable enable flag + message template for
 * each outgoing notification. The full catalog (keys, channel, labels,
 * default copy) lives in code (lib/notifications.ts); this table only stores
 * what Albert customizes, keyed by the notification's `key`. Absent rows fall
 * back to the code defaults, so notifications work before the table is touched.
 */
export const notifications = pgTable("notifications", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  subject: text("subject"), // email subject; null for SMS-only notifications
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;

/**
 * Job notes — an append-only, timestamped log of updates on a job (distinct
 * from the job's single `notes` description field). Cascades with the job.
 */
export const jobNotes = pgTable(
  "job_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_notes_job_idx").on(t.jobId)]
);

export type JobNote = typeof jobNotes.$inferSelect;
export type NewJobNote = typeof jobNotes.$inferInsert;

/**
 * Job materials — what was used/bought for a job, who paid (company vs client),
 * and the price. Names double as reusable "tags": typing one suggests prior
 * materials (and their last price). Used to track per-job material spend.
 */
export const materialPurchaser = pgEnum("material_purchaser", ["company", "client"]);

export const jobMaterials = pgTable(
  "job_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    purchaser: materialPurchaser("purchaser").notNull().default("company"),
    // Where it was bought — a preset (Home Depot, Lowe's, …) or a write-in.
    // Null when not specified.
    store: text("store"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("job_materials_job_idx").on(t.jobId),
    index("job_materials_name_idx").on(t.name),
    index("job_materials_created_idx").on(t.createdAt), // reports date-range scan
  ]
);

export type JobMaterial = typeof jobMaterials.$inferSelect;
export type NewJobMaterial = typeof jobMaterials.$inferInsert;
export type MaterialPurchaser = (typeof materialPurchaser.enumValues)[number];

/**
 * Work photos — the "Our Work" gallery on the public site, managed from the
 * admin. Files live in blob storage (Vercel Blob); this table holds the public
 * URL, the blob pathname (needed to delete the file), an optional caption, and
 * a manual sort order. The gallery also merges any images committed to
 * public/brand/work, so both a folder drop-in and admin uploads work.
 */
export const workPhotos = pgTable(
  "work_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(), // public blob URL
    pathname: text("pathname").notNull(), // blob pathname, for deletion
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("work_photos_order_idx").on(t.sortOrder, t.createdAt)]
);

export type WorkPhoto = typeof workPhotos.$inferSelect;
export type NewWorkPhoto = typeof workPhotos.$inferInsert;

/**
 * Invoice PDF rendering (server-only). Reuses the invoice (quote) record.
 * `paid` renders the receipt variant: a red PAID stamp and a $0 balance.
 */
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { AdminQuote } from "./quotes";
import { site } from "./site-config";

export type PdfCustomer = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
} | null;

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const INK = "#17191f";
const ORANGE = "#f26a1f";
const GRAY = "#6b7280";
const RED = "#dc2626";

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 26,
  },
  bizName: { fontSize: 15, fontFamily: "Helvetica-Bold", maxWidth: 260 },
  bizContact: { fontSize: 9, color: GRAY, marginTop: 5, lineHeight: 1.5 },
  invBox: { alignItems: "flex-end" },
  invTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", color: ORANGE, letterSpacing: 2 },
  invMeta: { fontSize: 9, color: GRAY, marginTop: 5 },
  billTo: { marginBottom: 18 },
  label: {
    fontSize: 8,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  billName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  billLine: { fontSize: 10, color: "#374151", marginTop: 2 },
  th: {
    flexDirection: "row",
    backgroundColor: "#f4efe4",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  thDesc: { flex: 1, fontSize: 8, color: GRAY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Helvetica-Bold" },
  thAmt: { width: 90, textAlign: "right", fontSize: 8, color: GRAY, textTransform: "uppercase", letterSpacing: 1, fontFamily: "Helvetica-Bold" },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  rowDesc: { flex: 1, fontSize: 10 },
  rowAmt: { width: 90, textAlign: "right", fontSize: 10 },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 230, justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 10, color: GRAY },
  totalVal: { fontSize: 10, textAlign: "right" },
  balanceRow: {
    flexDirection: "row",
    width: 230,
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 6,
    borderTopWidth: 2,
    borderColor: INK,
  },
  balanceLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  balanceVal: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  notes: { marginTop: 22, fontSize: 9, color: GRAY, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 34,
    left: 42,
    right: 42,
    textAlign: "center",
    fontSize: 8,
    color: GRAY,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    paddingTop: 10,
  },
  paidStamp: {
    position: "absolute",
    top: 130,
    left: 170,
    fontSize: 58,
    fontFamily: "Helvetica-Bold",
    color: RED,
    borderWidth: 4,
    borderColor: RED,
    paddingVertical: 6,
    paddingHorizontal: 22,
    letterSpacing: 6,
    transform: "rotate(-14deg)",
  },
});

function InvoiceDoc({
  invoice,
  customer,
  paid,
}: {
  invoice: AdminQuote;
  customer: PdfCustomer;
  paid: boolean;
}) {
  const subtotal = invoice.totalCents - (invoice.taxCents ?? 0);
  const balance = paid ? 0 : invoice.totalCents;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {paid && <Text style={styles.paidStamp}>PAID</Text>}

        <View style={styles.header}>
          <View>
            <Text style={styles.bizName}>{site.name}</Text>
            <Text style={styles.bizContact}>
              {site.phoneDisplay}
              {"\n"}
              {site.email}
              {"\n"}
              {site.serviceArea.region}
            </Text>
          </View>
          <View style={styles.invBox}>
            <Text style={styles.invTitle}>INVOICE</Text>
            <Text style={styles.invMeta}>#{invoice.number}</Text>
            <Text style={styles.invMeta}>{fmtDate(invoice.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={styles.billName}>{customer?.name ?? "Customer"}</Text>
          {customer?.address ? <Text style={styles.billLine}>{customer.address}</Text> : null}
          {customer?.phone ? <Text style={styles.billLine}>{customer.phone}</Text> : null}
          {customer?.email ? <Text style={styles.billLine}>{customer.email}</Text> : null}
        </View>

        <View style={styles.th}>
          <Text style={styles.thDesc}>Description</Text>
          <Text style={styles.thAmt}>Amount</Text>
        </View>
        {invoice.lineItems.map((li) => (
          <View key={li.id} style={styles.row}>
            <Text style={styles.rowDesc}>{li.description}</Text>
            <Text style={styles.rowAmt}>{money(li.lineTotalCents)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalVal}>{money(subtotal)}</Text>
          </View>
          {invoice.taxCents ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalVal}>{money(invoice.taxCents)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalVal}>{money(invoice.totalCents)}</Text>
          </View>
          {paid ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Amount Paid</Text>
              <Text style={styles.totalVal}>{money(invoice.totalCents)}</Text>
            </View>
          ) : null}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance Due</Text>
            <Text style={[styles.balanceVal, paid ? { color: "#16a34a" } : {}]}>
              {money(balance)}
            </Text>
          </View>
        </View>

        {invoice.notes ? <Text style={styles.notes}>{invoice.notes}</Text> : null}

        <Text style={styles.footer}>
          Thank you for your business! · {site.name} · {site.phoneDisplay}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  invoice: AdminQuote,
  customer: PdfCustomer,
  paid = false
): Promise<Buffer> {
  return (await renderToBuffer(
    <InvoiceDoc invoice={invoice} customer={customer} paid={paid} />
  )) as Buffer;
}

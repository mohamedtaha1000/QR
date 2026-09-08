/**
 * Every QR type is described here — nothing about vCard or ID cards is
 * hard-coded anywhere else in the app. Adding a type means adding an entry.
 */

export type FieldKey =
  | "no" | "code" | "displayName" | "mobile" | "jobTitle" | "email" | "comments";

export interface ColumnSpec {
  key: FieldKey;
  label: string;
  aliases: string[];
  required?: boolean;
  /** Shown as a warning (not an error) when the cell is empty. */
  warnIfEmpty?: boolean;
}

export interface QrTypeDef {
  id: "vcard" | "id";
  name: string;
  blurb: string;
  ready: boolean;
  url: string;
  columns: ColumnSpec[];
  /** Values identical for every person in the batch. */
  fixed: { label: string; value: string }[];
  themeValue: string;
  designTemplateFragment: string;
  color: string;
  qrNameTemplate: string;
  fileNameTemplate: string;
}

const SHARED_COLUMNS: ColumnSpec[] = [
  { key: "no", label: "NO", aliases: ["no", "number", "#", "sn", "serial"] },
  { key: "code", label: "Code", aliases: ["code", "empcode", "employeecode", "id", "idcode"] },
  {
    key: "displayName", label: "Display Name", required: true,
    aliases: ["displayname", "name", "fullname", "displayedname"],
  },
  {
    key: "mobile", label: "Mobile", warnIfEmpty: true,
    aliases: ["mobile", "phone", "mobilenumber", "phonenumber", "cell"],
  },
  {
    key: "jobTitle", label: "Job Title", warnIfEmpty: true,
    aliases: ["jobtitle", "title", "position", "job"],
  },
  {
    key: "email", label: "Email", warnIfEmpty: true,
    aliases: ["email", "mail", "emailaddress"],
  },
  { key: "comments", label: "Comments", aliases: ["comments", "comment", "notes", "note", "remarks"] },
];

export const STM = {
  company: "STM",
  website: "www.stm.com.eg",
  country: "Egypt",
  state: "Cairo",
  city: "New Cairo",
  street: "East Plaza, Intersection of South 90th Street and Mohamed Naguib Axis",
  color: "#2b3334",
};

export const QR_TYPES: Record<QrTypeDef["id"], QrTypeDef> = {
  vcard: {
    id: "vcard",
    name: "vCard",
    blurb:
      "Contact QR for business cards and email signatures — name, title, mobile, " +
      "email and the STM address, on template 3.",
    ready: true,
    url: "https://www.qrcode-tiger.com/qr-code-generator/vcard",
    columns: SHARED_COLUMNS,
    fixed: [
      { label: "Company", value: STM.company },
      { label: "Website", value: STM.website },
      { label: "Country", value: STM.country },
      { label: "State", value: STM.state },
      { label: "City", value: STM.city },
      { label: "Street", value: STM.street },
    ],
    themeValue: "3",
    designTemplateFragment: "1782134846539",
    color: STM.color,
    qrNameTemplate: "{displayName} {code} VCard",
    fileNameTemplate: "{code}_{displayName}_VCard",
  },
  id: {
    id: "id",
    name: "ID Card",
    blurb:
      "QR for staff ID cards. The field mapping and layout for this type still " +
      "need to be defined before it can run.",
    ready: false,
    url: "https://www.qrcode-tiger.com/",
    columns: SHARED_COLUMNS,
    fixed: [{ label: "Company", value: STM.company }],
    themeValue: "1",
    designTemplateFragment: "",
    color: STM.color,
    qrNameTemplate: "{displayName} {code} ID",
    fileNameTemplate: "{code}_{displayName}_ID",
  },
};

export function fillTemplate(template: string, row: Record<string, string>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => row[key] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeFileName(text: string): string {
  return (
    text
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .replace(/^[._]+|[._]+$/g, "") || "qr"
  );
}

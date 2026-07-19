// AUTO-GENERATED from "ESCAP-RDTII-2.1 Round 1 Database.xlsx — RDTII 2.1 Methodology"
// (the Group-B discrete-criteria scoring rules). Companion to rawScore.ts's Group A
// (static treaty-membership facts) and indicators.ts's controlled ID vocabulary.
//
// Each indicator maps ordered scoring tiers (tier 1 = most restrictive/heavily
// regulated, last tier = least restrictive/simplified) straight from the
// methodology's "Criteria for scoring" / "Possible scores" columns. Minor source
// typos (e.g. "Abesence", mojibake apostrophes/≥) were corrected for readability;
// scoring meaning is unchanged. "Category (Policy issue)" text — including any
// embedded "Exception:" scope clause — is carried into `focus` verbatim in meaning.
//
// P12-I4 ("Online payment limitations") is NOT a single tiered scale in the source —
// it's 7 independent binary sub-checks (12.4.1–12.4.7), each scoring 1 if present.
// Modeled here as `subCriteria` + `aggregation: "MAX"` (indicator score = 1 if ANY
// sub-measure is present, else 0) instead of forcing it into the tiers shape.
//
// Regenerate if the methodology changes; do not hand-edit indicator IDs — the
// consistency guards at the bottom of this file throw at import time on drift
// against indicators.ts (unknown id / pillar mismatch / duplicate) or overlap
// with rawScore.ts's Group A set.
//
// Indicators present in indicators.ts but ABSENT from the methodology CSV (14 —
// intentional per the CSV's own footnote: "non-regulatory" indicators the
// automation tool isn't required to extract):
//   Already wired as Group A (rawScore.ts):        P1-I3, P2-I4, P4-I4
//   Treaty/model-law/index membership, NOT YET
//   scored anywhere (no Group A entry, no Group B
//   entry — silently "NOT FOUND" until classified): P4-I7 (WCT), P4-I8 (WPPT),
//     P5-I6 (WTO Telecom Reference Paper), P6-I5 (binding data-transfer agreement),
//     P9-I2 (Internet shutdowns — V-Dem score), P12-I10/I11/I12/I13 (UNCITRAL
//     Convention/Model Law adoption)
//   Uncertain category — NOT treaty-membership-shaped, needs manual review
//   (likely require external tariff-schedule data, not a text criteria scale):
//     P1-I1 (Effective tariffs), P1-I2 (No duty-free tariff lines)

import { findIndicator } from "./indicators.js";
import { GROUP_A_INDICATOR_IDS } from "./groupAIds.js";

export interface CriteriaTier {
  tier: number;
  description: string;
  score: number;
}

export interface SubCriterion {
  id: string;          // sub-check id as it appears in the methodology, e.g. "12.4.1"
  description: string;
  score: number;        // score contributed if this sub-measure is present
}

export interface IndicatorCriteria {
  indicatorId: string;          // canonical P#-I# form (see indicators.ts)
  pillarId: number;
  focus: string;                 // methodology's "Category (Policy issue)" text, incl. any Exception clause
  tiers?: CriteriaTier[];        // ordered tier 1 (most restrictive) → last (least); absent for subCriteria-based indicators
  formula?: string;              // free-text scoring note, e.g. P1-I4's per-measure cap
  subCriteria?: SubCriterion[];  // P12-I4 special case: independent binary sub-checks
  aggregation?: "MAX";           // how subCriteria combine into a single score
}

export const GROUP_B_CRITERIA: IndicatorCriteria[] = [
  // ---- Pillar 1: Tariffs & Trade Defence ----
  {
    indicatorId: "P1-I4", pillarId: 1,
    focus: "Trade defence measures including anti-dumping, countervailing duties and safeguards on ICT-related goods imported by other economies within the considered United Nations region",
    tiers: [
      { tier: 1, description: "More than three measures", score: 1 },
      { tier: 2, description: "Three measures", score: 0.75 },
      { tier: 3, description: "Two measures", score: 0.5 },
      { tier: 4, description: "One measure", score: 0.25 },
      { tier: 5, description: "No measure", score: 0 },
    ],
    formula: "0.25 per measure, up to a maximum of 1",
  },

  // ---- Pillar 2: Public Procurement ----
  {
    indicatorId: "P2-I1", pillarId: 2,
    focus: "Foreign exclusions from public procurement related to ICT goods and digital services",
    tiers: [
      { tier: 1, description: "Any legislative measure excludes foreign firms from public procurement under any circumstances, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Any legislative measure excludes a specific (group of) foreign firm(s) from public procurement", score: 0.5 },
      { tier: 3, description: "No measure (only a legal basis granting the government the power to exclude foreign firms)", score: 0 },
    ],
  },
  {
    indicatorId: "P2-I2", pillarId: 2,
    focus: "Specific requirements on source codes, encryption and trade secrets",
    tiers: [
      { tier: 1, description: "Any requirement to surrender patents, source codes or trade secrets as a condition for participating in tenders", score: 1 },
      { tier: 2, description: "Any requirement to use specific encryption to win tenders", score: 0.5 },
      { tier: 3, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P2-I3", pillarId: 2,
    focus: "Limitations in procurement bidding",
    tiers: [
      { tier: 1, description: "Any measure directly discriminates against foreign bidders, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Any measure applies to all bidders, such as local content requirements and performance-based conditions", score: 0.5 },
      { tier: 3, description: "No measure (only a legal basis granting the government the power to impose limitations in procurement bidding)", score: 0 },
    ],
  },

  // ---- Pillar 3: Foreign Direct Investment ----
  {
    indicatorId: "P3-I1", pillarId: 3,
    focus: "Foreign equity limits in sectors relevant to digital trade (Exception: excludes foreign equity caps in the telecom sector [Pillar 5] and e-commerce sector [Pillar 12])",
    tiers: [
      { tier: 1, description: "Ban (0%) in at least one sector, or only a minority stake allowed in more than one sector", score: 1 },
      { tier: 2, description: "A minority stake (1-50%) allowed in one sector", score: 0.8 },
      { tier: 3, description: "A controlling stake (51-99%) allowed, or restrictions only exist in SOEs", score: 0.5 },
      { tier: 4, description: "Full ownership (100%) allowed in sectors relevant to digital trade", score: 0 },
    ],
  },
  {
    indicatorId: "P3-I2", pillarId: 3,
    focus: "Joint venture requirements",
    tiers: [
      { tier: 1, description: "Any measure", score: 1 },
      { tier: 2, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P3-I3", pillarId: 3,
    focus: "Nationality or residency requirements for board of directors or managers",
    tiers: [
      { tier: 1, description: "Any measure", score: 1 },
      { tier: 2, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P3-I4", pillarId: 3,
    focus: "Screening of investment and acquisitions (Exception: anti-trust measures related to M&A are not considered a restriction, unless discriminatory)",
    tiers: [
      { tier: 1, description: "A case where the screening mechanism has been used to block an investment in a sector relevant to digital trade", score: 1 },
      { tier: 2, description: "Two or more investment screening mechanisms", score: 0.5 },
      { tier: 3, description: "A screening mechanism", score: 0.25 },
      { tier: 4, description: "No screening mechanism", score: 0 },
    ],
  },
  {
    indicatorId: "P3-I5", pillarId: 3,
    focus: "Commercial presence requirements to offer cross-border services in sectors relevant to digital trade",
    tiers: [
      { tier: 1, description: "Any measure", score: 1 },
      { tier: 2, description: "No measure", score: 0 },
    ],
  },

  // ---- Pillar 4: Intellectual Property Rights ----
  {
    indicatorId: "P4-I1", pillarId: 4,
    focus: "Patent application issues",
    tiers: [
      { tier: 1, description: "Differential treatment between local and foreign firms, requirement to appoint a local representative, and rejection of patent applications in a discriminatory manner", score: 1 },
      { tier: 2, description: "Non-transparent process, high filing fees, high registration costs, substantive examination, and the requirement to file a patent locally before filing abroad", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I2", pillarId: 4,
    focus: "Patent enforcement issues: civil and administrative procedures and remedies; and provisional measures",
    tiers: [
      { tier: 1, description: "Absence of civil and administrative procedures and remedies, and provisional measures", score: 1 },
      { tier: 2, description: "Adopts civil and administrative procedures and remedies, or provisional measures", score: 0.5 },
      { tier: 3, description: "Adopts civil and administrative procedures and remedies, and provisional measures", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I3", pillarId: 4,
    focus: "Patent enforcement issues: others",
    tiers: [
      { tier: 1, description: "Any restriction with high impact, affecting all circumstances and sectors, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Any restriction with limited impact, affecting a specific circumstance or sector", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I5", pillarId: 4,
    focus: "Lack of copyright framework and exceptions",
    tiers: [
      { tier: 1, description: "Lack of copyright legal framework, or lack of copyright exceptions", score: 1 },
      { tier: 2, description: "Unclear copyright exceptions, such as the three-step test and other types of copyright exceptions", score: 0.5 },
      { tier: 3, description: "Clear copyright exceptions following the fair use or fair dealing model", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I6", pillarId: 4,
    focus: "Online copyright enforcement issues: civil and administrative procedures and remedies; and provisional measures",
    tiers: [
      { tier: 1, description: "Absence of civil and administrative procedures and remedies, and provisional measures", score: 1 },
      { tier: 2, description: "Adopts civil and administrative procedures and remedies, or provisional measures", score: 0.5 },
      { tier: 3, description: "Adopts civil and administrative procedures and remedies, and provisional measures", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I9", pillarId: 4,
    focus: "Mandatory disclosure of trade secrets, such as source code and algorithms",
    tiers: [
      { tier: 1, description: "Any disclosure requirement affecting an entire sector or all sectors horizontally, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Any disclosure requirement of limited impact affecting only specific types of products or specific circumstances (e.g. disclosure due to court order, regulatory proceedings, or a national-threat provision for certain companies)", score: 0.5 },
      { tier: 3, description: "No measure, or the government mandates disclosure of trade secrets only when necessary to protect the public interest, with safeguards against unfair commercial use", score: 0 },
    ],
  },
  {
    indicatorId: "P4-I10", pillarId: 4,
    focus: "Lack of effective trade secrets legal framework",
    tiers: [
      { tier: 1, description: "Lack of a trade secrets legal framework able to provide effective protection", score: 1 },
      { tier: 2, description: "Limited practice/scope addressing protection of trade secrets, or practices with certain clauses included in IP law or other relevant law", score: 0.5 },
      { tier: 3, description: "Presence of effective trade secrets protection in any form", score: 0 },
    ],
  },

  // ---- Pillar 5: Telecom Regulations & Competition ----
  {
    indicatorId: "P5-I1", pillarId: 5,
    focus: "Lack of passive infrastructure sharing",
    tiers: [
      { tier: 1, description: "No passive infrastructure sharing obligation", score: 1 },
      { tier: 2, description: "Passive sharing is not mandated, but is practiced in the market", score: 0.5 },
      { tier: 3, description: "Passive sharing is mandated", score: 0 },
    ],
  },
  {
    indicatorId: "P5-I2", pillarId: 5,
    focus: "Foreign equity limits in telecom sector",
    tiers: [
      { tier: 1, description: "Ban (0%), or only a minority stake allowed in more than one measure", score: 1 },
      { tier: 2, description: "A minority stake (1-50%) allowed", score: 0.8 },
      { tier: 3, description: "A controlling stake (51-99%) allowed, or restrictions only exist in SOEs", score: 0.5 },
      { tier: 4, description: "Full ownership (100%) allowed in the telecommunications sector", score: 0 },
    ],
  },
  {
    indicatorId: "P5-I3", pillarId: 5,
    focus: "Shares owned by the Government in telecom companies",
    tiers: [
      { tier: 1, description: "At least one company with government shares above 50%, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "One company with government shares between 1% and 50%", score: 0.5 },
      { tier: 3, description: "No shares owned by the government in telecom companies", score: 0 },
    ],
  },
  {
    indicatorId: "P5-I4", pillarId: 5,
    focus: "Lack of functional/accounting separation",
    tiers: [
      { tier: 1, description: "No functional/accounting separation is mandated", score: 1 },
      { tier: 2, description: "Only accounting separation is mandated", score: 0.5 },
      { tier: 3, description: "Only functional separation is mandated", score: 0.25 },
      { tier: 4, description: "Both accounting and functional separation are mandated", score: 0 },
    ],
  },
  {
    indicatorId: "P5-I5", pillarId: 5,
    focus: "Licensing requirements in telecom sector for operators",
    tiers: [
      { tier: 1, description: "Any strict licensing scheme (e.g. discrimination against foreign providers, minimum capital requirements, mandatory performance requirements)", score: 1 },
      { tier: 2, description: "No strict licensing scheme", score: 0 },
    ],
  },
  {
    indicatorId: "P5-I7", pillarId: 5,
    focus: "Lack of independent telecom authority",
    tiers: [
      { tier: 1, description: "No independent telecom authority", score: 1 },
      { tier: 2, description: "Independent telecom authority is established", score: 0 },
    ],
  },

  // ---- Pillar 6: Cross-border Data Policies ----
  {
    indicatorId: "P6-I1", pillarId: 6,
    focus: "Ban & local processing requirements (Exception: does not score a data-localization measure applied to government data)",
    tiers: [
      { tier: 1, description: "Ban and/or local processing requirement for all sectors or personal data, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Ban and/or local processing requirement applied to a specific sector, specific data, or non-personal data, or transfer is prohibited to one country", score: 0.5 },
      { tier: 3, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P6-I2", pillarId: 6,
    focus: "Local storage requirements (Exception: does not score a data-localization measure applied to government data)",
    tiers: [
      { tier: 1, description: "Local storage requirement for all sectors or personal data, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Local storage requirement applied to a specific sector, specific data, or non-personal data", score: 0.5 },
      { tier: 3, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P6-I3", pillarId: 6,
    focus: "Infrastructure requirements (Exception: does not score a data-localization measure applied to government data)",
    tiers: [
      { tier: 1, description: "Infrastructure requirement", score: 1 },
      { tier: 2, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P6-I4", pillarId: 6,
    focus: "Conditional flow regimes (Exception: does not score a data-localization measure applied to government data)",
    tiers: [
      { tier: 1, description: "Conditions apply for all sectors or personal data", score: 1 },
      { tier: 2, description: "Conditions apply for specific data or non-personal data", score: 0.5 },
      { tier: 3, description: "No condition", score: 0 },
    ],
  },

  // ---- Pillar 7: Domestic Data Protection & Privacy ----
  {
    indicatorId: "P7-I1", pillarId: 7,
    focus: "Lack of comprehensive legal framework for data protection",
    tiers: [
      { tier: 1, description: "No data protection legal framework", score: 1 },
      { tier: 2, description: "Data protection legal framework applies only to specific sectors (sectoral law)", score: 0.5 },
      { tier: 3, description: "Comprehensive data protection framework", score: 0 },
    ],
  },
  {
    indicatorId: "P7-I2", pillarId: 7,
    focus: "Lack of dedicated legal framework for cybersecurity",
    tiers: [
      { tier: 1, description: "No cybersecurity legal framework", score: 1 },
      { tier: 2, description: "Non-dedicated cybersecurity legal framework, and/or a dedicated cybersecurity law applying only to specific sectors (sectoral law)", score: 0.5 },
      { tier: 3, description: "Dedicated cybersecurity legal framework (horizontal)", score: 0 },
    ],
  },
  {
    indicatorId: "P7-I3", pillarId: 7,
    focus: "Minimum period of data retention requirements (Exception: does not score a requirement applied to government data)",
    tiers: [
      { tier: 1, description: "Minimum period of data retention requirement", score: 1 },
      { tier: 2, description: "No data retention requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P7-I4", pillarId: 7,
    focus: "Data Protection Impact Assessment (DPIA) or Data Protection Officer (DPO) requirements",
    tiers: [
      { tier: 1, description: "DPO and DPIA, or only a DPO requirement, applied to all sectors", score: 1 },
      { tier: 2, description: "DPO and DPIA, or only a DPO requirement, applied to a specific sector", score: 0.5 },
      { tier: 3, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P7-I5", pillarId: 7,
    focus: "Requirements to allow government access to personal data",
    tiers: [
      { tier: 1, description: "Any measure that allows government to access data without court orders", score: 1 },
      { tier: 2, description: "No measure", score: 0 },
    ],
  },

  // ---- Pillar 8: Internet Intermediary Liability ----
  {
    indicatorId: "P8-I1", pillarId: 8,
    focus: "Lack of safe harbour for copyright infringements",
    tiers: [
      { tier: 1, description: "No intermediary liability framework in place", score: 1 },
      { tier: 2, description: "Sectoral framework in place that limits liability for intermediaries", score: 0.5 },
      { tier: 3, description: "Horizontal framework in place that limits liability for intermediaries", score: 0 },
    ],
  },
  {
    indicatorId: "P8-I2", pillarId: 8,
    focus: "Lack of safe harbour for other illegal activities",
    tiers: [
      { tier: 1, description: "No intermediary liability framework in place", score: 1 },
      { tier: 2, description: "Sectoral framework in place that limits liability for intermediaries", score: 0.5 },
      { tier: 3, description: "Horizontal framework in place that limits liability for intermediaries", score: 0 },
    ],
  },
  {
    indicatorId: "P8-I3", pillarId: 8,
    focus: "User identity requirements",
    tiers: [
      { tier: 1, description: "User identity requirement to connect to the Internet or access online services", score: 1 },
      { tier: 2, description: "User identity requirement for SIM registration", score: 0.5 },
      { tier: 3, description: "No restrictions", score: 0 },
    ],
  },
  {
    indicatorId: "P8-I4", pillarId: 8,
    focus: "Monitoring requirements",
    tiers: [
      { tier: 1, description: "Any monitoring requirement (monitor users' activities, or remove or block content)", score: 1 },
      { tier: 2, description: "Any requirement for active monitoring of users' activities without a legal obligation to remove or block content", score: 0.5 },
      { tier: 3, description: "No measure", score: 0 },
    ],
  },

  // ---- Pillar 9: Content Access ----
  {
    indicatorId: "P9-I1", pillarId: 9,
    focus: "Blocking/filtering commercial web content (Exception: does not score political content, criminal content e.g. child pornography, age-restricted content, defamation, or other non-commercial content)",
    tiers: [
      { tier: 1, description: "Any blocking measure", score: 1 },
      { tier: 2, description: "Any filtering measure", score: 0.5 },
      { tier: 3, description: "No cases of blocking nor filtering (except internationally agreed illegal content/child pornography)", score: 0 },
    ],
  },
  {
    indicatorId: "P9-I3", pillarId: 9,
    focus: "Online advertising restrictions (Exception: does not score requirements that advertising should not be misleading)",
    tiers: [
      { tier: 1, description: "Any restriction on online advertising", score: 1 },
      { tier: 2, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P9-I4", pillarId: 9,
    focus: "Licensing requirements for online content providers and applications (social media platforms, news providers, VPN, cloud services, etc.) (Exception: does not cover licenses for telecommunication facilities/service providers [Pillar 5] or licenses for e-commerce platforms [Pillar 12])",
    tiers: [
      { tier: 1, description: "Any strict licence requirement, or more than one measure under tier 2", score: 1 },
      { tier: 2, description: "Any licensing scheme", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },

  // ---- Pillar 10: Non-technical NTMs ----
  {
    indicatorId: "P10-I1", pillarId: 10,
    focus: "Import bans applied to ICT goods and online services (e.g. network equipment, servers, handsets, applications, and data processing)",
    tiers: [
      { tier: 1, description: "Ban on more than one ICT good or digital service", score: 1 },
      { tier: 2, description: "Ban on one specific product or service", score: 0.5 },
      { tier: 3, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P10-I2", pillarId: 10,
    focus: "Other import restrictions on ICT goods and online services",
    tiers: [
      { tier: 1, description: "Import restrictions that potentially block trade (e.g. quotas), or at least two measures under tier 2", score: 1 },
      { tier: 2, description: "Import restrictions that add regulatory compliance costs to trade in ICT goods and online services (e.g. licenses, permits, authorization, registration for ICT goods, labelling requirements, import controls)", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P10-I3", pillarId: 10,
    focus: "Local content requirements",
    tiers: [
      { tier: 1, description: "At least one LCR at sectoral or horizontal level (HS-4, e.g. telephony equipment, and HS-2 levels), or at least two LCRs under tier 2", score: 1 },
      { tier: 2, description: "At least one LCR at product level (HS-6 and HS-8 levels, e.g. mobile phones and smartphones)", score: 0.5 },
      { tier: 3, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P10-I4", pillarId: 10,
    focus: "Export restrictions on ICT goods and online services",
    tiers: [
      { tier: 1, description: "Export restriction", score: 1 },
      { tier: 2, description: "No restriction", score: 0 },
    ],
  },

  // ---- Pillar 11: Standards & Procedures ----
  {
    indicatorId: "P11-I1", pillarId: 11,
    focus: "Lack of transparent technical standards",
    tiers: [
      { tier: 1, description: "Foreigners not allowed to participate in standard-setting bodies, or non-transparent standard-setting", score: 1 },
      { tier: 2, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P11-I2", pillarId: 11,
    focus: "Self-certification limitations for product safety (radio transmissions, EMC/EMI)",
    tiers: [
      { tier: 1, description: "SDoC (Supplier's Declaration of Conformity) and third-party certification not allowed", score: 1 },
      { tier: 2, description: "SDoC not allowed, but 3rd-party certification from CABs in countries with a Mutual Recognition Arrangement (MRA) is accepted", score: 0.5 },
      { tier: 3, description: "SDoC is allowed for foreign business", score: 0 },
    ],
  },
  {
    indicatorId: "P11-I3", pillarId: 11,
    focus: "Product screening & testing requirements",
    tiers: [
      { tier: 1, description: "Measure in place and used for products in scope", score: 1 },
      { tier: 2, description: "Measure in place, but 3rd-party testing results are accepted", score: 0.5 },
      { tier: 3, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P11-I4", pillarId: 11,
    focus: "Deviation from international encryption standards (ISO, IEC, ITU, FIPS, AES, TDES, ECC)",
    tiers: [
      { tier: 1, description: "Any measure or known case of deviation", score: 1 },
      { tier: 2, description: "No restriction", score: 0 },
    ],
  },

  // ---- Pillar 12: Online Sales & Transactions ----
  {
    indicatorId: "P12-I1", pillarId: 12,
    focus: "Foreign equity limits in e-commerce sector",
    tiers: [
      { tier: 1, description: "A minority stake (1-50%) allowed", score: 1 },
      { tier: 2, description: "A controlling stake (51-99%) allowed", score: 0.5 },
      { tier: 3, description: "Full ownership (100%) allowed in the e-commerce sector", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I2", pillarId: 12,
    focus: "Online purchases and delivery limitations (Exception: does not score limitations applied specifically to products related to consumer protection, notably restrictions on alcoholic beverages, tobacco, and pharmaceuticals)",
    tiers: [
      { tier: 1, description: "Any measure limits the number of products that can be purchased online, and restricts delivery of products bought online", score: 1 },
      { tier: 2, description: "No measure", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I3", pillarId: 12,
    focus: "Licensing scheme for e-commerce providers (B2B and B2C) (Exception: licenses pertaining to other aspects of e-commerce businesses, such as licenses to operate online payment services or delivery, are not captured)",
    tiers: [
      { tier: 1, description: "Any license for e-commerce providers", score: 1 },
      { tier: 2, description: "No license", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I4", pillarId: 12,
    focus: "Online payment limitations",
    aggregation: "MAX",
    subCriteria: [
      { id: "12.4.1", description: "Requirement to use a local bank account", score: 1 },
      { id: "12.4.2", description: "Requirement on the currency used for international payments", score: 1 },
      { id: "12.4.3", description: "National standards for payment security that deviate from international standards", score: 1 },
      { id: "12.4.4", description: "Licensing requirements with restrictive conditions", score: 1 },
      { id: "12.4.5", description: "Ceiling on the maximum amount that can be paid by electronic payment methods", score: 1 },
      { id: "12.4.6", description: "Requirement mandating the use of specific intermediaries for online payments", score: 1 },
      { id: "12.4.7", description: "Other restrictions", score: 1 },
    ],
  },
  {
    indicatorId: "P12-I5", pillarId: 12,
    focus: "Low De Minimis",
    tiers: [
      { tier: 1, description: "No De Minimis", score: 1 },
      { tier: 2, description: "De Minimis below 200 USD", score: 0.5 },
      { tier: 3, description: "De Minimis at or above 200 USD", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I6", pillarId: 12,
    focus: "Imposition of custom duties on electronic transmission",
    tiers: [
      { tier: 1, description: "Imposition of custom duties on electronic transmission", score: 1 },
      { tier: 2, description: "Legal mechanisms or regulations applicable to impose custom duties on electronic transmission", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I7", pillarId: 12,
    focus: "Domain name requirements",
    tiers: [
      { tier: 1, description: "Physical presence required, or a requirement to register a local domain name to conduct electronic retail", score: 1 },
      { tier: 2, description: "Local representative required", score: 0.5 },
      { tier: 3, description: "No restriction", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I8", pillarId: 12,
    focus: "Local presence requirements for online service providers",
    tiers: [
      { tier: 1, description: "Local presence requirement for at least one sector", score: 1 },
      { tier: 2, description: "No requirement", score: 0 },
    ],
  },
  {
    indicatorId: "P12-I9", pillarId: 12,
    focus: "Lack of legal framework for online consumer protection",
    tiers: [
      { tier: 1, description: "No consumer protection legal framework applicable to online commerce", score: 1 },
      { tier: 2, description: "Consumer protection law applicable to online commerce", score: 0 },
    ],
  },
];

const BY_ID = new Map(GROUP_B_CRITERIA.map((c) => [c.indicatorId, c]));

export function findCriteria(indicatorId: string): IndicatorCriteria | undefined {
  return BY_ID.get(indicatorId);
}

export const GROUP_B_INDICATOR_IDS: Set<string> = new Set(GROUP_B_CRITERIA.map((c) => c.indicatorId));

// ── consistency guards (fail loudly at import time, not silently) ──────────────
{
  const dupes = GROUP_B_CRITERIA.map((c) => c.indicatorId).filter((id, i, arr) => arr.indexOf(id) !== i);
  if (dupes.length) throw new Error(`criteriaTable.ts: duplicate indicatorId(s): ${[...new Set(dupes)].join(", ")}`);

  const mismatches: string[] = [];
  for (const c of GROUP_B_CRITERIA) {
    const known = findIndicator(c.indicatorId);
    if (!known) { mismatches.push(`${c.indicatorId}: not found in indicators.ts`); continue; }
    if (known.pillarId !== c.pillarId) {
      mismatches.push(`${c.indicatorId}: pillarId mismatch (criteriaTable=${c.pillarId}, indicators.ts=${known.pillarId})`);
    }
  }
  if (mismatches.length) throw new Error(`criteriaTable.ts / indicators.ts mismatch:\n${mismatches.join("\n")}`);

  const overlap = [...GROUP_B_INDICATOR_IDS].filter((id) => GROUP_A_INDICATOR_IDS.has(id));
  if (overlap.length) throw new Error(`criteriaTable.ts: indicator(s) double-scored by both Group A and Group B: ${overlap.join(", ")}`);
}

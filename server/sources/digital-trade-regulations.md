# Digital Trade Regulation Sources

> Curated list of **official / primary** sources to scrape for digital-trade and
> data-governance regulations. AILA's scraper (`server/src/sources.ts`) parses the
> markdown tables below — every row whose **URL** column contains an `http(s)` link
> becomes a scrape target.
>
> **Format** = the resource type at the URL (`html` page index, or a `pdf` document).
> **Cadence** = how often the crawler should re-check (`daily`, `weekly`, `monthly`).
>
> ⚠️ These are starting points compiled for a prototype. Verify each URL and confirm
> the site's `robots.txt` / terms of use before enabling automated scraping in production.

---

## ASEAN — Regional Frameworks

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| ASEAN | Digital Economy Framework Agreement (DEFA) | https://asean.org/our-communities/economic-community/asean-digital-economy-framework-agreement/ | html | weekly | Negotiating text + factsheets |
| ASEAN | Agreement on Electronic Commerce | https://asean.org/book/asean-agreement-on-electronic-commerce/ | html | monthly | In force 2021 |
| ASEAN | Digital Masterplan 2025 | https://asean.org/book/asean-digital-masterplan-2025/ | html | monthly | Strategic roadmap |
| ASEAN | Model Contractual Clauses for Cross-Border Data Flows | https://asean.org/book/asean-model-contractual-clauses-for-cross-border-data-flows/ | html | monthly | MCC reference text |

## Singapore

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Singapore | Personal Data Protection Act (PDPA) | https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act | html | weekly | PDPC primary legislation page |
| Singapore | Digital Economy Agreements (DEAs) | https://www.mti.gov.sg/Trade/Digital-Economy-Agreements | html | weekly | MTI hub for DEAs |
| Singapore | Digital Economy Partnership Agreement (DEPA) | https://www.mti.gov.sg/Trade/Digital-Economy-Agreements/The-Digital-Economy-Partnership-Agreement | html | monthly | SG–NZ–Chile |
| Singapore | IMDA — Regulations & Policy | https://www.imda.gov.sg/regulations-and-licensing-listing | html | weekly | Infocomm Media regulator |
| Singapore | Payment Services Act (MAS) | https://www.mas.gov.sg/regulation/acts/payment-services-act | html | weekly | Digital payment tokens / e-money |

## Malaysia

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Malaysia | Personal Data Protection Act 2010 | https://www.pdp.gov.my/jpdpv2/akta-709/ | html | weekly | JPDP (PDP Commissioner) |
| Malaysia | MCMC — Acts & Regulations | https://www.mcmc.gov.my/en/legal/acts | html | weekly | Communications & Multimedia Act |

## Thailand

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Thailand | Personal Data Protection Act (PDPA) | https://www.pdpc.or.th/ | html | weekly | Thai PDPC |
| Thailand | ETDA — Electronic Transactions | https://www.etda.or.th/th/ETC/strategy-law-standard/strategy/Strategic-Plan-on-Electronic-Transactions.aspx | html | monthly | e-Transactions / digital ID |

## Philippines

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Philippines | Data Privacy Act (R.A. 10173) | https://privacy.gov.ph/data-privacy-act/ | html | weekly | National Privacy Commission |
| Philippines | NPC Issuances (Circulars / Advisories) | https://privacy.gov.ph/issuances/ | html | weekly | Circulars 16-01..16-03, advisories |
| Philippines | DTI — E-Commerce | https://www.dti.gov.ph/uncategorized/dti-e-commerce-office | html | monthly | Internet Transactions Act |
| Philippines | BSP — Digital Payments | https://www.bsp.gov.ph/SitePages/Regulations/Regulations.aspx | html | monthly | Financial / fintech rules |

## Indonesia

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Indonesia | Personal Data Protection Law (UU PDP 27/2022) | https://www.komdigi.go.id/ | html | weekly | Ministry of Communication & Digital |
| Indonesia | GR 71/2019 — Electronic Systems & Transactions | https://jdih.komdigi.go.id/ | html | monthly | Legal documentation portal |

## Vietnam

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| Vietnam | Decree 13/2023 on Personal Data Protection | https://english.mic.gov.vn/ | html | weekly | Ministry of Information & Comms |
| Vietnam | Law on Cybersecurity | https://english.luatvietnam.vn/ | html | monthly | Cyber / data localization |

## Global & Multilateral Frameworks

| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
|---|---|---|---|---|---|
| WTO | Joint Statement Initiative on E-Commerce | https://www.wto.org/english/tratop_e/ecom_e/ecom_e.htm | html | weekly | Plurilateral digital trade rules |
| OECD | Digital Trade | https://www.oecd.org/en/topics/digital-trade.html | html | monthly | Indicators + policy analysis |
| UNCTAD | Data Protection & Privacy Legislation Worldwide | https://unctad.org/page/data-protection-and-privacy-legislation-worldwide | html | monthly | Global cyberlaw tracker |
| APEC | Cross-Border Privacy Rules (CBPR) System | https://www.apec.org/about-us/about-apec/fact-sheets/what-is-the-cross-border-privacy-rules-system | html | monthly | Interoperable privacy certification |
| CPTPP | Comprehensive & Progressive TPP — Digital Trade Ch. 14 | https://www.dfat.gov.au/trade/agreements/in-force/cptpp/comprehensive-and-progressive-agreement-for-trans-pacific-partnership | html | monthly | Treaty text |
| EU | Digital Services Act / Digital Markets Act | https://digital-strategy.ec.europa.eu/en/policies/digital-services-act-package | html | monthly | Reference / extraterritorial reach |
| USA | USMCA — Digital Trade Chapter 19 | https://ustr.gov/trade-agreements/free-trade-agreements/united-states-mexico-canada-agreement/agreement-between | html | monthly | Treaty text |
